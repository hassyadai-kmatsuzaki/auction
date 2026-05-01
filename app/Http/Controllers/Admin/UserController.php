<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\EmailVerificationToken;
use App\Mail\AccountApprovedMail;
use App\Mail\SetPasswordMail;
use App\Services\Payment\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
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
        $query = User::with(['roles', 'sellerProfile']);

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

        // ページネーション
        $users = $query->paginate(20);

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
        $user = User::with(['roles', 'sellerProfile'])->findOrFail($id);

        // 出品者プロフィールがある場合は口座情報も含める（管理者用）
        $userData = $user->toArray();
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
            'roles.*' => 'required|string|in:admin,seller,participant',
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
            'roles.*' => 'string|in:admin,seller,participant',
        ]);

        $shouldNotifyApproval = false;

        DB::beginTransaction();
        try {
            // ユーザー情報更新
            $user->update($request->only([
                'name', 'phone', 'postal_code', 'prefecture',
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
            }

            DB::commit();

            if ($shouldNotifyApproval) {
                Mail::to($user->email)->queue(new AccountApprovedMail($user));
            }

            return response()->json([
                'success' => true,
                'data' => ['user' => $user->fresh(['roles'])],
                'message' => 'ユーザー情報を更新しました',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
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
