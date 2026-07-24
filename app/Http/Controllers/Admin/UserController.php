<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Plan;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\Subscription;
use App\Models\EmailVerificationToken;
use App\Mail\AccountApprovedMail;
use App\Mail\SetPasswordMail;
use App\Services\Payment\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * ユーザー一覧取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $query = User::with(['roles', 'sellerProfile', 'sellerProfile.user:id,profile_image_path']);

        // デフォルトでアクティブなユーザーのみ表示（削除済みを除外）
        // show_deleted=true の場合は削除済みも含める
        if (!$request->boolean('show_deleted')) {
            $query->where('is_active', true);
        }

        // フィルタ
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('role')) {
            $query->whereHas('roles', function ($q) use ($request) {
                $q->where('name', $request->role);
            });
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // ソート
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // ページネーション（per_page=all で全件返す）
        $perPage = $request->get('per_page', 20);
        if ($perPage === 'all') {
            $all = $query->get();
            $users = new \Illuminate\Pagination\LengthAwarePaginator(
                $all,
                $all->count(),
                max($all->count(), 1),
                1
            );
        } else {
            $users = $query->paginate((int) $perPage);
        }

        // アイコン URL を一覧用に明示的に付与（accessor は $appends 未設定のため toArray に含まれない）
        $users->getCollection()->transform(function ($user) {
            $userArr = $user->toArray();
            $userArr['profile_image_url'] = $user->profile_image_url;
            if ($user->sellerProfile) {
                $userArr['seller_profile']['profile_image_url'] = $user->sellerProfile->profile_image_url;
            }
            return $userArr;
        });

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * ユーザー詳細取得
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $user = User::with(['roles', 'sellerProfile', 'sellerProfile.user:id,profile_image_path', 'subscription.plan'])->findOrFail($id);

        // 出品者プロフィールがある場合は口座情報も含める（管理者用）
        $userData = $user->toArray();
        $userData['profile_image_url'] = $user->profile_image_url;
        if ($user->sellerProfile) {
            $userData['seller_profile'] = $user->sellerProfile->getWithBankInfo();
        }

        return response()->json([
            'success' => true,
            'data' => ['user' => $userData],
        ]);
    }

    /**
     * ユーザー作成
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'phone' => 'nullable|string|max:20',
            'postal_code' => 'nullable|string|max:10',
            'prefecture' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'roles' => 'required|array|min:1',
            'roles.*' => 'required|string|in:admin,seller,participant,media_editor',
            'force_create' => 'nullable|boolean', // 削除済みユーザーを完全削除して再作成する場合
            'is_test' => 'nullable|boolean',
        ]);

        // 既存ユーザーチェック（削除済み含む）
        $existingUser = User::where('email', $request->email)->first();

        if ($existingUser) {
            // アクティブなユーザーが存在する場合
            if ($existingUser->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'このメールアドレスは既に使用されています。',
                    'errors' => ['email' => ['このメールアドレスは既に使用されています。']],
                ], 422);
            }

            // 削除済みユーザーが存在する場合
            if (!$request->force_create) {
                return response()->json([
                    'success' => false,
                    'message' => 'このユーザーは過去に削除されています。',
                    'deleted_user' => [
                        'id' => $existingUser->id,
                        'name' => $existingUser->name,
                        'email' => $existingUser->email,
                        'deleted_at' => $existingUser->updated_at,
                    ],
                    'action_required' => 'restore_or_recreate',
                ], 409); // Conflict
            }

            // force_create=true の場合、完全削除して再作成
            $existingUser->roles()->detach();
            $existingUser->forceDelete();
        }

        DB::beginTransaction();
        try {
            // ユーザー作成（管理者が作成したので承認済み）
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make(Str::random(32)), // 一時パスワード
                'phone' => $request->phone,
                'postal_code' => $request->postal_code,
                'prefecture' => $request->prefecture,
                'city' => $request->city,
                'address_line1' => $request->address_line1,
                'address_line2' => $request->address_line2,
                'status' => 'approved', // 管理者が作成したユーザーは承認済み
                'is_active' => true,
                'is_test' => (bool) $request->boolean('is_test'),
                'approved_at' => now(),
                'approved_by' => auth()->id(),
            ]);

            // ロールを付与
            foreach ($request->roles as $roleName) {
                $role = Role::where('name', $roleName)->firstOrFail();
                $user->roles()->attach($role->id, [
                    'assigned_at' => now(),
                    'assigned_by' => auth()->id(),
                ]);

                // 出品者ロールの場合、seller_profilesも作成
                if ($roleName === 'seller') {
                    SellerProfile::create([
                        'user_id' => $user->id,
                        'seller_code' => 'S' . str_pad((SellerProfile::max('id') ?? 0) + 1, 6, '0', STR_PAD_LEFT),
                        'seller_name' => $user->name,
                        'business_registration_number' => $user->business_registration_number,
                        'contact_name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone ?? '',
                        'postal_code' => $user->postal_code,
                        'prefecture' => $user->prefecture,
                        'city' => $user->city,
                        'address_line1' => $user->address_line1,
                        'address_line2' => $user->address_line2,
                        'is_active' => true,
                    ]);
                }
            }

            // パスワード設定用トークンを生成
            $token = Str::random(64);
            EmailVerificationToken::create([
                'user_id' => $user->id,
                'token' => $token,
                'expires_at' => now()->addDays(7), // 7日間有効
            ]);

            // メール送信
            $verificationUrl = config('app.frontend_url') . '/auth/set-password?token=' . $token;
            Mail::to($user->email)->send(new SetPasswordMail($user, $verificationUrl));

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'status' => $user->status,
                        'roles' => $request->roles,
                    ],
                    'verification_url' => $verificationUrl,
                ],
                'message' => 'ユーザーを作成し、パスワード設定用のメールを送信しました',
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * ユーザー更新
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name' => 'string|max:255',
            'trade_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'postal_code' => 'nullable|string|max:10',
            'prefecture' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'status' => 'in:pending,approved,suspended,rejected',
            'is_active' => 'boolean',
            'is_test' => 'boolean',
            'roles' => 'array',
            'roles.*' => 'string|in:admin,seller,participant,media_editor',
        ]);

        $shouldNotifyApproval = false;
        $planSyncMessage = null;

        DB::beginTransaction();
        try {
            // ユーザー情報更新
            $user->update($request->only([
                'name', 'trade_name', 'company_name',
                'phone', 'postal_code', 'prefecture',
                'city', 'address_line1', 'address_line2', 'status', 'is_active', 'is_test'
            ]));

            // ステータス変更時の処理
            if ($request->has('status')) {
                if ($request->status === 'approved' && $user->wasChanged('status')) {
                    $shouldNotifyApproval = true;
                    $user->update([
                        'approved_at' => now(),
                        'approved_by' => auth()->id(),
                    ]);

                    // 承認時に出品者ロールがあれば SellerProfile も自動有効化
                    $hasSellerRole = $user->roles()->where('name', 'seller')->exists();
                    if ($hasSellerRole && $user->sellerProfile) {
                        $user->sellerProfile->update(['is_active' => true]);
                    }
                }
            }

            // ロール更新
            if ($request->has('roles')) {
                $user->roles()->detach();
                foreach ($request->roles as $roleName) {
                    $role = Role::where('name', $roleName)->firstOrFail();
                    $user->roles()->attach($role->id, [
                        'assigned_at' => now(),
                        'assigned_by' => auth()->id(),
                    ]);
                }

                // 会員種別の変化に合わせて年会費サブスクのプランも切替（次回更新から新料金適用）
                $planSyncMessage = $this->syncSubscriptionPlanWithRoles($user, $request->roles);
            }

            DB::commit();

            if ($shouldNotifyApproval) {
                Mail::to($user->email)->queue(new AccountApprovedMail($user));
            }

            return response()->json([
                'success' => true,
                'data' => ['user' => $user->fresh(['roles'])],
                'message' => 'ユーザー情報を更新しました' . ($planSyncMessage ? '。' . $planSyncMessage : ''),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * ロール変更に合わせて年会費サブスクの plan_id を切り替える。
     *
     * 即時決済・返金・期間変更は行わない。renew() は課金時に plan->amount を
     * 参照するため、plan_id を変えるだけで次回更新から新料金が適用される
     * （カード・銀行振込どちらの更新経路も同様）。
     *   - seller ロールあり → both / participant のみ → bid_only
     *   - 1Day(単発)プランは対象外（renew 対象外の単発を年会費プランに変えると
     *     意図せぬ自動課金になる。切替は switchMembership の解約→本人決済フロー）
     *   - canceled のサブスク、会員ロールなし（admin/media_editor のみ）は触らない
     *
     * @param array<int, string> $roleNames
     * @return string|null 変更した場合の管理者向けメッセージ
     */
    private function syncSubscriptionPlanWithRoles(User $user, array $roleNames): ?string
    {
        $subscription = $user->subscription()->with('plan')->first();
        if (!$subscription || $subscription->status === Subscription::STATUS_CANCELED) {
            return null;
        }
        if ($subscription->plan && $subscription->plan->isOneShot()) {
            return null;
        }

        $isSeller = in_array('seller', $roleNames, true);
        if (!$isSeller && !in_array('participant', $roleNames, true)) {
            return null;
        }

        $targetCode = $isSeller ? 'both' : 'bid_only';
        if ($subscription->plan && $subscription->plan->code === $targetCode) {
            return null;
        }

        $targetPlan = Plan::where('code', $targetCode)->first();
        if (!$targetPlan) {
            \Illuminate\Support\Facades\Log::warning('syncSubscriptionPlanWithRoles: target plan not found', [
                'user_id' => $user->id,
                'code'    => $targetCode,
            ]);
            return null;
        }

        $oldPlanName = $subscription->plan->name ?? ('plan_id=' . $subscription->plan_id);
        $subscription->update(['plan_id' => $targetPlan->id]);

        \Illuminate\Support\Facades\Log::info('Admin role change synced subscription plan', [
            'user_id'    => $user->id,
            'from'       => $oldPlanName,
            'to'         => $targetPlan->code,
            'changed_by' => auth()->id(),
        ]);

        return sprintf('サブスクプランを「%s」に変更しました（次回更新から新料金が適用されます）', $targetPlan->name);
    }

    /**
     * ユーザー削除
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        $user = User::findOrFail($id);

        // 管理者は最低1人は残す
        if ($user->roles()->where('name', 'admin')->exists()) {
            $adminCount = User::whereHas('roles', function ($q) {
                $q->where('name', 'admin');
            })->where('is_active', true)->count();

            if ($adminCount <= 1) {
                return response()->json([
                    'success' => false,
                    'message' => '管理者は最低1人必要です',
                ], 400);
            }
        }

        // ソフトデリート（is_activeをfalseに）
        $user->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'ユーザーを削除しました',
        ]);
    }

    /**
     * 銀行振込モードで更新期限が30日以内に迫っているユーザー一覧。
     * 管理画面トップで通知モーダルとして使用する。
     */
    public function bankTransferRenewals(Request $request)
    {
        $threshold = now()->copy()->addDays(30);

        $users = User::with(['subscription.plan'])
            ->where('payment_method_preference', 'bank_transfer')
            ->where('is_active', true)
            ->whereHas('subscription', function ($q) use ($threshold) {
                $q->where('status', 'active')
                  ->whereNotNull('current_period_end')
                  ->where('current_period_end', '<=', $threshold);
            })
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'company_name' => $u->company_name,
                    'bank_transfer_confirmed_at' => $u->bank_transfer_confirmed_at,
                    'subscription' => [
                        'id' => $u->subscription->id,
                        'status' => $u->subscription->status,
                        'plan_name' => $u->subscription->plan?->name,
                        'plan_amount' => $u->subscription->plan?->amount,
                        'current_period_end' => $u->subscription->current_period_end,
                    ],
                ];
            });

        return response()->json([
            'success' => true,
            'data' => ['users' => $users],
        ]);
    }

    /**
     * 銀行振込モードのユーザーに対して年次更新案内を発行する（管理者操作）。
     * bank_transfer_confirmed_at をリセットしてログイン時に振込情報モーダルを再表示させ、
     * 新たな pending payment を1件作成する。入金確認時には confirmBankTransfer を使う。
     */
    public function renewBankTransfer($id, SubscriptionService $service)
    {
        $user = User::findOrFail($id);

        try {
            $subscription = $service->prepareBankTransferRenewal($user);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => '更新案内を発行しました。ユーザー次回ログイン時に振込情報モーダルが表示されます。',
            'data' => [
                'user' => $user->fresh(['roles']),
                'subscription' => $subscription,
            ],
        ]);
    }

    /**
     * 銀行振込確認済みにする。pending payment を completed、subscription を active に切替え、
     * 振込確認モーダルが次回ログイン以降表示されないように bank_transfer_confirmed_at を打刻する。
     *
     * @param int $id
     * @param SubscriptionService $service
     * @return \Illuminate\Http\JsonResponse
     */
    public function confirmBankTransfer($id, SubscriptionService $service)
    {
        $user = User::findOrFail($id);

        if ($user->payment_method_preference !== 'bank_transfer') {
            return response()->json([
                'success' => false,
                'message' => 'このユーザーは銀行振込モードではありません',
            ], 422);
        }

        try {
            $subscription = $service->confirmBankTransfer($user);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => '振込確認を完了しました',
            'data' => [
                'user' => $user->fresh(['roles']),
                'subscription' => $subscription,
            ],
        ]);
    }

    /**
     * 会員種別切替: 1Day会員 → 落札者(buyer) / 落札出品者(seller)。
     * （1Day会員_実装方針書_20260710.md §3.6-3.7）
     *
     * やること:
     *   1. 1Dayサブスクを即時解約（Squareカード無効化込み・reason=switched_by_admin）
     *   2. seller 切替なら seller ロール + SellerProfile を整備
     *
     * 年会費の課金は行わない。本人が次回ログイン時の加入モーダルで満額を決済する。
     * switched_by_admin マーカーが立っている間、加入モーダルには年会費プランのみが
     * 表示され（1Day再選択ブロック）、本人の決済完了でマーカーは自動で消える。
     */
    public function switchMembership(Request $request, $id, SubscriptionService $service)
    {
        $request->validate([
            'member_type' => 'required|string|in:buyer,seller',
        ]);

        $user = User::with(['roles', 'subscription.plan', 'sellerProfile'])->findOrFail($id);

        if ($user->roles->contains('name', 'admin')) {
            return response()->json([
                'success' => false,
                'message' => '管理者ユーザーは切替できません',
            ], 422);
        }

        $subscription = $user->subscription;

        // 切替対象は「1Dayサブスクを持つユーザー」または「E-NE 1Day契約で作成された未決済ユーザー
        // （intended_plan_code=one_day）」のみ。
        $hasOneShotSub   = $subscription && $subscription->plan && $subscription->plan->isOneShot();
        $hasOneDayIntent = $user->intended_plan_code === 'one_day';
        if (!$hasOneShotSub && !$hasOneDayIntent) {
            return response()->json([
                'success' => false,
                'message' => '1Day会員のユーザーのみ切替できます',
            ], 422);
        }

        // 1) 1Dayサブスクの即時解約（未決済ユーザーはサブスクが無いのでスキップ）。
        //    cancel() は Square API（カード無効化）を伴うため DBトランザクションの外で行う。
        //    失敗したら何も変えずに 422 で返し、管理者が再実行する。
        if ($hasOneShotSub) {
            try {
                if ($subscription->status !== Subscription::STATUS_CANCELED) {
                    $service->cancel($subscription, Subscription::REASON_SWITCHED_BY_ADMIN);
                } else {
                    // 自然失効(one_day_expired)済みでもマーカーを切替に揃えて 1Day 再選択を塞ぐ
                    $subscription->update(['suspended_reason' => Subscription::REASON_SWITCHED_BY_ADMIN]);
                }
            } catch (\RuntimeException $e) {
                return response()->json([
                    'success' => false,
                    'message' => '1Dayプランの解約処理に失敗しました: ' . $e->getMessage(),
                ], 422);
            }
        }

        // 2) ロール整備（冪等）。落札出品者は seller + participant、落札者は participant のみ。
        DB::transaction(function () use ($request, $user) {
            $ensureRole = function (string $roleName) use ($user): void {
                if (!$user->roles()->where('name', $roleName)->exists()) {
                    $role = Role::where('name', $roleName)->firstOrFail();
                    $user->roles()->attach($role->id, [
                        'assigned_at' => now(),
                        'assigned_by' => auth()->id(),
                    ]);
                }
            };

            $ensureRole('participant');

            if ($request->member_type === 'seller') {
                $ensureRole('seller');

                // SellerProfile が無ければ作成。切替対象は承認済みユーザーのため、
                // update() の承認時自動有効化と同じ扱いで is_active=true にする。
                if (!$user->sellerProfile) {
                    SellerProfile::create([
                        'user_id'        => $user->id,
                        'seller_code'    => 'S' . str_pad((SellerProfile::max('id') ?? 0) + 1, 6, '0', STR_PAD_LEFT),
                        'seller_name'    => $user->trade_name ?? $user->name,
                        'corporate_name' => $user->company_name,
                        // E-NE Webhook等で買受者時代に保持した番号を昇格時に引き継ぐ
                        'business_registration_number' => $user->business_registration_number,
                        'contact_name'   => $user->name,
                        'email'          => $user->email,
                        'phone'          => $user->phone ?? '',
                        'postal_code'    => $user->postal_code,
                        'prefecture'     => $user->prefecture,
                        'city'           => $user->city,
                        'address_line1'  => $user->address_line1,
                        'address_line2'  => $user->address_line2,
                        'is_active'      => true,
                    ]);
                } elseif (!$user->sellerProfile->is_active) {
                    $updates = ['is_active' => true];
                    // 番号が未設定なら users 側の保持値を補完（既存プロフィールの値は上書きしない）
                    if (!$user->sellerProfile->business_registration_number && $user->business_registration_number) {
                        $updates['business_registration_number'] = $user->business_registration_number;
                    }
                    $user->sellerProfile->update($updates);
                }
            }

            // 3) 次回決済プランを切替先の年会費プランに固定（決済モーダルはこのプランのみ提示。
            //    決済完了で自動解除）。未決済のE-NE 1Day契約ユーザーの one_day マーカーもここで上書きされる。
            $user->forceFill([
                'intended_plan_code' => $request->member_type === 'seller' ? 'both' : 'bid_only',
            ])->save();
        });

        $memberTypeLabel = $request->member_type === 'seller' ? '落札出品者' : '落札者';

        return response()->json([
            'success' => true,
            'message' => sprintf(
                '%sへの切替を受け付けました。1Day会員は解約済みです。ご本人が次回ログイン時に年会費プランを決済すると切替が完了します。',
                $memberTypeLabel
            ),
            'data' => [
                'user' => $user->fresh(['roles', 'sellerProfile', 'subscription.plan']),
            ],
        ]);
    }

    /**
     * 1Day枠の付与（intended_plan_code='one_day' を立てる）。
     *
     * 2026-07-24 以降、単発プラン（1Day）はマーカー保持者にしか加入モーダルに出ない
     * （[User/SubscriptionController::show()]）。マーカーは初回決済で自動解除されるため、
     * 失効した1Day会員に「もう一度500円で使わせる」にはここで立て直す必要がある。
     * E-NE 経由の再契約は既存メール扱い（handleDuplicate）でマーカーが付き直さないため、
     * 実質この画面が唯一の付与導線になる。
     *
     * 課金はしない。本人が次回ログイン時の加入モーダルで 1Day を決済する。
     */
    public function grantOneDay(Request $request, $id)
    {
        $user = User::with(['roles', 'subscription.plan'])->findOrFail($id);

        if ($user->roles->contains('name', 'admin')) {
            return response()->json([
                'success' => false,
                'message' => '管理者ユーザーには付与できません',
            ], 422);
        }

        // 1Day は allows_sell=false。出品者ロールの加入モーダルは allows_sell=true の
        // プランしか描画しないため、付与すると「加入可能なプランがありません」になる。
        if ($user->roles->contains('name', 'seller')) {
            return response()->json([
                'success' => false,
                'message' => '出品者ロールのユーザーには1Day枠を付与できません（1Dayは落札のみのプランです）',
            ], 422);
        }

        if (!Plan::active()->where('code', 'one_day')->exists()) {
            return response()->json([
                'success' => false,
                'message' => '1Dayプランが無効化されています。プラン管理から有効化してください',
            ], 422);
        }

        // 有効なサブスクがある間は加入モーダル自体が出ないため、付与しても効果がない。
        $subscription = $user->subscription;
        if ($subscription && $subscription->isActive()) {
            return response()->json([
                'success' => false,
                'message' => '有効な会員プランに加入中のため付与できません。期間終了後に再度お試しください',
            ], 422);
        }

        DB::transaction(function () use ($user, $subscription) {
            // 会員種別切替マーカー（canceled + switched_by_admin）が残っていると show() が
            // 単発プランを弾き、1Day 1択のはずが0件になる。改めて1Day枠を与える＝切替手続きは
            // 取り下げる意思のため、理由を差し替えてマーカーを解除する（履歴は残す）。
            if ($subscription && $subscription->isSwitchedByAdmin()) {
                $subscription->update(['suspended_reason' => 'one_day_granted_by_admin']);
            }

            $user->forceFill(['intended_plan_code' => 'one_day'])->save();
        });

        return response()->json([
            'success' => true,
            'message' => '1Day枠を付与しました。ご本人が次回ログイン時に1Day会員（500円）を決済できます。',
            'data' => [
                'user' => $user->fresh(['roles', 'sellerProfile', 'subscription.plan']),
            ],
        ]);
    }

    /**
     * 1Day枠の解除（誤付与の取り消し）。
     * 会員種別切替で立てた bid_only/both マーカーを消さないよう one_day のときだけ許可する。
     */
    public function revokeOneDay(Request $request, $id)
    {
        $user = User::with(['roles', 'subscription.plan'])->findOrFail($id);

        if ($user->intended_plan_code !== 'one_day') {
            return response()->json([
                'success' => false,
                'message' => '1Day枠が付与されていません',
            ], 422);
        }

        $user->forceFill(['intended_plan_code' => null])->save();

        return response()->json([
            'success' => true,
            'message' => '1Day枠を解除しました。加入モーダルには年会費プランが表示されます。',
            'data' => [
                'user' => $user->fresh(['roles', 'sellerProfile', 'subscription.plan']),
            ],
        ]);
    }

    /**
     * ユーザーアイコン（users.profile_image_path）アップロード
     */
    public function uploadProfileImage(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($user->profile_image_path) {
            Storage::disk('public')->delete($user->profile_image_path);
        }

        $file = $request->file('image');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs("avatars/user/{$user->id}", $filename, 'public');

        $user->profile_image_path = $path;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'プロフィール画像を更新しました。',
            'data' => [
                'profile_image_path' => $user->profile_image_path,
                'profile_image_url' => $user->profile_image_url,
            ],
        ]);
    }

    /**
     * ユーザーアイコン削除
     */
    public function deleteProfileImage($id)
    {
        $user = User::findOrFail($id);

        if ($user->profile_image_path) {
            Storage::disk('public')->delete($user->profile_image_path);
            $user->profile_image_path = null;
            $user->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'プロフィール画像を削除しました。',
        ]);
    }

    /**
     * 出品者プロフィールアイコン（seller_profiles.profile_image_path）アップロード
     */
    public function uploadSellerProfileImage(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $profile = $user->sellerProfile;

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが存在しません。',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($profile->profile_image_path) {
            Storage::disk('public')->delete($profile->profile_image_path);
        }

        $file = $request->file('image');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs("avatars/seller/{$profile->id}", $filename, 'public');

        $profile->profile_image_path = $path;
        $profile->save();

        return response()->json([
            'success' => true,
            'message' => '出品者アイコンを更新しました。',
            'data' => [
                'profile_image_path' => $profile->profile_image_path,
                'profile_image_url' => $profile->profile_image_url,
            ],
        ]);
    }

    /**
     * 出品者プロフィールアイコン削除
     */
    public function deleteSellerProfileImage($id)
    {
        $user = User::findOrFail($id);
        $profile = $user->sellerProfile;

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => '出品者プロフィールが存在しません。',
            ], 404);
        }

        if ($profile->profile_image_path) {
            Storage::disk('public')->delete($profile->profile_image_path);
            $profile->profile_image_path = null;
            $profile->save();
        }

        return response()->json([
            'success' => true,
            'message' => '出品者アイコンを削除しました。',
        ]);
    }

    /**
     * 削除済みユーザーを復元
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function restore($id)
    {
        $user = User::where('id', $id)->where('is_active', false)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => '復元可能なユーザーが見つかりません。',
            ], 404);
        }

        DB::beginTransaction();
        try {
            // ユーザーを復元
            $user->update([
                'is_active' => true,
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => auth()->id(),
            ]);

            // パスワード設定用トークンを生成（新しいパスワード設定を促す）
            $token = Str::random(64);
            EmailVerificationToken::create([
                'user_id' => $user->id,
                'token' => $token,
                'expires_at' => now()->addDays(7),
            ]);

            // メール送信
            $verificationUrl = config('app.frontend_url') . '/auth/set-password?token=' . $token;
            Mail::to($user->email)->send(new SetPasswordMail($user, $verificationUrl));

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => $user->fresh(['roles']),
                ],
                'message' => 'ユーザーを復元し、パスワード設定用のメールを送信しました。',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
