<?php

namespace App\Http\Controllers\TestHelpers;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\LineNotificationLog;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * SeedController
 *
 * Cypress E2E から叩かれるテストヘルパー API のコントローラ。
 * 必ず routes/api-test.php 経由 (= EnsureNonProduction ミドルウェア配下) で
 * 呼び出されることを前提としている。本番環境では 404 になるので
 * このクラス自体が直接公開されることは無いが、防御として
 * 各メソッド冒頭で再度 environment を確認する。
 */
class SeedController extends Controller
{
    /**
     * 共通の本番ガード。
     */
    protected function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing', 'staging'])) {
            abort(404);
        }
    }

    /**
     * WonItem (落札商品) を任意の状態で生成する。
     *
     * 受け付けるパラメータ:
     *   - winner_id          : int? 落札者 user_id
     *   - seller_id          : int? 出品者 user_id (item の seller_id 用)
     *   - payment_status     : string ('pending'|'paid'|'confirmed') 既定: pending
     *   - delivery_status    : string ('preparing'|'shipped'|'completed') 既定: preparing
     *   - payment_deadline   : ISO 8601 string?
     *   - winning_price      : int?
     *   - quantity           : int?
     *
     * 戻り値: JSON { ok: true, won_item: {...}, item: {...} }
     */
    public function seedWonItem(Request $request): JsonResponse
    {
        $this->guardEnvironment();

        $validated = $request->validate([
            'winner_id'        => ['nullable', 'integer', 'exists:users,id'],
            'seller_id'        => ['nullable', 'integer', 'exists:users,id'],
            'payment_status'   => ['nullable', 'in:pending,paid,confirmed'],
            'delivery_status'  => ['nullable', 'in:preparing,shipped,completed,pending'],
            'payment_deadline' => ['nullable', 'date'],
            'winning_price'    => ['nullable', 'integer', 'min:0'],
            'quantity'         => ['nullable', 'integer', 'min:1'],
        ]);

        $paymentStatus  = $validated['payment_status']  ?? 'pending';
        $deliveryStatus = $validated['delivery_status'] ?? 'preparing';

        try {
            $result = DB::transaction(function () use ($validated, $paymentStatus, $deliveryStatus) {
                // 出品者 (seller) を解決 / 生成
                $sellerId = $validated['seller_id'] ?? null;
                if ($sellerId === null) {
                    $seller = User::factory()->create();
                    $sellerId = $seller->id;
                }

                // 落札者 (winner) を解決 / 生成
                $winnerId = $validated['winner_id'] ?? null;
                if ($winnerId === null) {
                    $winner = User::factory()->create();
                    $winnerId = $winner->id;
                }

                // Item を生成 (sold 状態)。Item factory に sold() state がある前提
                $item = Item::factory()->sold()->create([
                    'seller_id' => $sellerId,
                ]);

                // WonItem を factory で生成 → 必要に応じて状態を上書き
                $factory = WonItem::factory();

                if ($paymentStatus === 'paid' && $deliveryStatus === 'preparing') {
                    $factory = $factory->paid();
                } elseif ($paymentStatus === 'confirmed' && $deliveryStatus === 'preparing') {
                    $factory = $factory->confirmed();
                } elseif ($deliveryStatus === 'shipped') {
                    $factory = $factory->shipped();
                } elseif ($deliveryStatus === 'completed') {
                    $factory = $factory->completed();
                }

                $overrides = [
                    'item_id'         => $item->id,
                    'winner_id'       => $winnerId,
                    'payment_status'  => $paymentStatus,
                    'delivery_status' => $deliveryStatus,
                ];

                if (! empty($validated['payment_deadline'])) {
                    $overrides['payment_deadline'] = $validated['payment_deadline'];
                }
                if (! empty($validated['winning_price'])) {
                    $overrides['winning_price'] = $validated['winning_price'];
                }
                if (! empty($validated['quantity'])) {
                    $overrides['quantity'] = $validated['quantity'];
                }

                $wonItem = $factory->create($overrides);

                return [
                    'won_item' => $wonItem->fresh(),
                    'item'     => $item->fresh(),
                ];
            });

            return response()->json([
                'ok'       => true,
                'won_item' => $result['won_item'],
                'item'     => $result['item'],
            ], 201);
        } catch (Throwable $e) {
            return response()->json([
                'ok'      => false,
                'message' => 'failed to seed won item',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Auction を生成するヘルパー (拡張用)。
     */
    public function seedAuction(Request $request): JsonResponse
    {
        $this->guardEnvironment();

        $validated = $request->validate([
            'seller_id'  => ['nullable', 'integer', 'exists:users,id'],
            'status'     => ['nullable', 'string'],
            'starts_at'  => ['nullable', 'date'],
            'ends_at'    => ['nullable', 'date'],
        ]);

        try {
            $factory = Auction::factory();

            $overrides = [];
            foreach (['seller_id', 'status', 'starts_at', 'ends_at'] as $key) {
                if (! empty($validated[$key])) {
                    $overrides[$key] = $validated[$key];
                }
            }

            $auction = $factory->create($overrides);

            return response()->json([
                'ok'      => true,
                'auction' => $auction->fresh(),
            ], 201);
        } catch (Throwable $e) {
            return response()->json([
                'ok'      => false,
                'message' => 'failed to seed auction',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * php artisan schedule:run を発火する。
     * task が指定された場合は対象の artisan command 単体を呼ぶ。
     *
     * パラメータ:
     *   - task : string? 例 'auctions:start-scheduled'
     */
    public function runSchedule(Request $request): JsonResponse
    {
        $this->guardEnvironment();

        $validated = $request->validate([
            'task' => ['nullable', 'string', 'max:200'],
        ]);

        try {
            if (! empty($validated['task'])) {
                // task 名が空白区切りで command + args になる場合に備えて分解
                $parts   = preg_split('/\s+/', trim($validated['task']));
                $command = array_shift($parts);
                $exit = Artisan::call($command, $parts);
            } else {
                $exit = Artisan::call('schedule:run');
            }

            return response()->json([
                'ok'        => true,
                'exit_code' => $exit,
                'output'    => Artisan::output(),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'ok'      => false,
                'message' => 'failed to run schedule',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * LINE 通知の送信履歴を返す。
     *
     * パラメータ:
     *   - user_id : int? 対象ユーザー
     *   - limit   : int? 既定 50, 最大 200
     */
    public function lineSent(Request $request): JsonResponse
    {
        $this->guardEnvironment();

        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'limit'   => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = $validated['limit'] ?? 50;

        $query = LineNotificationLog::query()
            ->orderByDesc('id')
            ->limit($limit);

        if (! empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        // hidden 属性 (line_user_id, message_payload) も E2E では確認したいので明示的に取得
        $rows = $query->get()->map(function (LineNotificationLog $log) {
            return [
                'id'                => $log->id,
                'user_id'           => $log->user_id,
                'notification_type' => $log->notification_type,
                'line_user_id'      => $log->getAttribute('line_user_id'),
                'message_payload'   => $log->getAttribute('message_payload'),
                'status'            => $log->status,
                'error_message'     => $log->error_message,
                'sent_at'           => $log->sent_at,
                'created_at'        => $log->created_at,
            ];
        });

        return response()->json([
            'ok'    => true,
            'count' => $rows->count(),
            'logs'  => $rows,
        ]);
    }
}
