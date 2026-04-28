<?php

namespace Tests\Feature\Admin;

use App\Models\PackingMaterial;
use App\Models\ShippingRate;
use App\Models\User;
use Tests\TestCase;

/**
 * Admin/ShippingRateController のテスト。
 *
 * - GET /api/admin/shipping-master       (index)
 * - PUT /api/admin/shipping-master/rates (updateRates)
 * - PUT /api/admin/shipping-master/packing-materials (updatePackingMaterials)
 *
 * ShippingRate / PackingMaterial / BagSpec / BoxSpec はマイグレーション側でシード済み。
 */
class ShippingRateTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
    }

    public function test_index_returns_master_data_matrix(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/shipping-master');

        $r->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'shipping_rates',
                    'packing_materials',
                    'bag_specs',
                    'box_specs',
                ],
            ]);

        // 関東 80 サイズの送料が seed 値で取得できる
        $this->assertSame(704, $r->json('data.shipping_rates.関東.80'));
    }

    public function test_update_rates_creates_or_updates_rows(): void
    {
        $payload = [
            'rates' => [
                ['region' => '関東',   'box_size' => 80,  'rate' => 999],
                ['region' => 'テスト', 'box_size' => 100, 'rate' => 1234],
            ],
        ];

        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/shipping-master/rates', $payload);

        $r->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSame(999, ShippingRate::where('region', '関東')->where('box_size', 80)->value('rate'));
        $this->assertSame(1234, ShippingRate::where('region', 'テスト')->where('box_size', 100)->value('rate'));
    }

    public function test_update_rates_validates_box_size(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/shipping-master/rates', [
                'rates' => [
                    ['region' => '関東', 'box_size' => 999, 'rate' => 100],
                ],
            ]);

        $r->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_update_rates_rejects_negative_rate(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/shipping-master/rates', [
                'rates' => [
                    ['region' => '関東', 'box_size' => 80, 'rate' => -1],
                ],
            ]);

        $r->assertStatus(422);
    }

    public function test_update_rates_requires_array(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/shipping-master/rates', []);

        $r->assertStatus(422);
    }

    public function test_update_packing_materials_persists_costs(): void
    {
        $payload = [
            'materials' => [
                ['box_size' => 80,  'styrofoam_cost' => 500, 'bag_material_cost' => 70, 'coolant_cost' => 0],
                ['box_size' => 140, 'styrofoam_cost' => 800, 'bag_material_cost' => 90, 'coolant_cost' => 100],
            ],
        ];

        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/shipping-master/packing-materials', $payload);

        $r->assertOk()
            ->assertJsonPath('success', true);

        $row = PackingMaterial::where('box_size', 80)->first();
        $this->assertSame(500, $row->styrofoam_cost);
        $this->assertSame(70, $row->bag_material_cost);

        $row140 = PackingMaterial::where('box_size', 140)->first();
        $this->assertSame(100, $row140->coolant_cost);
    }

    public function test_update_packing_materials_validates_box_size(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/shipping-master/packing-materials', [
                'materials' => [
                    ['box_size' => 60, 'styrofoam_cost' => 100, 'bag_material_cost' => 50, 'coolant_cost' => 0],
                ],
            ]);

        $r->assertStatus(422);
    }

    public function test_seller_cannot_access_shipping_master(): void
    {
        $seller = $this->createSeller();
        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/admin/shipping-master')
            ->assertStatus(403);
    }

    public function test_unauthenticated_cannot_update_rates(): void
    {
        $this->putJson('/api/admin/shipping-master/rates', ['rates' => []])
            ->assertStatus(401);
    }
}
