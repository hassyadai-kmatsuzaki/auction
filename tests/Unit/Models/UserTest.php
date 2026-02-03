<?php

namespace Tests\Unit\Models;

use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

class UserTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_user_can_be_created(): void
    {
        $user = User::factory()->create();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
        ]);
    }

    public function test_user_has_roles_relationship(): void
    {
        $user = User::factory()->create();

        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Collection::class, $user->roles);
    }

    public function test_user_can_have_admin_role(): void
    {
        $user = $this->createAdmin();

        $this->assertTrue($user->roles->contains('name', 'admin'));
    }

    public function test_user_can_have_seller_role(): void
    {
        $user = $this->createSeller();

        $this->assertTrue($user->roles->contains('name', 'seller'));
    }

    public function test_user_can_have_participant_role(): void
    {
        $user = $this->createParticipant();

        $this->assertTrue($user->roles->contains('name', 'participant'));
    }

    public function test_has_role_method_returns_true_for_assigned_role(): void
    {
        $user = $this->createAdmin();

        $this->assertTrue($user->hasRole('admin'));
    }

    public function test_has_role_method_returns_false_for_unassigned_role(): void
    {
        $user = $this->createParticipant();

        $this->assertFalse($user->hasRole('admin'));
    }

    public function test_user_email_must_be_unique(): void
    {
        $email = 'unique@example.com';
        User::factory()->create(['email' => $email]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        User::factory()->create(['email' => $email]);
    }

    public function test_unverified_user_can_be_created(): void
    {
        $user = User::factory()->unverified()->create();

        $this->assertNull($user->email_verified_at);
    }

    public function test_verified_user_has_email_verified_at(): void
    {
        $user = User::factory()->create();

        $this->assertNotNull($user->email_verified_at);
    }
}
