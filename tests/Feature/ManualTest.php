<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * ManualController のテスト。
 *
 * - GET /api/manuals         認証必須・固定リスト
 * - GET /api/manuals/{id}    storage/app/manual/{file} を読む。ファイル無しならサンプル
 */
class ManualTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_index_は_未認証で401(): void
    {
        $this->getJson('/api/manuals')->assertStatus(401);
    }

    public function test_index_は_4種類のマニュアル一覧を返す(): void
    {
        $user = $this->createParticipant();
        $r = $this->actingAs($user, 'sanctum')->getJson('/api/manuals');
        $r->assertOk()->assertJsonStructure(['data' => ['manuals']]);

        $ids = collect($r->json('data.manuals'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing(
            ['operations', 'announcements', 'seller', 'participant'],
            $ids
        );
    }

    public function test_show_は_未認証で401(): void
    {
        $this->getJson('/api/manuals/operations')->assertStatus(401);
    }

    public function test_show_は_未知のIDで404(): void
    {
        $user = $this->createParticipant();
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/manuals/unknown-manual')
            ->assertStatus(404);
    }

    public function test_show_は_ファイル無しでサンプルコンテンツを返す(): void
    {
        // テスト時はマニュアルファイル未配置を前提（File::exists false）
        File::shouldReceive('exists')->andReturn(false);

        $user = $this->createSeller();
        $r = $this->actingAs($user, 'sanctum')->getJson('/api/manuals/seller');
        $r->assertOk()
            ->assertJsonPath('data.id', 'seller')
            ->assertJsonPath('data.is_sample', true);
        $this->assertNotEmpty($r->json('data.content'));
    }

    public function test_show_は_ファイル存在時に内容を返す(): void
    {
        File::shouldReceive('exists')->andReturn(true);
        File::shouldReceive('get')->andReturn('# 操作マニュアル本体');

        $user = $this->createAdmin();
        $r = $this->actingAs($user, 'sanctum')->getJson('/api/manuals/operations');
        $r->assertOk()
            ->assertJsonPath('data.id', 'operations')
            ->assertJsonPath('data.is_sample', false)
            ->assertJsonPath('data.content', '# 操作マニュアル本体');
    }
}
