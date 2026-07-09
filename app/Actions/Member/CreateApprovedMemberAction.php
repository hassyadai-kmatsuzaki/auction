<?php

namespace App\Actions\Member;

use App\Mail\SetPasswordMail;
use App\Models\EmailVerificationToken;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * 承認済み会員を作成し、パスワード設定メールを送る。
 *
 * 管理画面のユーザー作成（Admin\UserController::store）と同じ流儀:
 *   status='approved' の会員を作成 → ロール付与 → 一時パスワード → SetPasswordMail 送信。
 *
 * E-NE 契約締結 Webhook（システム発行, approved_by=null）から利用する。
 *
 * 「入札/出品の実権限」はプラン(サブスク)で決まり、本Actionはサブスクを作らない。
 * 会員はログイン後に決済画面で従来どおりプランに加入する。
 */
class CreateApprovedMemberAction
{
    /**
     * 会員種別 → 付与ロール のマッピング。
     *
     * ⚠ seller ロールが無いと出品系ルート(check.role:seller)に入れないため、
     *   出品もする会員には作成時に必ず seller を付ける。
     *
     * @var array<string, array<int, string>>
     */
    private const MEMBER_TYPE_ROLES = [
        'buyer'  => ['participant'],
        'seller' => ['seller', 'participant'],
    ];

    /**
     * @param array{name: string, email: string, member_type?: string, is_test?: bool} $data
     * @return array{user: User, verification_url: string}
     */
    public function execute(array $data): array
    {
        $memberType = $data['member_type'] ?? 'buyer';
        $roleNames  = self::MEMBER_TYPE_ROLES[$memberType] ?? self::MEMBER_TYPE_ROLES['buyer'];
        $isSeller   = in_array('seller', $roleNames, true);

        return DB::transaction(function () use ($data, $roleNames, $isSeller) {
            $user = User::create([
                'name'        => $data['name'],
                'email'       => $data['email'],
                'password'    => Hash::make(Str::random(32)), // 一時パスワード（本人が設定メールで再設定）
                'status'      => 'approved',                  // 契約締結済み = 承認済み
                'is_active'   => true,
                'is_test'     => (bool) ($data['is_test'] ?? false),
                'approved_at' => now(),
                'approved_by' => null,                        // システム（E-NE連携）発行
            ]);

            foreach ($roleNames as $roleName) {
                $role = Role::where('name', $roleName)->first();
                if ($role) {
                    $user->roles()->attach($role->id, [
                        'assigned_at' => now(),
                        'assigned_by' => null,
                    ]);
                }
            }

            // 出品者は SellerProfile も用意（管理者作成・出品者登録と同型、is_active=false）
            if ($isSeller) {
                SellerProfile::create([
                    'user_id'       => $user->id,
                    'seller_code'   => 'S' . str_pad((SellerProfile::max('id') ?? 0) + 1, 6, '0', STR_PAD_LEFT),
                    'seller_name'   => $user->trade_name ?? $user->name,
                    'corporate_name' => $user->company_name,
                    'contact_name'  => $user->name,
                    'email'         => $user->email,
                    'phone'         => $user->phone ?? '',
                    'postal_code'   => $user->postal_code,
                    'prefecture'    => $user->prefecture,
                    'city'          => $user->city,
                    'address_line1' => $user->address_line1,
                    'address_line2' => $user->address_line2,
                    'is_active'     => false,
                ]);
            }

            // パスワード設定トークン（7日有効）＋ メール送信
            $token = Str::random(64);
            EmailVerificationToken::create([
                'user_id'    => $user->id,
                'token'      => $token,
                'expires_at' => now()->addDays(7),
            ]);

            $verificationUrl = config('app.frontend_url') . '/auth/set-password?token=' . $token;
            Mail::to($user->email)->send(new SetPasswordMail($user, $verificationUrl));

            return ['user' => $user, 'verification_url' => $verificationUrl];
        });
    }
}
