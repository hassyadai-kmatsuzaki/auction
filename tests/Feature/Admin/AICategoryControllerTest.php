<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AICategoryControllerTest extends TestCase
{
    private User $admin;
    private Auction $auction;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Cache::flush();
        config(['services.openai.api_key' => '']);
        Http::fake();

        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
    }

    private function makeItem(string $species, array $overrides = []): Item
    {
        return Item::factory()->create(array_merge([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => $species,
        ], $overrides));
    }

    public function test_classify_returns_category_for_text(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai/categories/classify', ['species_name' => '紅白', 'description' => 'ラメ多め'])
            ->assertOk()
            ->assertJsonPath('data.category', 'premium')
            ->assertJsonPath('data.label', '高級品種')
            ->assertJsonPath('data.source', 'rule');
    }

    public function test_classify_requires_species_name(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai/categories/classify', [])
            ->assertStatus(422);
    }

    public function test_classify_auction_items_returns_rows_and_summary(): void
    {
        $this->makeItem('紅白ラメ', ['item_number' => 2]);
        $this->makeItem('楊貴妃', ['item_number' => 1]);
        $this->makeItem('黒メダカ', ['item_number' => 3]);
        $this->makeItem('三色', ['item_number' => 4, 'status' => 'cancelled']);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/ai/categories/auction/{$this->auction->id}")
            ->assertOk()
            ->assertJsonPath('data.ai_enabled', false);

        $items = $res->json('data.items');
        $this->assertSame(['楊貴妃', '紅白ラメ', '黒メダカ'], array_column($items, 'species_name'), 'item_number 順・取消は除外');
        $this->assertSame(['improved', 'premium', 'standard'], array_column($items, 'category'));

        $summary = collect($res->json('data.summary'))->pluck('count', 'category')->all();
        $this->assertSame(['premium' => 1, 'improved' => 1, 'standard' => 1], $summary);
    }

    public function test_classify_auction_items_requires_admin(): void
    {
        $this->actingAs($this->createParticipant(), 'sanctum')
            ->getJson("/api/admin/ai/categories/auction/{$this->auction->id}")
            ->assertStatus(403);
    }
}
