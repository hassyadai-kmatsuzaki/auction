<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class RegisterController extends Controller
{
    /**
     * ユーザー登録申請
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'trade_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'required|string|max:20',
            'postal_code' => 'required|string|max:10',
            'prefecture' => 'required|string|max:50',
            'city' => 'required|string|max:100',
            'address_line1' => 'required|string|max:255',
            'address_line2' => 'nullable|string|max:255',
        ], [
            'name.required' => 'お名前は必須です。',
            'name.max' => 'お名前は255文字以内で入力してください。',
            'trade_name.max' => '屋号は255文字以内で入力してください。',
            'company_name.max' => '法人名は255文字以内で入力してください。',
            'email.required' => 'メールアドレスは必須です。',
            'email.email' => '有効なメールアドレスを入力してください。',
            'email.unique' => 'このメールアドレスは既に登録されています。',
            'password.required' => 'パスワードは必須です。',
            'password.min' => 'パスワードは8文字以上で入力してください。',
            'password.confirmed' => 'パスワードが一致しません。',
            'phone.required' => '電話番号は必須です。',
            'postal_code.required' => '郵便番号は必須です。',
            'prefecture.required' => '都道府県は必須です。',
            'city.required' => '市区町村は必須です。',
            'address_line1.required' => '番地は必須です。',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            // ユーザーを作成（承認待ちステータス）
            $user = User::create([
                'name' => $request->name,
                'trade_name' => $request->trade_name,
                'company_name' => $request->company_name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'phone' => $request->phone,
                'postal_code' => $request->postal_code,
                'prefecture' => $request->prefecture,
                'city' => $request->city,
                'address_line1' => $request->address_line1,
                'address_line2' => $request->address_line2,
                'status' => 'pending',
            ]);

            // 参加者ロールを付与
            $participantRole = Role::where('name', 'participant')->first();
            if ($participantRole) {
                $user->roles()->attach($participantRole->id);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '登録申請を受け付けました。管理者の承認をお待ちください。',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'status' => $user->status,
                    ],
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
