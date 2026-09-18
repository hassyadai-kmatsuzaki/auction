<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Member\RegisterOnsiteMemberAction;
use App\Http\Controllers\Auth\Concerns\EnforcesSingleSession;
use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

/**
 * 当日会員登録（会場での電話番号登録）。
 *
 * system_settings.onsite_registration_enabled が ON の間だけ受け付ける。
 * 受付コード（onsite_registration_code）が設定されていれば一致を要求する。
 * 登録成功時はそのまま Sanctum トークンを発行して即ログイン状態にする。
 */
class OnsiteRegisterController extends Controller
{
    use EnforcesSingleSession;

    /**
     * 受付中かどうか（フロントがフォームを出す/出さないの判定に使う）。
     */
    public function status()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'enabled'       => (bool) SystemSetting::get('onsite_registration_enabled', false),
                'code_required' => trim((string) SystemSetting::get('onsite_registration_code', '')) !== '',
            ],
        ]);
    }

    public function register(Request $request, RegisterOnsiteMemberAction $action)
    {
        if (!SystemSetting::get('onsite_registration_enabled', false)) {
            return response()->json([
                'success' => false,
                'message' => '現在、当日会員登録は受け付けていません。',
                'code'    => 'ONSITE_REGISTRATION_DISABLED',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:255',
            'phone'    => 'required|string|max:30',
            'password' => 'required|string|min:8|max:100',
            'code'     => 'nullable|string|max:100',
        ], [
            'name.required'     => 'お名前は必須です。',
            'name.max'          => 'お名前は255文字以内で入力してください。',
            'phone.required'    => '電話番号は必須です。',
            'password.required' => 'パスワードは必須です。',
            'password.min'      => 'パスワードは8文字以上で入力してください。',
        ]);

        $validator->after(function ($v) use ($request) {
            $digits = User::normalizePhoneDigits($request->input('phone'));
            if (strlen($digits) < 10 || strlen($digits) > 11) {
                $v->errors()->add('phone', '電話番号は10〜11桁の数字で入力してください。');
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $requiredCode = trim((string) SystemSetting::get('onsite_registration_code', ''));
        if ($requiredCode !== '' && !hash_equals($requiredCode, trim((string) $request->input('code', '')))) {
            return response()->json([
                'success' => false,
                'message' => '受付コードが正しくありません。会場スタッフにご確認ください。',
                'code'    => 'ONSITE_CODE_MISMATCH',
            ], 403);
        }

        try {
            $user = $action->execute([
                'name'     => $request->input('name'),
                'phone'    => $request->input('phone'),
                'password' => $request->input('password'),
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        // 登録直後は他端末のトークンが存在しないので多重ログイン判定は不要。そのまま発行する。
        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth-token')->plainTextToken;
        ActivityLogger::login($user->id);

        return response()->json([
            'success' => true,
            'message' => '当日会員として登録しました。',
            'data' => [
                'user'  => LoginController::userPayload($user),
                'token' => $token,
            ],
        ], 201);
    }
}
