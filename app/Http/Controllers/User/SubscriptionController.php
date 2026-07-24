<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Mail\BankTransferRequestedAdminMail;
use App\Models\Plan;
use App\Services\Payment\SquareApiException;
use App\Services\Payment\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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

        // 加入予定プランのマーカー（E-NE 1Day契約 / 管理者の会員種別切替）が立っていれば
        // そのプランのみ提示する。決済完了で自動解除。プランが無効化済み等で1件も
        // 該当しない場合は安全側に倒して全件提示（誰も加入できなくなる事故を防ぐ）。
        $intendedMatched = false;
        if ($user->intended_plan_code) {
            $intended = $plans->where('code', $user->intended_plan_code)->values();
            if ($intended->isNotEmpty()) {
                $plans = $intended;
                $intendedMatched = true;
            }
        }

        // 単発プラン（1Day）はマーカー保持者＝E-NE「1Day」契約者の専用プラン。
        // 1Day は allows_sell=false のため、放置すると落札者ロール全員のモーダルに
        // 「年会費5,500円 / 1Day 500円」の2択で並んでしまう（2026-07-24 報告）。
        // マーカーが立っていない利用者には年会費プランのみを提示する。
        if (!$intendedMatched) {
            $plans = $plans->reject(fn ($p) => $p->isOneShot())->values();
        }

        // 管理者による会員種別切替（1Day → 年会員）後は年会費プランのみ提示し、
        // 1Day（単発プラン）の再選択を塞ぐ。マーカーは本人が年会費を決済すると自動で消える。
        if ($subscription && $subscription->isSwitchedByAdmin()) {
            $plans = $plans->reject(fn ($p) => $p->isOneShot())->values();
        }

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

        // 加入予定プランのマーカー（E-NE 1Day契約 / 管理者の会員種別切替）が立っている場合、
        // そのプラン以外は選択不可（show() の絞り込みを直接POSTで迂回させない）。
        // マーカーのプランが無効化済みなら show() 同様に制限しない。
        if ($user->intended_plan_code
            && $plan->code !== $user->intended_plan_code
            && Plan::active()->where('code', $user->intended_plan_code)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'ご契約の会員種別のプランをご選択ください',
            ], 422);
        }

        // 単発プラン（1Day）は intended_plan_code マーカー保持者専用（show() の絞り込みと対）。
        // マーカー無しの落札者が直接 POST しても 500円プランに加入できないようにする。
        if ($plan->isOneShot() && $user->intended_plan_code !== $plan->code) {
            return response()->json([
                'success' => false,
                'message' => 'ご契約の会員種別のプランをご選択ください',
            ], 422);
        }

        // 会員種別切替後（switched_by_admin マーカー）は年会費プランのみ選択可
        // ※ 1Day×銀行振込の制限は 2026-07-13 に撤回（振込でも加入可。入金確認時点から期間起算）
        if ($plan->isOneShot()) {
            $current = $user->subscription;
            if ($current && $current->isSwitchedByAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => '会員種別の切替手続き中のため、年会費プランをご選択ください',
                ], 422);
            }
        }

        try {
            if ($paymentMethod === 'bank_transfer') {
                $subscription = $this->service->subscribeWithBankTransfer($user, $plan);

                foreach (['tshort.m.nakakita@gmail.com', 'k.matsuzaki@beer-o-clock.jp'] as $adminEmail) {
                    try {
                        Mail::to($adminEmail)->queue(new BankTransferRequestedAdminMail($user, $plan));
                    } catch (\Throwable $e) {
                        Log::warning('failed to queue bank transfer admin notification', [
                            'user_id' => $user->id,
                            'admin'   => $adminEmail,
                            'err'     => $e->getMessage(),
                        ]);
                    }
                }

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
