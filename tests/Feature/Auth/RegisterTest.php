<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    private function getValidRegistrationData(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'phone' => '090-1234-5678',
            'postal_code' => '123-4567',
            'prefecture' => '東京都',
            'city' => '渋谷区',
            'address_line1' => '渋谷1-2-3',
        ], $overrides);
    }

    public function test_user_can_register_as_participant(): void
    {
        $response = $this->postJson('/api/auth/register', $this->getValidRegistrationData());

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
        ]);
    }

    public function test_user_can_register_with_full_data(): void
    {
        $response = $this->postJson('/api/auth/register', $this->getValidRegistrationData([
            'email' => 'full@example.com',
            'address_line2' => 'ビル4F',
        ]));

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'email' => 'full@example.com',
        ]);
    }

    public function test_registration_requires_name(): void
    {
        $data = $this->getValidRegistrationData();
        unset($data['name']);

        $response = $this->postJson('/api/auth/register', $data);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_registration_requires_valid_email(): void
    {
        $response = $this->postJson('/api/auth/register', $this->getValidRegistrationData([
            'email' => 'invalid-email',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_registration_requires_unique_email(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/auth/register', $this->getValidRegistrationData([
            'email' => 'existing@example.com',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_registration_requires_password_confirmation(): void
    {
        $response = $this->postJson('/api/auth/register', $this->getValidRegistrationData([
            'password_confirmation' => 'different',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_registration_requires_minimum_password_length(): void
    {
        $response = $this->postJson('/api/auth/register', $this->getValidRegistrationData([
            'password' => 'short',
            'password_confirmation' => 'short',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_registration_requires_phone(): void
    {
        $data = $this->getValidRegistrationData(['email' => 'phone@example.com']);
        unset($data['phone']);

        $response = $this->postJson('/api/auth/register', $data);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_registration_requires_address_fields(): void
    {
        $data = $this->getValidRegistrationData(['email' => 'address@example.com']);
        unset($data['postal_code']);
        unset($data['prefecture']);
        unset($data['city']);
        unset($data['address_line1']);

        $response = $this->postJson('/api/auth/register', $data);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['postal_code', 'prefecture', 'city', 'address_line1']);
    }
}
