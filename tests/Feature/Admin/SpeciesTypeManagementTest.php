<?php

namespace Tests\Feature\Admin;

use App\Models\SpeciesType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SpeciesTypeManagementTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function 管理者は種別一覧を取得できる(): void
    {
        $admin = $this->createAdmin();
        $res = $this->actingAs($admin)->getJson('/api/admin/masters/species-types');
        $res->assertOk()->assertJsonStructure(['data' => [['id', 'code', 'name', 'calculation_mode']]]);
    }

    /** @test */
    public function 管理者は種別を新規作成できる(): void
    {
        $admin = $this->createAdmin();
        $res = $this->actingAs($admin)->postJson('/api/admin/masters/species-types', [
            'code' => 'shrimp',
            'name' => 'エビ',
            'calculation_mode' => 'manual',
            'allowed_quantity_units' => ['fish', 'kg'],
            'is_active' => true,
            'sort_order' => 10,
        ]);
        $res->assertCreated();
        $this->assertDatabaseHas('species_types', ['code' => 'shrimp', 'name' => 'エビ']);
    }

    /** @test */
    public function is_default切替は既存のデフォルトを解除する(): void
    {
        $admin = $this->createAdmin();
        $goldfishId = (int) SpeciesType::where('code', 'goldfish')->value('id');

        $this->actingAs($admin)->patchJson("/api/admin/masters/species-types/{$goldfishId}", [
            'is_default' => true,
        ])->assertOk();

        $this->assertSame(1, SpeciesType::where('is_default', true)->count());
        $this->assertTrue(SpeciesType::find($goldfishId)->is_default);
        $this->assertFalse(SpeciesType::where('code', 'medaka')->first()->is_default);
    }

    /** @test */
    public function codeは保存後に変更不可(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();
        $this->actingAs($admin)->patchJson("/api/admin/masters/species-types/{$medaka->id}", [
            'code' => 'renamed',
            'name' => '改名テスト',
        ])->assertOk();
        $this->assertSame('medaka', SpeciesType::find($medaka->id)->code);
    }

    /** @test */
    public function destroyは論理削除_is_activeをfalseにする(): void
    {
        $admin = $this->createAdmin();
        $other = SpeciesType::where('code', 'other')->first();
        $this->actingAs($admin)->deleteJson("/api/admin/masters/species-types/{$other->id}")->assertOk();
        $this->assertFalse(SpeciesType::find($other->id)->is_active);
    }

    /** @test */
    public function 一般ユーザーはマスタAPIにアクセスできない(): void
    {
        $user = \App\Models\User::factory()->create();
        $this->actingAs($user)->getJson('/api/admin/masters/species-types')->assertForbidden();
    }

    /** @test */
    public function 出品者は有効な種別のみ取得できる(): void
    {
        $seller = $this->createSeller();
        // aquatic_plant はシード時 is_active=false なので除外されるはず
        $res = $this->actingAs($seller)->getJson('/api/seller/species-types');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->toArray();
        $this->assertContains('medaka', $codes);
        $this->assertContains('other', $codes);
        $this->assertNotContains('aquatic_plant', $codes);
    }

    protected function createSeller(): \App\Models\User
    {
        $role = \App\Models\Role::firstOrCreate(['name' => 'seller']);
        $user = \App\Models\User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }

    /** @test */
    public function showは種別とその配下マスタを返す(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();
        $res = $this->actingAs($admin)->getJson("/api/admin/masters/species-types/{$medaka->id}");
        $res->assertOk()->assertJsonStructure(['data']);
    }

    /** @test */
    public function reorderはsort_orderを一括更新する(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();
        $other = SpeciesType::where('code', 'other')->first();

        $this->actingAs($admin)->postJson('/api/admin/masters/species-types/reorder', [
            'orders' => [
                ['id' => $medaka->id, 'sort_order' => 99],
                ['id' => $other->id, 'sort_order' => 0],
            ],
        ])->assertOk();

        $this->assertSame(99, (int) SpeciesType::find($medaka->id)->sort_order);
        $this->assertSame(0, (int) SpeciesType::find($other->id)->sort_order);
    }

    /** @test */
    public function bag_specs_CRUD_が動く(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();

        // index
        $this->actingAs($admin)
            ->getJson("/api/admin/masters/species-types/{$medaka->id}/bag-specs")
            ->assertOk();

        // store（既存と被らないユニークなサイズ）
        $stored = $this->actingAs($admin)
            ->postJson("/api/admin/masters/species-types/{$medaka->id}/bag-specs", [
                'bag_size' => 'XX',
                'min_qty' => 1,
                'max_qty' => 5,
                'weight_kg' => 0.4,
            ])->assertCreated();
        $bagId = $stored->json('data.id');

        // 同じ bag_size を再 store → 409
        $this->actingAs($admin)
            ->postJson("/api/admin/masters/species-types/{$medaka->id}/bag-specs", [
                'bag_size' => 'XX', 'min_qty' => 1, 'weight_kg' => 0.4,
            ])->assertStatus(409);

        // update
        $this->actingAs($admin)
            ->patchJson("/api/admin/masters/species-types/{$medaka->id}/bag-specs/{$bagId}", [
                'weight_kg' => 0.5,
            ])->assertOk();

        // destroy
        $this->actingAs($admin)
            ->deleteJson("/api/admin/masters/species-types/{$medaka->id}/bag-specs/{$bagId}")
            ->assertOk();
        $this->assertDatabaseMissing('bag_specs', ['id' => $bagId]);
    }

    /** @test */
    public function bag_specs_storeはvalidationを返す(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();

        $this->actingAs($admin)
            ->postJson("/api/admin/masters/species-types/{$medaka->id}/bag-specs", [])
            ->assertStatus(422);
    }

    /** @test */
    public function box_capacities_upsert_と_destroy(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();

        // index
        $this->actingAs($admin)
            ->getJson("/api/admin/masters/species-types/{$medaka->id}/box-capacities")
            ->assertOk();

        // upsert
        $this->actingAs($admin)
            ->putJson("/api/admin/masters/species-types/{$medaka->id}/box-capacities", [
                'capacities' => [
                    ['box_size' => 80, 'bag_size' => 'XX', 'max_count' => 6],
                ],
            ])->assertOk();

        $cap = \App\Models\BoxCapacity::where('species_type_id', $medaka->id)
            ->where('bag_size', 'XX')->first();
        $this->assertSame(6, (int) $cap->max_count);

        // 再 upsert で値更新
        $this->actingAs($admin)
            ->putJson("/api/admin/masters/species-types/{$medaka->id}/box-capacities", [
                'capacities' => [
                    ['box_size' => 80, 'bag_size' => 'XX', 'max_count' => 12],
                ],
            ])->assertOk();
        $this->assertSame(12, (int) $cap->fresh()->max_count);

        // destroy
        $this->actingAs($admin)
            ->deleteJson("/api/admin/masters/species-types/{$medaka->id}/box-capacities/{$cap->id}")
            ->assertOk();
    }

    /** @test */
    public function mix_restrictions_CRUD(): void
    {
        $admin = $this->createAdmin();
        $medaka = SpeciesType::where('code', 'medaka')->first();

        $this->actingAs($admin)
            ->getJson("/api/admin/masters/species-types/{$medaka->id}/mix-restrictions")
            ->assertOk();

        $stored = $this->actingAs($admin)
            ->postJson("/api/admin/masters/species-types/{$medaka->id}/mix-restrictions", [
                'box_size' => 100,
                'bag_size_a' => 'A',
                'bag_size_b' => 'B',
            ])->assertCreated();
        $rowId = $stored->json('data.id');

        // bag_size_a == bag_size_b は弾かれる
        $this->actingAs($admin)
            ->postJson("/api/admin/masters/species-types/{$medaka->id}/mix-restrictions", [
                'box_size' => 100,
                'bag_size_a' => 'A',
                'bag_size_b' => 'A',
            ])->assertStatus(422);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/masters/species-types/{$medaka->id}/mix-restrictions/{$rowId}")
            ->assertOk();
    }
}
