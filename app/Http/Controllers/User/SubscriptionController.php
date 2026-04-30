<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Services\Payment\SquareApiException;
use App\Services\Payment\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class SubscriptionController extends Controller
{
    public function __construct(private readonly SubscriptionService $service) {}

    /**
     * 自分のサブスクリプション状態 + 加入可能プラン一覧
     */
    public function show(Request $request)
    {
        $user = $request->user();
        $subscription = $user->subscription()->with(['plan', 'payments' => fn($q) => $q->latest()->limit(5)])->first();

        $plans = Plan::active()->ordered()->get();

        // 銀行振込モードで管理者の振込確認待ち
        // 初回申込中 (status=pending) も、年次更新案内中 (status=active で confirmed_at がリセットされた状態) も含む。
        // テストユーザー (id<=509) は除外。
        $bankTransferPending = $user->id > 509
            && $subscription
            && $user->payment_method_preference === 'bank_transfer'
            && $user->bank_transfer_confirmed_at === null;

        // 通常の登録ゲート判定。bank_transfer 申請済み (= 管理者の振込確認待ち) は対象外。
        $requiresRegistration = $user->id > 509
            && !$bankTransferPending
            && (!$subscription || in_array($subscription->status, ['canceled', 'pending'], true));

        return response()->json([
            'success' => true,
            'data' => [
                'subscription' => $subscription,
                'plans'        => $plans,
                'requires_registration' => $requiresRegistration,
                'bank_transfer_pending' => $bankTransferPending,
                'is_active'    => $subscription ? $subscription->isActive() : false,
                'square_public' => [
                    'application_id' => config('services.square.application_id'),
                    'location_id'    => config('services.square.location_id'),
                    'environment'    => config('services.square.environment'),
                ],
            ],
        ]);
    }

    /**
     * 新規加入
     */
    public function store(Request $request)
    {
        $paymentMethod = $request->input('payment_method', 'card');

        $rules = [
            'plan_id'             => 'required|exists:plans,id',
            'payment_method'      => 'nullable|string|in:card,bank_transfer',
        ];
        if ($paymentMethod === 'card') {
            $rules['source_id']          = 'required|string|max:1000';
            $rules['verification_token'] = 'nullable|string|max:2000';
        }

        $validator = Validator::make($request->all(), $rules, [
            'plan_id.required' => 'プランを選択してください',
            'source_id.required' => 'カード情報の送信に失敗しました。再度お試しください',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $plan = Plan::active()->findOrFail($request->input('plan_id'));
        $user = $request->user();

        try {
            if ($paymentMethod === 'bank_transfer') {
                $subscription = $this->service->subscribeWithBankTransfer($user, $plan);

                return response()->json([
                    'success' => true,
                    'message' => '銀行振込のお申し込みを受け付けました。お振込み確認後にご利用可能となります。',
                    'data' => [
                        'subscription' => $subscription,
                        'payment_method' => 'bank_transfer',
                    ],
                ], 201);
            }

            $subscription = $this->service->subscribe(
                $user,
                $plan,
                (string) $request->input('source_id'),
                $request->input('verification_token')
            );
        } catch (SquareApiException $e) {
            return response()->json([
                'success' => false,
                'message' => '決済処理でエラーが発生しました: ' . $e->getMessage(),
                'errors'  => $e->errors,
            ], 402);
        } catch (\RuntimeException $e) {
            Log::warning('subscription store failed', ['user_id' => $user->id, 'err' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => '年会費プランへの加入が完了しました',
            'data' => [
                'subscription' => $subscription,
                'payment_method' => 'card',
            ],
        ], 201);
    }

    /**
     * カード再登録
     */
    public function replaceCard(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'source_id' => 'required|string|max:1000',
            'verification_token' => 'nullable|string|max:2000',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        try {
            $subscription = $this->service->replaceCard(
                $user,
                (string) $request->input('source_id'),
                $request->input('verification_token')
            );
        } catch (SquareApiException $e) {
            return response()->json([
                'success' => false,
                'message' => '決済処理でエラーが発生しました: ' . $e->getMessage(),
                'errors'  => $e->errors,
            ], 402);
        } catch (\RuntimeException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'カード情報を更新しました',
            'data' => ['subscription' => $subscription],
        ]);
    }

    /**
     * 自主解約（期末まで有効のままにするのではなく即時解約の単純実装）
     */
    public function cancel(Request $request)
    {
        $subscription = $request->user()->subscription;
        if (!$subscription) {
            return response()->json(['success' => false, 'message' => 'サブスクリプションがありません'], 404);
        }
        $this->service->cancel($subscription, $request->input('reason', 'user_cancel'));
        return response()->json(['success' => true, 'message' => '解約しました']);
    }
}
