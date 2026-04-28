<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Tests\TestCase;

/**
 * TutorialController のテスト。
 *
 * - GET  /api/tutorials       認証必須・ロール別の固定リスト
 * - POST /api/tutorials/complete   完了ステップを notification_settings に追記
 *
 * 既存の MiscEndpointsTest の薄いカバレッジに加え、認可・ロール分岐・完了の冪等性を見る。
 */
class TutorialTest extends TestCase
{
    private User $participant;
    private User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
        $this->seller = $this->createSeller();
    }

    public function test_index_は_未認証で401(): void
    {
        $this->getJson('/api/tutorials')->assertStatus(401);
    }

    public function test_index_は_participant_用ステップを返す(): void
    {
        $r = $this->actingAs($this->participant, 'sanctum')->getJson('/api/tutorials?role=participant');
        $r->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains('p_welcome', $ids);
        $this->assertContains('p_won_items', $ids);
    }

    public function test_index_は_seller_role指定でseller用ステップを返す(): void
    {
        $r = $this->actingAs($this->seller, 'sanctum')->getJson('/api/tutorials?role=seller');
        $r->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains('s_welcome', $ids);
        $this->assertNotContains('p_welcome', $ids);
    }

    public function test_index_は_admin_role指定でadmin用ステップを返す(): void
    {
        $admin = $this->createAdmin();
        $r = $this->actingAs($admin, 'sanctum')->getJson('/api/tutorials?role=admin');
        $r->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains('a_dashboard', $ids);
    }

    public function test_index_は_完了済みステップにcompleted_trueを付与する(): void
    {
        $this->participant->update([
            'notification_settings' => ['completed_tutorials' => ['p_welcome']],
        ]);

        $r = $this->actingAs($this->participant, 'sanctum')->getJson('/api/tutorials?role=participant');
        $r->assertOk();
        $welcome = collect($r->json('data'))->firstWhere('id', 'p_welcome');
        $this->assertTrue($welcome['completed']);
    }

    public function test_complete_は_未認証で401(): void
    {
        $this->postJson('/api/tutorials/complete', ['step_id' => 'p_welcome'])->assertStatus(401);
    }

    public function test_complete_は_step_id必須で422(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/tutorials/complete', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['step_id']);
    }

    public function test_complete_は_重複呼び出しでも完了配列に1度だけ追加される(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/tutorials/complete', ['step_id' => 'p_live'])
            ->assertOk();
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/tutorials/complete', ['step_id' => 'p_live'])
            ->assertOk();

        $settings = $this->participant->fresh()->notification_settings;
        $this->assertSame(1, count(array_filter(
            $settings['completed_tutorials'] ?? [],
            fn ($v) => $v === 'p_live'
        )));
    }
}
