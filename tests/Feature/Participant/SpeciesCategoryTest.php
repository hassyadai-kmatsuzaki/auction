<?php

namespace Tests\Feature\Participant;

use App\Models\SpeciesName;
use Tests\TestCase;

/**
 * F-013 出品一覧のカテゴリ（品種名マスタ）
 */
class SpeciesCategoryTest extends TestCase
{
    public function test_returns_active_master_names_in_order_only_when_feature_on(): void
    {
        $this->seedRoles();
        $user = $this->createParticipant();
        SpeciesName::create(['name' => '幹之', 'sort_order' => 2, 'is_active' => true]);
        SpeciesName::create(['name' => '楊貴妃', 'sort_order' => 1, 'is_active' => true]);
        SpeciesName::create(['name' => '廃番', 'sort_order' => 0, 'is_active' => false]);

        $this->actingAs($user, 'sanctum')->getJson('/api/participant/species-categories')->assertStatus(404);

        config(['features.item_category' => true]);
        $this->actingAs($user, 'sanctum')->getJson('/api/participant/species-categories')
            ->assertOk()
            ->assertExactJson(['success' => true, 'data' => ['楊貴妃', '幹之']]);
    }
}
