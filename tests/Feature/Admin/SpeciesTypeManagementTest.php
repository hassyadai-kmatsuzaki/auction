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
}
