<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityEvent;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UserTest extends TestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_admin_can_list_users(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/users');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data', // Laravel paginator structure
                ],
            ]);
    }

    public function test_admin_can_filter_users_by_role(): void
    {
        $this->createSeller();
        $this->createParticipant();

        // Filter sellers
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/users?role=seller');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_admin_can_view_user_detail(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/users/{$seller->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user' => ['id', 'name', 'email'],
                ],
            ]);
    }

    public function test_admin_can_create_seller(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テスト出品者',
                'email' => 'testseller@example.com',
                'roles' => ['seller'],
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'email' => 'testseller@example.com',
        ]);
    }

    public function test_admin_can_create_buyer(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テスト買受者',
                'email' => 'testbuyer@example.com',
                'roles' => ['participant'],
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'email' => 'testbuyer@example.com',
        ]);
    }

    public function test_admin_can_update_user(): void
    {
        $seller = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/users/{$seller->id}", [
                'name' => '更新された名前',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('users', [
            'id' => $seller->id,
            'name' => '更新された名前',
        ]);
    }

    public function test_admin_can_delete_user(): void
    {
        $buyer = $this->createParticipant();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$buyer->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // Soft delete - check is_active is false
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id,
            'is_active' => false,
        ]);
    }

    public function test_suspending_user_revokes_tokens(): void
    {
        // ステータスはログイン時にしか見ないので、停止と同時にトークンを消してログイン中の端末を追い出す
        $buyer = $this->createParticipant();
        $plainToken = $buyer->createToken('auth-token')->plainTextToken;

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/users/{$buyer->id}", ['status' => 'suspended'])
            ->assertStatus(200);

        $this->assertSame(0, $buyer->tokens()->count());

        // 停止前のトークンでは API を使えない
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$plainToken}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    public function test_adding_seller_role_to_approved_user_creates_active_seller_profile(): void
    {
        // 2026-10-08: ロール追加だけだと seller_profiles が無く、出品者一覧（一括インポート）に出なかった
        $buyer = $this->createParticipant();
        $this->assertNull(SellerProfile::where('user_id', $buyer->id)->first());

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/users/{$buyer->id}", ['roles' => ['participant', 'seller']])
            ->assertStatus(200);

        $profile = SellerProfile::where('user_id', $buyer->id)->first();
        $this->assertNotNull($profile);
        $this->assertTrue((bool) $profile->is_active);

        // 出品者一覧 API に載る
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/sellers/list')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $profile->id, 'seller_code' => $profile->seller_code]);
    }

    public function test_adding_seller_role_reactivates_inactive_seller_profile(): void
    {
        $buyer = $this->createParticipant();
        $profile = SellerProfile::factory()->create(['user_id' => $buyer->id, 'is_active' => false]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/users/{$buyer->id}", ['roles' => ['participant', 'seller']])
            ->assertStatus(200);

        $this->assertTrue((bool) $profile->fresh()->is_active);
        $this->assertSame(1, SellerProfile::where('user_id', $buyer->id)->count());
    }

    public function test_updating_user_without_losing_access_keeps_tokens(): void
    {
        $buyer = $this->createParticipant();
        $buyer->createToken('auth-token');

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/users/{$buyer->id}", ['name' => '更新された名前', 'status' => 'approved'])
            ->assertStatus(200);

        $this->assertSame(1, $buyer->tokens()->count());
    }

    public function test_deleting_user_revokes_tokens(): void
    {
        $buyer = $this->createParticipant();
        $buyer->createToken('auth-token');

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$buyer->id}")
            ->assertStatus(200);

        $this->assertSame(0, $buyer->tokens()->count());
    }

    public function test_user_creation_requires_email(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テストユーザー',
                'roles' => ['participant'],
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_creation_requires_roles(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'テストユーザー',
                'email' => 'test@example.com',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['roles']);
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $seller = $this->createSeller();

        $response = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/admin/users');

        // Admin middleware should reject non-admin users
        $response->assertStatus(403);
    }

    public function test_admin_can_restore_deleted_user(): void
    {
        $buyer = $this->createParticipant();

        // まず削除
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$buyer->id}");

        // 削除されたことを確認
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id,
            'is_active' => false,
        ]);

        // 復元
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/users/{$buyer->id}/restore");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // 復元されたことを確認
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id,
            'is_active' => true,
        ]);
    }

    public function test_admin_can_search_users(): void
    {
        User::factory()->create(['name' => '検索対象ユーザー']);
        User::factory()->create(['name' => '別のユーザー']);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/users?search=検索対象');

        $response->assertStatus(200);
    }

    public function test_admin_can_view_login_history(): void
    {
        $participant = $this->createParticipant();
        $other = $this->createParticipant();

        $this->insertLoginEvent($participant->id, '2026-08-01 10:00:00', '203.0.113.10', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1');
        $this->insertLoginEvent($participant->id, '2026-08-03 09:30:00', '203.0.113.11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36');
        // 別ユーザーのログインは混ざらない
        $this->insertLoginEvent($other->id, '2026-08-02 12:00:00', '203.0.113.20', 'Mozilla/5.0');
        // ログイン以外のイベントも混ざらない
        DB::table('activity_events')->insert([
            'user_id' => $participant->id,
            'event_type' => ActivityEvent::ITEM_VIEW,
            'created_at' => '2026-08-04 08:00:00',
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/users/{$participant->id}/login-history");

        $response->assertStatus(200)
            ->assertJsonPath('data.total', 2)
            ->assertJsonCount(2, 'data.history')
            // 新しい順
            ->assertJsonPath('data.history.0.ip_address', '203.0.113.11')
            ->assertJsonPath('data.history.0.device', 'Windows / Chrome')
            ->assertJsonPath('data.history.1.ip_address', '203.0.113.10')
            ->assertJsonPath('data.history.1.device', 'iPhone / Safari');
    }

    public function test_login_history_respects_limit(): void
    {
        $participant = $this->createParticipant();

        foreach (range(1, 5) as $i) {
            $this->insertLoginEvent($participant->id, sprintf('2026-08-%02d 10:00:00', $i), '203.0.113.1', 'Mozilla/5.0');
        }

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/users/{$participant->id}/login-history?limit=2");

        $response->assertStatus(200)
            ->assertJsonPath('data.total', 5)
            ->assertJsonCount(2, 'data.history');
    }

    public function test_participant_cannot_view_login_history(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson("/api/admin/users/{$participant->id}/login-history");

        $response->assertStatus(403);
    }

    private function insertLoginEvent(int $userId, string $createdAt, string $ip, string $userAgent): void
    {
        DB::table('activity_events')->insert([
            'user_id' => $userId,
            'event_type' => ActivityEvent::LOGIN,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'created_at' => $createdAt,
        ]);
    }
}
