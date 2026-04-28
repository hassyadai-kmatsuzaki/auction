<?php

namespace Tests\Unit\Models;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\SellerSettlement;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SellerSettlementTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
    }

    private function makeSettlement(array $overrides = []): SellerSettlement
    {
        return SellerSettlement::create(array_merge([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'status' => SellerSettlement::STATUS_PENDING,
            'total_sales' => 0,
            'total_commission' => 0,
            'total_shipping_fee' => 0,
            'net_amount' => 0,
            'items_count' => 0,
        ], $overrides));
    }

    public function test_settlementが作成される(): void
    {
        $settlement = $this->makeSettlement();

        $this->assertDatabaseHas('seller_settlements', [
            'id' => $settlement->id,
            'auction_id' => $this->auction->id,
            'status' => SellerSettlement::STATUS_PENDING,
        ]);
    }

    public function test_auction_リレーション(): void
    {
        $settlement = $this->makeSettlement();

        $this->assertInstanceOf(Auction::class, $settlement->auction);
        $this->assertSame($this->auction->id, $settlement->auction->id);
    }

    public function test_sellerProfile_リレーション(): void
    {
        $settlement = $this->makeSettlement();

        $this->assertInstanceOf(SellerProfile::class, $settlement->sellerProfile);
        $this->assertSame($this->sellerProfile->id, $settlement->sellerProfile->id);
    }

    public function test_paidBy_リレーション(): void
    {
        $settlement = $this->makeSettlement(['paid_by' => $this->admin->id]);

        $this->assertInstanceOf(User::class, $settlement->paidBy);
        $this->assertSame($this->admin->id, $settlement->paidBy->id);
    }

    public function test_paid_at_はdatetimeキャスト(): void
    {
        $settlement = $this->makeSettlement(['paid_at' => '2026-04-15 10:00:00']);

        $this->assertInstanceOf(Carbon::class, $settlement->fresh()->paid_at);
    }

    public function test_recalculateTotals_はWonItemから集計を反映する(): void
    {
        $settlement = $this->makeSettlement();

        // この出品者の落札商品を 2 件作成
        for ($i = 0; $i < 2; $i++) {
            $item = Item::factory()->create([
                'auction_id' => $this->auction->id,
                'seller_profile_id' => $this->sellerProfile->id,
                'status' => 'sold',
            ]);
            WonItem::factory()->create([
                'item_id' => $item->id,
                'winner_id' => $this->createParticipant()->id,
                'total_amount' => 10000,
                'commission_amount' => 500,
                'seller_amount' => 9500,
                'shipping_fee' => 1000,
            ]);
        }

        $settlement->recalculateTotals();

        $fresh = $settlement->fresh();
        $this->assertEquals(20000, (float) $fresh->total_sales);
        $this->assertEquals(1000, (float) $fresh->total_commission);
        $this->assertEquals(19000, (float) $fresh->net_amount);
        $this->assertEquals(2000, (float) $fresh->total_shipping_fee);
        $this->assertSame(2, (int) $fresh->items_count);
    }

    public function test_recalculateTotals_は他出品者のWonItemを含めない(): void
    {
        $settlement = $this->makeSettlement();

        $otherSellerProfile = SellerProfile::factory()->create([
            'user_id' => $this->createSeller()->id,
        ]);
        $otherItem = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $otherSellerProfile->id,
            'status' => 'sold',
        ]);
        WonItem::factory()->create([
            'item_id' => $otherItem->id,
            'total_amount' => 99999,
        ]);

        $settlement->recalculateTotals();

        $this->assertEquals(0, (float) $settlement->fresh()->total_sales);
        $this->assertSame(0, (int) $settlement->fresh()->items_count);
    }

    public function test_状態遷移_pending_to_completed(): void
    {
        $settlement = $this->makeSettlement();

        $settlement->update([
            'status' => SellerSettlement::STATUS_COMPLETED,
            'paid_at' => now(),
            'paid_by' => $this->admin->id,
            'payment_method' => 'bank_transfer',
        ]);

        $fresh = $settlement->fresh();
        $this->assertSame(SellerSettlement::STATUS_COMPLETED, $fresh->status);
        $this->assertNotNull($fresh->paid_at);
        $this->assertSame($this->admin->id, $fresh->paid_by);
    }

    public function test_unique_制約_同じauctionとsellerProfileの組み合わせ(): void
    {
        $this->makeSettlement();

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->makeSettlement();
    }
}
