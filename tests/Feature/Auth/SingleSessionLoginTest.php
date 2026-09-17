<?php

namespace Tests\Feature\Auth;

use App\Mail\OtherDeviceLoggedInMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * 多重ログイン抑止（EnforcesSingleSession）の Feature テスト。
 *
 * 同じアカウントに 30 分以内のログイン情報が残っていると 409 ALREADY_LOGGED_IN を返し、
 * 画面は「他の端末でログイン中です」の確認を出してから force_logout_others=true で送り直す。
 * 続行すると他端末のログイン情報を全部消し、本人宛に通知メールを送る。
 *
 * 2026-09-16: 9/20 の会場で「携帯で見ていた人が別の端末で入り直す」たびに通る経路なので、
 *   本番反映（feature/0916）にあたって挙動を固定する。
 */
class SingleSessionLoginTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function approvedUser(): User
    {
        return User::factory()->create([
            'password' => bcrypt('password123'),
            'status'   => 'approved',
            'is_active' => true,
        ]);
    }

    private function login(User $user, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/login', array_merge([
            'email'    => $user->email,
            'password' => 'password123',
        ], $extra));
    }

    private function ageTokens(User $user, int $minutes): void
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_id', $user->id)
            ->update(['created_at' => now()->subMinutes($minutes), 'last_used_at' => now()->subMinutes($minutes)]);
    }

    public function test_ログイン情報が無ければ普通に入れる(): void
    {
        $user = $this->approvedUser();

        $this->login($user)
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['token']]);

        $this->assertSame(1, $user->tokens()->count());
        Mail::assertNothingQueued();
    }

    public function test_他の端末のログイン情報が生きていると409を返す(): void
    {
        $user = $this->approvedUser();
        $user->createToken('auth-token');

        $res = $this->login($user);

        $res->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'ALREADY_LOGGED_IN')
            ->assertJsonPath('data.user_id', $user->id);
        $this->assertStringContainsString('他の端末', $res->json('message'));

        // 409 のときは新しいログイン情報を発行しない（増えていない）
        $this->assertSame(1, $user->tokens()->count());
        Mail::assertNothingQueued();
    }

    public function test_続行すると他端末が消えて通知メールが飛ぶ(): void
    {
        $user = $this->approvedUser();
        $user->createToken('auth-token');
        $user->createToken('auth-token');
        $this->assertSame(2, $user->tokens()->count());

        $this->login($user, ['force_logout_others' => true])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        // 旧 2 本が消えて、新しい 1 本だけが残る
        $this->assertSame(1, $user->tokens()->count());

        Mail::assertQueued(OtherDeviceLoggedInMail::class, function ($mail) use ($user) {
            return $mail->hasTo($user->email);
        });
    }

    public function test_30分より古いログイン情報は邪魔しない(): void
    {
        $user = $this->approvedUser();
        $user->createToken('auth-token');
        $this->ageTokens($user, 31);

        $this->login($user)->assertStatus(200);

        // 古い方は消されないまま新しい 1 本が増える（続行を通っていないので通知も無い）
        $this->assertSame(2, $user->tokens()->count());
        Mail::assertNothingQueued();
    }

    public function test_30分以内に使われた情報は古くても邪魔する(): void
    {
        $user = $this->approvedUser();
        $user->createToken('auth-token');
        DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->update([
            'created_at'   => now()->subDays(3),   // 発行は 3 日前
            'last_used_at' => now()->subMinutes(5), // でも 5 分前に使われている
        ]);

        $this->login($user)->assertStatus(409)->assertJsonPath('code', 'ALREADY_LOGGED_IN');
    }

    public function test_別のアカウントには影響しない(): void
    {
        $a = $this->approvedUser();
        $b = $this->approvedUser();
        $a->createToken('auth-token');

        $this->login($b)->assertStatus(200);
        $this->assertSame(1, $a->tokens()->count());
        $this->assertSame(1, $b->tokens()->count());
    }

    public function test_続行しても他端末が居なければ通知は送らない(): void
    {
        $user = $this->approvedUser();

        $this->login($user, ['force_logout_others' => true])->assertStatus(200);

        $this->assertSame(1, $user->tokens()->count());
        Mail::assertNothingQueued();
    }

    public function test_パスワードが違えば409ではなく401(): void
    {
        $user = $this->approvedUser();
        $user->createToken('auth-token');

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])
            ->assertStatus(401);

        Mail::assertNothingQueued();
    }
}
