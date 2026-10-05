<?php

namespace Tests\Feature;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use Tests\TestCase;

/**
 * F-010 生体の詳細項目（性別・親魚・飼育環境）
 */
class ItemDetailFieldsTest extends TestCase
{
    private const DETAIL = ['sex' => 'pair', 'parent_fish_info' => '父 楊貴妃F5 / 母 楊貴妃F5', 'breeding_environment' => '屋外'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_admin_create_update_show_when_feature_on(): void
    {
        config(['features.item_detail_fields' => true]);
        $admin = $this->createAdmin();
        $auction = Auction::factory()->create(['created_by' => $admin->id]);

        $id = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/auctions/{$auction->id}/items", [
            'species_name' => '楊貴妃', 'quantity' => 1, 'start_price' => 1000,
        ] + self::DETAIL)->assertStatus(201)->json('data.item.id') ?? Item::latest('id')->value('id');

        $item = Item::find($id);
        $this->assertSame('pair', $item->sex);
        $this->assertSame(['text' => '屋外'], $item->breeding_environment);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/auctions/{$auction->id}/items/{$id}", [
            'sex' => 'male', 'parent_fish_info' => '',
        ])->assertOk();
        $item->refresh();
        $this->assertSame('male', $item->sex);
        $this->assertNull($item->parent_fish_info);
        $this->assertSame(['text' => '屋外'], $item->breeding_environment); // 送っていない項目は変えない

        $this->actingAs($admin, 'sanctum')->getJson("/api/admin/auctions/{$auction->id}/items/{$id}")
            ->assertOk()
            ->assertJsonPath('data.item.sex', 'male')
            ->assertJsonPath('data.item.breeding_environment', '屋外');
    }

    public function test_invalid_sex_is_rejected(): void
    {
        config(['features.item_detail_fields' => true]);
        $admin = $this->createAdmin();
        $auction = Auction::factory()->create(['created_by' => $admin->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/auctions/{$auction->id}/items", [
            'species_name' => '楊貴妃', 'quantity' => 1, 'start_price' => 1000, 'sex' => 'unknown',
        ])->assertStatus(422);
    }

    public function test_seller_submission_saves_fields_when_on(): void
    {
        config(['features.item_detail_fields' => true]);
        $seller = $this->createSellerWithSubscription();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->scheduled()->create();

        $this->actingAs($seller, 'sanctum')->postJson('/api/seller/items', [
            'auction_id' => $auction->id, 'species_name' => '幹之', 'quantity' => 1, 'start_price' => 100,
        ] + self::DETAIL)->assertStatus(201);

        $item = Item::where('seller_profile_id', $profile->id)->latest('id')->first();
        $this->assertSame('pair', $item->sex);
        $this->assertSame(['text' => '父 楊貴妃F5 / 母 楊貴妃F5'], $item->parent_fish_info);
    }

    public function test_fields_are_ignored_and_hidden_when_feature_off(): void
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->create(['created_by' => $admin->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/auctions/{$auction->id}/items", [
            'species_name' => '楊貴妃', 'quantity' => 1, 'start_price' => 1000,
        ] + self::DETAIL)->assertStatus(201);
        $item = Item::latest('id')->first();
        $this->assertNull($item->sex);

        $this->actingAs($admin, 'sanctum')->getJson("/api/admin/auctions/{$auction->id}/items/{$item->id}")
            ->assertOk()
            ->assertJsonMissingPath('data.item.sex');
    }
}
