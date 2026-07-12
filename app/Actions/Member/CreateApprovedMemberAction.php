<?php

namespace App\Actions\Member;

use App\Mail\SetPasswordMail;
use App\Models\EmailVerificationToken;
use App\Models\LineAccount;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\LineFlexBuilder;
use App\Services\LineService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * 承認済み会員を作成し、パスワード設定案内を送る。
 *
 * 管理画面のユーザー作成（Admin\UserController::store）と同じ流儀:
 *   status='approved' の会員を作成 → ロール付与 → 一時パスワード → パスワード設定案内。
 *
 * E-NE 契約締結 Webhook（システム発行, approved_by=null）から利用する。
 *   - line_user_id があれば LineAccount を直接作成（連携済みの体）＋ 設定案内を LINE Flex で送る。
 *   - line_user_id が無ければ従来どおり SetPasswordMail をメール送信する。
 *
 * 「入札/出品の実権限」はプラン(サブスク)で決まり、本Actionはサブスクを作らない。
 * 会員はログイン後に決済画面で従来どおりプランに加入する。
 */
class CreateApprovedMemberAction
{
    public function __construct(
        private readonly LineService $lineService,
        private readonly LineFlexBuilder $flexBuilder,
    ) {
    }

    /**
     * 会員種別 → 付与ロール のマッピング。
     *
     * ⚠ seller ロールが無いと出品系ルート(check.role:seller)に入れないため、
     *   出品もする会員には作成時に必ず seller を付ける。
     *
     * one_day はロール的には buyer と同一（participant のみ）。違いは
     * intended_plan_code='one_day' が付き、決済モーダルに1Dayプランのみが
     * 提示されること（1Day会員_実装方針書_20260710.md §3.8）。
     *
     * @var array<string, array<int, string>>
     */
    private const MEMBER_TYPE_ROLES = [
        'buyer'   => ['participant'],
        'seller'  => ['seller', 'participant'],
        'one_day' => ['participant'],
    ];

    /**
     * @param array{name: string, email: string, phone?: ?string, member_type?: string, is_test?: bool, line_user_id?: ?string, line_display_name?: ?string} $data
     * @return array{user: User, verification_url: string}
     */
    public function execute(array $data): array
    {
        $memberType = $data['member_type'] ?? 'buyer';
        $roleNames  = self::MEMBER_TYPE_ROLES[$memberType] ?? self::MEMBER_TYPE_ROLES['buyer'];
        $isSeller   = in_array('seller', $roleNames, true);
        $lineUserId = $data['line_user_id'] ?? null;

        // DB 書き込みはトランザクション内で完結させる。
        // 通知（LINE/メール）は外部 I/O なので commit 後に best-effort で行う
        //  → 通知が落ちても承認済み会員は残す（取りこぼし防止。再送は運用でカバー）。
        ['user' => $user, 'verification_url' => $verificationUrl] =
            DB::transaction(function () use ($data, $roleNames, $isSeller, $lineUserId) {
            $user = User::create([
                'name'        => $data['name'],
                'email'       => $data['email'],
                'phone'       => $data['phone'] ?? null,      // E-NE から取得（任意。正規化済み）
                'password'    => Hash::make(Str::random(32)), // 一時パスワード（本人が設定メールで再設定）
                'status'      => 'approved',                  // 契約締結済み = 承認済み
                'is_active'   => true,
                'is_test'     => (bool) ($data['is_test'] ?? false),
                'approved_at' => now(),
                'approved_by' => null,                        // システム（E-NE連携）発行
                // 1Day契約は加入予定プランを固定（決済モーダルに1Dayのみ提示。決済完了で自動解除）
                'intended_plan_code' => ($data['member_type'] ?? null) === 'one_day' ? 'one_day' : null,
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

            // LINE 連携済みの体にする（OAuth を経ずに line_user_id を直接紐付け）。
            // 別ユーザーに紐付く line_user_id は unique 制約に触れるため、その場合はスキップ。
            if ($lineUserId) {
                $takenByOther = LineAccount::where('line_user_id', $lineUserId)
                    ->where('user_id', '!=', $user->id)
                    ->exists();
                if ($takenByOther) {
                    Log::warning('CreateApprovedMember: line_user_id already linked to another user', [
                        'user_id' => $user->id,
                    ]);
                } else {
                    LineAccount::updateOrCreate(
                        ['user_id' => $user->id],
                        [
                            'line_user_id' => $lineUserId,
                            'display_name' => $data['line_display_name'] ?? $user->name,
                            'is_active'    => true,
                            'linked_at'    => now(),
                        ],
                    );
                }
            }

            // パスワード設定トークン（7日有効）
            $token = Str::random(64);
            EmailVerificationToken::create([
                'user_id'    => $user->id,
                'token'      => $token,
                'expires_at' => now()->addDays(7),
            ]);

            $verificationUrl = config('app.frontend_url') . '/auth/set-password?token=' . $token;

            return ['user' => $user, 'verification_url' => $verificationUrl];
        });

        // commit 後にパスワード設定案内を送る（LINE 優先、無ければメール）
        $this->sendPasswordSetupNotice($user, $verificationUrl, $lineUserId);

        return ['user' => $user, 'verification_url' => $verificationUrl];
    }

    /**
     * パスワード設定案内の送信。
     *   line_user_id あり → LINE Flex（本人選択によりメールは併用しない）。失敗はログのみ。
     *   line_user_id なし → SetPasswordMail をメール送信。
     */
    private function sendPasswordSetupNotice(User $user, string $verificationUrl, ?string $lineUserId): void
    {
        if ($lineUserId) {
            try {
                $flex = $this->flexBuilder->setPasswordInvite($user->name, $verificationUrl);
                $ok   = $this->lineService->pushFlex($lineUserId, 'パスワードを設定してください', $flex);
                if (!$ok) {
                    Log::error('CreateApprovedMember: LINE push returned false', ['user_id' => $user->id]);
                }
            } catch (\Throwable $e) {
                Log::error('CreateApprovedMember: LINE push failed', [
                    'user_id' => $user->id,
                    'error'   => $e->getMessage(),
                ]);
            }
            return;
        }

        Mail::to($user->email)->send(new SetPasswordMail($user, $verificationUrl));
    }
}
