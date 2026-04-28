<?php

namespace Tests\Unit\Models;

use App\Models\EscrowTransaction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class EscrowTransactionTest extends TestCase
{
    private User $buyer;
    private User $seller;
    private WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->buyer = $this->createParticipant();
        $this->seller = $this->createSeller();

        $admin = $this->createAdmin();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $auction = \App\Models\Auction::factory()->create(['created_by' => $admin->id]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $this->wonItem = WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->buyer->id,
        ]);
    }

    private function makeEscrow(array $overrides = []): EscrowTransaction
    {
        return EscrowTransaction::factory()->create(array_merge([
            'won_item_id' => $this->wonItem->id,
            'buyer_id' => $this->buyer->id,
            'seller_id' => $this->seller->id,
            'amount' => 50000,
            'status' => 'awaiting_payment',
        ], $overrides));
    }

    public function test_escrow_transactionが作成される(): void
    {
        $escrow = $this->makeEscrow();

        $this->assertDatabaseHas('escrow_transactions', [
            'id' => $escrow->id,
            'amount' => 50000,
            'status' => 'awaiting_payment',
        ]);
    }

    public function test_buyer_リレーション(): void
    {
        $escrow = $this->makeEscrow();

        $this->assertInstanceOf(User::class, $escrow->buyer);
        $this->assertSame($this->buyer->id, $escrow->buyer->id);
    }

    public function test_seller_リレーション(): void
    {
        $escrow = $this->makeEscrow();

        $this->assertInstanceOf(User::class, $escrow->seller);
        $this->assertSame($this->seller->id, $escrow->seller->id);
    }

    public function test_wonItem_リレーション(): void
    {
        $escrow = $this->makeEscrow();

        $this->assertInstanceOf(WonItem::class, $escrow->wonItem);
        $this->assertSame($this->wonItem->id, $escrow->wonItem->id);
    }

    public function test_amount_はintegerキャスト(): void
    {
        $escrow = $this->makeEscrow(['amount' => '12345']);

        $this->assertSame(12345, $escrow->amount);
        $this->assertIsInt($escrow->amount);
    }

    public function test_paid_at_はdatetimeキャスト(): void
    {
        $escrow = $this->makeEscrow(['paid_at' => '2026-04-01 12:00:00']);

        $this->assertInstanceOf(Carbon::class, $escrow->paid_at);
        $this->assertSame('2026-04-01 12:00:00', $escrow->paid_at->format('Y-m-d H:i:s'));
    }

    public function test_released_at_と_refunded_at_もdatetimeキャスト(): void
    {
        $escrow = $this->makeEscrow([
            'released_at' => '2026-04-02 10:00:00',
            'refunded_at' => '2026-04-03 10:00:00',
        ]);

        $this->assertInstanceOf(Carbon::class, $escrow->released_at);
        $this->assertInstanceOf(Carbon::class, $escrow->refunded_at);
    }

    public function test_状態遷移_payment_held_to_released(): void
    {
        $escrow = $this->makeEscrow(['status' => 'payment_held', 'paid_at' => now()]);

        $escrow->update([
            'status' => 'released_to_seller',
            'released_at' => now(),
        ]);

        $this->assertSame('released_to_seller', $escrow->fresh()->status);
        $this->assertNotNull($escrow->fresh()->released_at);
    }

    public function test_状態遷移_refunded(): void
    {
        $escrow = $this->makeEscrow(['status' => 'payment_held', 'paid_at' => now()]);

        $escrow->update([
            'status' => 'refunded',
            'refunded_at' => now(),
        ]);

        $this->assertSame('refunded', $escrow->fresh()->status);
        $this->assertNotNull($escrow->fresh()->refunded_at);
    }
}
