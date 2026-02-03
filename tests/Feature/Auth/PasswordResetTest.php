<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    public function test_user_can_request_password_reset_link(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/password/email', [
            'email' => $user->email,
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_password_reset_request_requires_valid_email(): void
    {
        $response = $this->postJson('/api/password/email', [
            'email' => 'invalid-email',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_password_reset_request_accepts_nonexistent_email(): void
    {
        // セキュリティ上、存在しないメールでも成功を返す
        $response = $this->postJson('/api/password/email', [
            'email' => 'nonexistent@example.com',
        ]);

        // 実装によっては200または422
        $response->assertStatus(200);
    }
}
