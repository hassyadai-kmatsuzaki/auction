<?php

namespace Tests\Feature\Auth;

use App\Models\EmailVerificationToken;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class SetPasswordTest extends TestCase
{
    public function test_user_can_verify_valid_token(): void
    {
        $user = User::factory()->create([
            'password' => bcrypt('temporary'),
            'status' => 'pending',
        ]);

        $token = EmailVerificationToken::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'expires_at' => now()->addHours(24),
        ]);

        $response = $this->postJson('/api/auth/verify-token', [
            'token' => $token->token,
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user' => ['name', 'email'],
                ],
            ]);
    }

    public function test_verify_fails_with_invalid_token(): void
    {
        $response = $this->postJson('/api/auth/verify-token', [
            'token' => 'invalid-token',
        ]);

        $response->assertStatus(400)
            ->assertJson(['success' => false]);
    }

    public function test_verify_fails_with_expired_token(): void
    {
        $user = User::factory()->create(['status' => 'pending']);

        $token = EmailVerificationToken::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'expires_at' => now()->subHours(1), // 期限切れ
        ]);

        $response = $this->postJson('/api/auth/verify-token', [
            'token' => $token->token,
        ]);

        $response->assertStatus(400)
            ->assertJson(['success' => false]);
    }

    public function test_verify_fails_with_already_used_token(): void
    {
        $user = User::factory()->create(['status' => 'pending']);

        $token = EmailVerificationToken::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'expires_at' => now()->addHours(24),
            'verified_at' => now(), // 既に使用済み
        ]);

        $response = $this->postJson('/api/auth/verify-token', [
            'token' => $token->token,
        ]);

        $response->assertStatus(400)
            ->assertJson(['success' => false]);
    }

    public function test_user_can_set_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'password' => bcrypt('temporary'),
            'status' => 'pending',
        ]);

        $token = EmailVerificationToken::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'expires_at' => now()->addHours(24),
        ]);

        $response = $this->postJson('/api/auth/set-password', [
            'token' => $token->token,
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // ユーザーのステータスが approved に変更されたことを確認
        $user->refresh();
        $this->assertEquals('approved', $user->status);
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->password);

        // トークンが使用済みになったことを確認
        $token->refresh();
        $this->assertNotNull($token->verified_at);
    }

    public function test_set_password_fails_with_invalid_token(): void
    {
        $response = $this->postJson('/api/auth/set-password', [
            'token' => 'invalid-token',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(400)
            ->assertJson(['success' => false]);
    }

    public function test_set_password_requires_confirmation(): void
    {
        $user = User::factory()->create(['status' => 'pending']);

        $token = EmailVerificationToken::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'expires_at' => now()->addHours(24),
        ]);

        $response = $this->postJson('/api/auth/set-password', [
            'token' => $token->token,
            'password' => 'newpassword123',
            'password_confirmation' => 'differentpassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_set_password_requires_minimum_length(): void
    {
        $user = User::factory()->create(['status' => 'pending']);

        $token = EmailVerificationToken::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'expires_at' => now()->addHours(24),
        ]);

        $response = $this->postJson('/api/auth/set-password', [
            'token' => $token->token,
            'password' => 'short',
            'password_confirmation' => 'short',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }
}
