<?php

namespace Tests\Feature;

use App\Models\Auction;
use App\Models\EscrowTransaction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\EscrowService;
use Tests\TestCase;

/**
 * F-032: 落札商品の状態をエスクローへ同期する（won_items は読むだけ）
 */
class EscrowSyncTest extends TestCase
{
    private User $buyer;
    private User $seller;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->buyer = $this->createParticipant();
        $this->seller = $this->createSeller();
        $this->auction = Auction::factory()->finished()->create();
    }

    private function makeWonItem(array $attrs = [], bool $withSeller = true): WonItem
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $withSeller ? SellerProfile::firstOrCreate(['user_id' => $this->seller->id], SellerProfile::factory()->raw(['user_id' => $this->seller->id]))->id : null,
        ]);

        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->buyer->id,
            'payment_status' => 'pending',
            'delivery_status' => 'pending',
        ], $attrs));
    }

    private function sync(WonItem $w): ?EscrowTransaction
    {
        return app(EscrowService::class)->syncFromWonItem($w->fresh());
    }

    public function test_follows_payment_and_delivery_lifecycle(): void
    {
        $w = $this->makeWonItem();
        $this->assertSame('awaiting_payment', $this->sync($w)->status);

        $paidAt = now()->subHour()->startOfSecond();
        $w->update(['payment_status' => 'confirmed', 'paid_at' => $paidAt]);
        $e = $this->sync($w);
        $this->assertSame('payment_held', $e->status);
        $this->assertTrue($e->paid_at->equalTo($paidAt));

        $w->update(['delivery_status' => 'shipped']);
        $this->assertSame('payment_held', $this->sync($w)->status);

        $w->update(['delivery_status' => 'completed']);
        $e = $this->sync($w);
        $this->assertSame('released_to_seller', $e->status);
        $this->assertNotNull($e->released_at);

        $this->assertSame(1, EscrowTransaction::where('won_item_id', $w->id)->count());
    }

    public function test_does_not_write_to_won_items(): void
    {
        $w = $this->makeWonItem(['payment_status' => 'paid', 'delivery_status' => 'completed']);
        $before = $w->fresh()->getAttributes();

        $this->sync($w);

        $this->assertEquals($before, $w->fresh()->getAttributes());
    }

    public function test_refunded_and_disputed(): void
    {
        $w = $this->makeWonItem(['payment_status' => 'refunded']);
        $this->assertSame('refunded', $this->sync($w)->status);

        $w2 = $this->makeWonItem(['payment_status' => 'paid']);
        $e = $this->sync($w2);
        $e->update(['status' => 'disputed']);
        $w2->update(['delivery_status' => 'completed']);
        // 紛争中は手動管理なので同期で上書きしない
        $this->assertSame('disputed', $this->sync($w2)->status);
    }

    public function test_items_without_seller_are_skipped(): void
    {
        $w = $this->makeWonItem([], withSeller: false);

        $this->assertNull($this->sync($w));
        $this->assertSame(0, EscrowTransaction::count());
    }

    public function test_command_skips_while_auction_is_live(): void
    {
        $this->makeWonItem();
        Auction::factory()->live()->create();

        $this->artisan('escrow:sync')->expectsOutputToContain('スキップ')->assertExitCode(0);
        $this->assertSame(0, EscrowTransaction::count());

        $this->artisan('escrow:sync', ['--force' => true])->assertExitCode(0);
        $this->assertSame(1, EscrowTransaction::count());
    }

    public function test_command_is_idempotent(): void
    {
        $this->makeWonItem(['payment_status' => 'paid']);

        $this->artisan('escrow:sync')->assertExitCode(0);
        $this->artisan('escrow:sync')->assertExitCode(0);
        $this->artisan('escrow:sync', ['--all' => true])->assertExitCode(0);

        $this->assertSame(1, EscrowTransaction::count());
        $this->assertSame('payment_held', EscrowTransaction::first()->status);
    }
}
