<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\DispatchEmailCampaignJob;
use App\Mail\CampaignMail;
use App\Models\EmailCampaign;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

/**
 * 管理画面のメール配信機能。
 *
 * - index/show:    キャンペーン一覧・詳細
 * - preview:       送信前の対象件数 + 先頭 5 件メアド + 自分宛テスト送信
 * - store:         キャンペーン作成 → そのまま queued にして DispatchEmailCampaignJob を投入
 * - cancel:        まだ draft/queued のキャンペーンを停止
 *
 * 個別送信は target_type=manual + target_user_ids=[user_id] で同じ store() を叩く。
 */
class EmailCampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->input('per_page', 20);
        $status = $request->input('status');

        $query = EmailCampaign::with('creator:id,name')
            ->orderByDesc('id');

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        $campaigns = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'campaigns' => $campaigns->items(),
                'pagination' => [
                    'total' => $campaigns->total(),
                    'per_page' => $campaigns->perPage(),
                    'current_page' => $campaigns->currentPage(),
                    'last_page' => $campaigns->lastPage(),
                ],
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $campaign = EmailCampaign::with('creator:id,name')->findOrFail($id);

        // 受信者は最大 100 件だけ返す（一覧表示用）
        $recipients = $campaign->recipients()
            ->with('user:id,name,email')
            ->orderBy('id')
            ->limit(100)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'campaign' => $campaign,
                'recipients_sample' => $recipients,
                'recipients_summary' => $campaign->recipients()
                    ->select('status', DB::raw('count(*) as count'))
                    ->groupBy('status')
                    ->pluck('count', 'status'),
            ],
        ]);
    }

    /**
     * 送信前プレビュー。対象件数と先頭 5 件のメアド、本文の差し込み済みサンプルを返す。
     */
    public function preview(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request, requireBody: false);

        $query = $this->buildRecipientQuery(
            $validated['target_type'],
            $validated['target_filter'] ?? [],
            $validated['target_user_ids'] ?? [],
        );

        $count = $query->count();
        $sample = (clone $query)->select('id', 'name', 'email')->limit(5)->get();

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $count,
                'sample' => $sample,
            ],
        ]);
    }

    /**
     * 自分宛テスト送信。本番送信前に件名・本文の見え方を確認するため、
     * 管理者自身のメアドに 1 通だけ送る。recipients テーブルには記録しない。
     */
    public function testSend(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request, requireBody: true);

        $admin = Auth::user();
        if (!$admin || !$admin->email) {
            return response()->json(['success' => false, 'message' => '管理者にメアドが設定されていません'], 422);
        }

        $tempCampaign = new EmailCampaign([
            'subject' => '[テスト送信] ' . $validated['subject'],
            'body_markdown' => $validated['body_markdown'],
            'target_type' => 'manual',
            'target_user_ids' => [$admin->id],
            'status' => 'draft',
            'created_by' => $admin->id,
        ]);

        Mail::to($admin->email)->send(new CampaignMail($tempCampaign, $admin));

        return response()->json([
            'success' => true,
            'message' => "{$admin->email} にテスト送信しました",
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInput($request, requireBody: true);

        $campaign = DB::transaction(function () use ($validated) {
            return EmailCampaign::create([
                'subject' => $validated['subject'],
                'body_markdown' => $validated['body_markdown'],
                'target_type' => $validated['target_type'],
                'target_filter' => $validated['target_filter'] ?? null,
                'target_user_ids' => $validated['target_user_ids'] ?? null,
                'status' => 'queued',
                'created_by' => Auth::id(),
                'scheduled_at' => $validated['scheduled_at'] ?? null,
            ]);
        });

        DispatchEmailCampaignJob::dispatch($campaign->id);

        Log::info('EmailCampaign created and queued', [
            'campaign_id' => $campaign->id,
            'target_type' => $campaign->target_type,
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'キャンペーンを投入しました',
            'data' => ['campaign' => $campaign],
        ], 201);
    }

    public function cancel(int $id): JsonResponse
    {
        $campaign = EmailCampaign::findOrFail($id);

        if (!$campaign->isCancellable()) {
            return response()->json([
                'success' => false,
                'message' => 'このキャンペーンは現在のステータス（' . $campaign->status . '）からはキャンセルできません',
            ], 422);
        }

        $campaign->update([
            'status' => 'cancelled',
            'completed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'キャンペーンをキャンセルしました',
        ]);
    }

    /**
     * 共通のバリデーション。preview は body 不要、store/test_send は body 必須。
     */
    private function validateInput(Request $request, bool $requireBody): array
    {
        $rules = [
            'subject' => $requireBody ? 'required|string|max:200' : 'nullable|string|max:200',
            'body_markdown' => $requireBody ? 'required|string|max:50000' : 'nullable|string|max:50000',
            'target_type' => 'required|in:all,filter,manual',
            'target_filter' => 'nullable|array',
            'target_filter.role' => 'nullable',
            'target_filter.has_won' => 'nullable|boolean',
            'target_filter.last_login_after' => 'nullable|date',
            'target_filter.last_login_before' => 'nullable|date',
            'target_filter.bank_transfer_unconfirmed' => 'nullable|boolean',
            'target_user_ids' => 'nullable|array|max:10000',
            'target_user_ids.*' => 'integer|exists:users,id',
            'scheduled_at' => 'nullable|date|after:now',
        ];

        $validator = Validator::make($request->all(), $rules);
        $validator->after(function ($v) use ($request) {
            $type = $request->input('target_type');
            if ($type === 'manual' && empty($request->input('target_user_ids'))) {
                $v->errors()->add('target_user_ids', 'target_type=manual の場合は対象ユーザーを 1 人以上指定してください');
            }
        });

        return $validator->validate();
    }

    private function buildRecipientQuery(string $targetType, array $filter, array $userIds)
    {
        $base = User::query()->approved()->mailable();

        return match ($targetType) {
            'all' => $base,
            'manual' => $base->whereIn('id', $userIds),
            'filter' => $this->applyFilters($base, $filter),
            default => $base->whereRaw('1=0'),
        };
    }

    /**
     * NOTE: DispatchEmailCampaignJob::applyFilters と同じロジック。
     * preview と本送信で件数がズレないよう同じ条件解釈にしている。
     * 仕様変更時は両方を必ず揃えること。
     */
    private function applyFilters($query, array $filters)
    {
        if (!empty($filters['role'])) {
            $roles = (array) $filters['role'];
            $query->whereHas('roles', fn ($q) => $q->whereIn('name', $roles));
        }
        if (!empty($filters['has_won'])) {
            $query->whereExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('won_items')
                  ->whereColumn('won_items.user_id', 'users.id');
            });
        }
        if (!empty($filters['last_login_after'])) {
            $query->where('last_login_at', '>=', $filters['last_login_after']);
        }
        if (!empty($filters['last_login_before'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('last_login_at', '<', $filters['last_login_before'])
                  ->orWhereNull('last_login_at');
            });
        }
        if (!empty($filters['bank_transfer_unconfirmed'])) {
            $query->where('payment_method_preference', 'bank_transfer')
                  ->whereNull('bank_transfer_confirmed_at');
        }
        return $query;
    }
}
