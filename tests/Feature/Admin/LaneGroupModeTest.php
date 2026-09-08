<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\AuctionSellerOrder;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * レーン割当の 2 段階モード。
 *  - 確定前（lane_order_confirmed_at = null）: 出品者グループ単位（moveGroup）でのみ配置できる
 *  - 確定後: 生体単位（assignItem / removeItem / reorderItems）で並び替えられる
 * 自動割当は「出品者 × 通常/匿名」でグループ化し、匿名グループをレーン末尾にまとめる。
 */
class LaneGroupModeTest extends TestCase
{
    protected User $admin;
    protected Auction $auction;
    protected Lane $laneA;
    protected Lane $laneB;
    /** @var array<int, SellerProfile> */
    protected array $sellers = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        // 未確定 = 出品者グループ配置モード
        $this->auction = Auction::factory()->scheduled()->create([
            'created_by' => $this->admin->id,
            'lane_count' => 2,
        ]);
        $this->laneA = Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 1, 'lane_name' => 'A']);
        $this->laneB = Lane::factory()->create(['auction_id' => $this->auction->id, 'lane_number' => 2, 'lane_name' => 'B']);
        foreach ([1, 2, 3] as $n) {
            $user = $this->createSeller();
            $this->sellers[$n] = SellerProfile::factory()->create(['user_id' => $user->id, 'seller_code' => "T-00{$n}"]);
        }
    }

    /** @return Item[] */
    private function makeItems(int $sellerNo, int $count, bool $anonymous = false, array $displayOrders = []): array
    {
        $items = [];
        for ($i = 0; $i < $count; $i++) {
            $items[] = Item::factory()->registered()->create([
                'auction_id' => $this->auction->id,
                'seller_profile_id' => $this->sellers[$sellerNo]->id,
                'is_anonymous' => $anonymous,
                'seller_display_order' => $displayOrders[$i] ?? null,
            ]);
        }
        return $items;
    }

    private function attach(Lane $lane, array $items): void
    {
        foreach ($items as $i => $item) {
            $lane->items()->attach($item->id, ['sequence_order' => $i + 1]);
        }
    }

    /** レーンの並びを [出品者No, 匿名, 生体数] の連続区間に畳む */
    private function runs(Lane $lane): array
    {
        $codeToNo = [];
        foreach ($this->sellers as $no => $profile) {
            $codeToNo[$profile->id] = $no;
        }
        $rows = DB::table('lane_items')
            ->join('items', 'items.id', '=', 'lane_items.item_id')
            ->where('lane_items.lane_id', $lane->id)
            ->orderBy('lane_items.sequence_order')
            ->get(['items.seller_profile_id', 'items.is_anonymous']);

        $runs = [];
        foreach ($rows as $row) {
            $key = [$codeToNo[$row->seller_profile_id], (bool) $row->is_anonymous];
            $last = $runs ? $runs[count($runs) - 1] : null;
            if ($last && $last[0] === $key[0] && $last[1] === $key[1]) {
                $runs[count($runs) - 1][2]++;
            } else {
                $runs[] = [$key[0], $key[1], 1];
            }
        }
        return $runs;
    }

    private function laneItemIds(Lane $lane): array
    {
        return DB::table('lane_items')->where('lane_id', $lane->id)->orderBy('sequence_order')->pluck('item_id')->all();
    }

    private function laneSequences(Lane $lane): array
    {
        return DB::table('lane_items')->where('lane_id', $lane->id)->orderBy('sequence_order')->pluck('sequence_order')->all();
    }

    // ------------------------------------------------------------
    // 自動割当
    // ------------------------------------------------------------

    public function test_auto_assign_groups_by_seller_and_anonymity_with_anonymous_groups_last(): void
    {
        // 出品者順序: s2 → s3 → s1
        foreach ([2 => 1, 3 => 2, 1 => 3] as $no => $order) {
            AuctionSellerOrder::create(['auction_id' => $this->auction->id, 'seller_profile_id' => $this->sellers[$no]->id, 'display_order' => $order]);
        }
        $this->makeItems(1, 3);
        $this->makeItems(1, 1, true);
        $this->makeItems(2, 2);
        $this->makeItems(2, 1, true);
        $this->makeItems(3, 1);
        $this->makeItems(3, 2, true);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/auto-assign")
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        // Greedy: 通常 s1(3)→A, s2(2)→B, s3(1)→B / 匿名 s3(2)→A, s2(1)→B, s1(1)→B
        // レーン内: 通常グループを出品者順序順 → 匿名グループを出品者順序順
        $this->assertSame([[1, false, 3], [3, true, 2]], $this->runs($this->laneA));
        $this->assertSame([[2, false, 2], [3, false, 1], [2, true, 1], [1, true, 1]], $this->runs($this->laneB));
        $this->assertSame([1, 2, 3, 4, 5], $this->laneSequences($this->laneA));
        $this->assertSame([1, 2, 3, 4, 5], $this->laneSequences($this->laneB));
        // 確定状態は変えない
        $this->assertNull($this->auction->fresh()->lane_order_confirmed_at);
    }

    public function test_auto_assign_orders_items_within_group_by_seller_display_order(): void
    {
        [$third, $first, $second] = $this->makeItems(1, 3, false, [3, 1, 2]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/auto-assign")
            ->assertStatus(200);

        $this->assertSame([$first->id, $second->id, $third->id], $this->laneItemIds($this->laneA));
        $this->assertSame([], $this->laneItemIds($this->laneB));
    }

    // ------------------------------------------------------------
    // グループ移動（確定前）
    // ------------------------------------------------------------

    public function test_move_group_between_lanes_before_item(): void
    {
        [$s1a, $s1b] = $this->makeItems(1, 2);
        [$s2a] = $this->makeItems(2, 1);
        [$s3a, $s3b] = $this->makeItems(3, 2);
        $this->attach($this->laneA, [$s1a, $s1b, $s2a]);
        $this->attach($this->laneB, [$s3a, $s3b]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/move-group", [
                'item_ids' => [$s1a->id, $s1b->id],
                'target_lane_id' => $this->laneB->id,
                'before_item_id' => $s3b->id,
            ])
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertSame([$s2a->id], $this->laneItemIds($this->laneA));
        $this->assertSame([1], $this->laneSequences($this->laneA));
        $this->assertSame([$s3a->id, $s1a->id, $s1b->id, $s3b->id], $this->laneItemIds($this->laneB));
        $this->assertSame([1, 2, 3, 4], $this->laneSequences($this->laneB));
    }

    public function test_move_group_within_same_lane(): void
    {
        [$s1a, $s1b] = $this->makeItems(1, 2);
        [$s2a] = $this->makeItems(2, 1);
        [$s3a] = $this->makeItems(3, 1);
        $this->attach($this->laneA, [$s1a, $s1b, $s2a, $s3a]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/move-group", [
                'item_ids' => [$s2a->id],
                'target_lane_id' => $this->laneA->id,
                'before_item_id' => $s1a->id,
            ])
            ->assertStatus(200);

        $this->assertSame([$s2a->id, $s1a->id, $s1b->id, $s3a->id], $this->laneItemIds($this->laneA));
        $this->assertSame([1, 2, 3, 4], $this->laneSequences($this->laneA));
    }

    public function test_move_group_to_unassigned(): void
    {
        [$s1a, $s1b] = $this->makeItems(1, 2);
        [$s2a] = $this->makeItems(2, 1);
        $this->attach($this->laneA, [$s1a, $s1b, $s2a]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/move-group", [
                'item_ids' => [$s1a->id, $s1b->id],
                'target_lane_id' => null,
            ])
            ->assertStatus(200);

        $this->assertDatabaseMissing('lane_items', ['item_id' => $s1a->id]);
        $this->assertDatabaseMissing('lane_items', ['item_id' => $s1b->id]);
        $this->assertSame([$s2a->id], $this->laneItemIds($this->laneA));
        $this->assertSame([1], $this->laneSequences($this->laneA));
    }

    public function test_move_group_from_unassigned_appends_in_seller_display_order(): void
    {
        [$s2a] = $this->makeItems(2, 1);
        $this->attach($this->laneA, [$s2a]);
        [$second, $first] = $this->makeItems(1, 2, false, [2, 1]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/move-group", [
                'item_ids' => [$second->id, $first->id],
                'target_lane_id' => $this->laneA->id,
            ])
            ->assertStatus(200);

        $this->assertSame([$s2a->id, $first->id, $second->id], $this->laneItemIds($this->laneA));
        $this->assertSame([1, 2, 3], $this->laneSequences($this->laneA));
    }

    public function test_move_group_rejects_items_from_different_groups(): void
    {
        [$s1a] = $this->makeItems(1, 1);
        [$s1anon] = $this->makeItems(1, 1, true);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/move-group", [
                'item_ids' => [$s1a->id, $s1anon->id],
                'target_lane_id' => $this->laneA->id,
            ])
            ->assertStatus(422)
            ->assertJson(['success' => false]);

        $this->assertDatabaseMissing('lane_items', ['item_id' => $s1a->id]);
    }

    public function test_move_group_is_rejected_after_confirmation(): void
    {
        [$s1a] = $this->makeItems(1, 1);
        $this->auction->update(['lane_order_confirmed_at' => now()]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/lanes/move-group", [
                'item_ids' => [$s1a->id],
                'target_lane_id' => $this->laneA->id,
            ])
            ->assertStatus(422)
            ->assertJson(['success' => false, 'code' => 'LANE_ORDER_CONFIRMED']);
    }

    // ------------------------------------------------------------
    // 確定 / 解除 と生体単位操作のゲート
    // ------------------------------------------------------------

    public function test_item_level_operations_require_confirmation(): void
    {
        [$s1a, $s1b] = $this->makeItems(1, 2);
        $base = "/api/admin/auctions/{$this->auction->id}/lanes";

        // 未確定: 生体単位の割当は拒否
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("{$base}/{$this->laneA->id}/items", ['item_id' => $s1a->id])
            ->assertStatus(422)
            ->assertJson(['success' => false, 'code' => 'LANE_ORDER_NOT_CONFIRMED']);
        $this->assertDatabaseMissing('lane_items', ['item_id' => $s1a->id]);

        // 確定
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("{$base}/confirm-order")
            ->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonPath('data.lane_order_confirmed_by_name', $this->admin->name);
        $fresh = $this->auction->fresh();
        $this->assertNotNull($fresh->lane_order_confirmed_at);
        $this->assertSame($this->admin->id, $fresh->lane_order_confirmed_by);

        // 確定後: 生体単位の割当・並び替え・解除ができる
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("{$base}/{$this->laneA->id}/items", ['item_id' => $s1a->id])
            ->assertStatus(200);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("{$base}/{$this->laneA->id}/items", ['item_id' => $s1b->id])
            ->assertStatus(200);
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("{$base}/{$this->laneA->id}/items/reorder", ['item_ids' => [$s1b->id, $s1a->id]])
            ->assertStatus(200);
        $this->assertSame([$s1b->id, $s1a->id], $this->laneItemIds($this->laneA));

        // 解除すると再び拒否される
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("{$base}/unconfirm-order")
            ->assertStatus(200);
        $this->assertNull($this->auction->fresh()->lane_order_confirmed_at);
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("{$base}/{$this->laneA->id}/items/reorder", ['item_ids' => [$s1a->id, $s1b->id]])
            ->assertStatus(422)
            ->assertJson(['code' => 'LANE_ORDER_NOT_CONFIRMED']);
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("{$base}/{$this->laneA->id}/items/{$s1a->id}")
            ->assertStatus(422)
            ->assertJson(['code' => 'LANE_ORDER_NOT_CONFIRMED']);
        // 解除してもデータは変わらない
        $this->assertSame([$s1b->id, $s1a->id], $this->laneItemIds($this->laneA));
    }

    public function test_confirm_and_unconfirm_are_blocked_once_auction_started(): void
    {
        $this->auction->update(['status' => 'live']);
        $base = "/api/admin/auctions/{$this->auction->id}/lanes";

        $this->actingAs($this->admin, 'sanctum')->postJson("{$base}/confirm-order")->assertStatus(400);
        $this->actingAs($this->admin, 'sanctum')->postJson("{$base}/unconfirm-order")->assertStatus(400);
        $this->assertNull($this->auction->fresh()->lane_order_confirmed_at);
    }

    public function test_index_exposes_confirmation_state_and_seller_code(): void
    {
        [$s1a] = $this->makeItems(1, 1);
        $this->attach($this->laneA, [$s1a]);
        [$s2a] = $this->makeItems(2, 1);
        $base = "/api/admin/auctions/{$this->auction->id}/lanes";

        $response = $this->actingAs($this->admin, 'sanctum')->getJson($base)->assertStatus(200);
        $this->assertNull($response->json('data.auction.lane_order_confirmed_at'));
        $this->assertSame('T-001', $response->json('data.lanes.0.items.0.seller_code'));
        $this->assertSame('T-002', $response->json('data.unassigned_items.0.seller_code'));

        $this->actingAs($this->admin, 'sanctum')->postJson("{$base}/confirm-order")->assertStatus(200);
        $response = $this->actingAs($this->admin, 'sanctum')->getJson($base)->assertStatus(200);
        $this->assertNotNull($response->json('data.auction.lane_order_confirmed_at'));
        $this->assertSame($this->admin->name, $response->json('data.auction.lane_order_confirmed_by_name'));
    }

    public function test_non_admin_cannot_use_group_mode_endpoints(): void
    {
        $seller = $this->createSeller();
        $base = "/api/admin/auctions/{$this->auction->id}/lanes";

        $this->actingAs($seller, 'sanctum')->postJson("{$base}/confirm-order")->assertStatus(403);
        $this->actingAs($seller, 'sanctum')->postJson("{$base}/move-group", ['item_ids' => [1]])->assertStatus(403);
    }
}
