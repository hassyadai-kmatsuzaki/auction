<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\EmailVerificationToken;
use App\Mail\SetPasswordMail;
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
        $query = User::with('roles');

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

        return response()->json([
            'success' => true,
            'data' => ['user' => $user],
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
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'postal_code' => 'nullable|string|max:10',
            'prefecture' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'roles' => 'required|array|min:1',
            'roles.*' => 'required|string|in:admin,seller,participant',
        ]);

        DB::beginTransaction();
        try {
            // ユーザー作成
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
                'status' => 'pending',
                'is_active' => true,
            ]);

            // ロールを付与
            foreach ($request->roles as $roleName) {
                $role = Role::where('name', $roleName)->firstOrFail();
                $user->roles()->attach($role->id, [
                    'assigned_at' => now(),
                    'assigned_by' => auth()->id(),
                ]);
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
            'roles' => 'array',
            'roles.*' => 'string|in:admin,seller,participant',
        ]);

        DB::beginTransaction();
        try {
            // ユーザー情報更新
            $user->update($request->only([
                'name', 'phone', 'postal_code', 'prefecture',
                'city', 'address_line1', 'address_line2', 'status', 'is_active'
            ]));

            // ステータス変更時の処理
            if ($request->has('status')) {
                if ($request->status === 'approved' && $user->wasChanged('status')) {
                    $user->update([
                        'approved_at' => now(),
                        'approved_by' => auth()->id(),
                    ]);
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
}
