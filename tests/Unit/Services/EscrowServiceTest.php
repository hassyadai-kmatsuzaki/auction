<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\EscrowTransaction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\EscrowService;
use Illuminate\Support\Facades\Log;
use Mockery;
use Tests\TestCase;

class EscrowServiceTest extends TestCase
{
    protected EscrowService $service;
    protected User $admin;
    protected User $buyer;
    protected User $sellerUser;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        $this->service = new EscrowService();
        $this->admin = $this->createAdmin();
        $this->buyer = $this->createParticipant();
        $this->sellerUser = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->sellerUser->id]);
        $this->auction = Auction::factory()->live()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeWonItem(array $attrs = []): WonItem
    {
        return WonItem::factory()->create(array_merge([
            'item_id' => $this->item->id,
            'winner_id' => $this->buyer->id,
            'total_amount' => 12000,
        ], $attrs));
    }

    private function makeEscrow(string $status = 'awaiting_payment', array $extra = []): EscrowTransaction
    {
        $wonItem = $this->makeWonItem();
        return EscrowTransaction::factory()->create(array_merge([
            'won_item_id' => $wonItem->id,
            'buyer_id' => $this->buyer->id,
            'seller_id' => $this->sellerUser->id,
            'amount' => (int) $wonItem->total_amount,
            'status' => $status,
        ], $extra));
    }

    public function test_createFromWonItem_creates_awaiting_payment_transaction(): void
    {
        $wonItem = $this->makeWonItem(['total_amount' => 15500]);

        $escrow = $this->service->createFromWonItem($wonItem->fresh('item.sellerProfile'));

        $this->assertSame('awaiting_payment', $escrow->status);
        $this->assertSame(15500, (int) $escrow->amount);
        $this->assertSame($this->buyer->id, $escrow->buyer_id);
        $this->assertSame($this->sellerUser->id, $escrow->seller_id);
        $this->assertSame($wonItem->id, $escrow->won_item_id);
    }

    public function test_createFromWonItem_throws_when_buyer_user_missing(): void
    {
        // 存在しない買い手 ID の WonItem を作って例外を確認
        $wonItem = WonItem::factory()->make([
            'item_id' => $this->item->id,
            'winner_id' => 999999,
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/買い手ユーザーが存在しません/');
        $this->service->createFromWonItem($wonItem);
    }

    public function test_confirmPayment_updates_escrow_and_won_item(): void
    {
        Log::shouldReceive('channel')
            ->once()
            ->with('audit')
            ->andReturnSelf();
        Log::shouldReceive('info')
            ->once()
            ->with('ESCROW_PAYMENT_CONFIRMED', Mockery::on(fn ($ctx) => $ctx['escrow_id'] !== null));

        $escrow = $this->makeEscrow('awaiting_payment');

        $this->service->confirmPayment($escrow);

        $escrow->refresh();
        $this->assertSame('payment_held', $escrow->status);
        $this->assertNotNull($escrow->paid_at);
        $this->assertSame('paid', $escrow->wonItem->fresh()->payment_status);
    }

    public function test_releaseToSeller_throws_when_not_payment_held(): void
    {
        Log::shouldReceive('channel')->andReturnSelf();
        Log::shouldReceive('info');

        $escrow = $this->makeEscrow('awaiting_payment');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/エスクロー状態が不正です/');
        $this->service->releaseToSeller($escrow);
    }

    public function test_releaseToSeller_marks_completed_and_logs_audit(): void
    {
        Log::shouldReceive('channel')
            ->once()
            ->with('audit')
            ->andReturnSelf();
        Log::shouldReceive('info')
            ->once()
            ->with('ESCROW_RELEASED', Mockery::on(fn ($ctx) => isset($ctx['seller_id'])));

        $escrow = $this->makeEscrow('payment_held');

        $this->service->releaseToSeller($escrow);

        $escrow->refresh();
        $this->assertSame('released_to_seller', $escrow->status);
        $this->assertNotNull($escrow->released_at);
        $this->assertSame('completed', $escrow->wonItem->fresh()->delivery_status);
    }

    public function test_refund_from_payment_held_updates_status_and_won_item(): void
    {
        Log::shouldReceive('channel')->once()->with('audit')->andReturnSelf();
        Log::shouldReceive('info')
            ->once()
            ->with('ESCROW_REFUNDED', Mockery::on(fn ($ctx) => $ctx['reason'] === '商品不良'));

        $escrow = $this->makeEscrow('payment_held');

        $this->service->refund($escrow, '商品不良');

        $escrow->refresh();
        $this->assertSame('refunded', $escrow->status);
        $this->assertSame('商品不良', $escrow->notes);
        $this->assertNotNull($escrow->refunded_at);
        $this->assertSame('refunded', $escrow->wonItem->fresh()->payment_status);
    }

    public function test_refund_throws_when_status_invalid(): void
    {
        Log::shouldReceive('channel')->andReturnSelf();
        Log::shouldReceive('info');

        $escrow = $this->makeEscrow('awaiting_payment');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/返金可能な状態ではありません/');
        $this->service->refund($escrow, 'reason');
    }

    public function test_refund_allowed_from_disputed(): void
    {
        Log::shouldReceive('channel')->once()->with('audit')->andReturnSelf();
        Log::shouldReceive('info')->once();

        $escrow = $this->makeEscrow('disputed');

        $this->service->refund($escrow, '紛争解決による返金');

        $escrow->refresh();
        $this->assertSame('refunded', $escrow->status);
        $this->assertSame('紛争解決による返金', $escrow->notes);
    }

    public function test_openDispute_sets_status_disputed_with_reason(): void
    {
        Log::shouldReceive('channel')
            ->once()
            ->with('audit')
            ->andReturnSelf();
        Log::shouldReceive('info')
            ->once()
            ->with('ESCROW_DISPUTED', Mockery::on(fn ($ctx) => $ctx['reason'] === '商品が破損'));

        $escrow = $this->makeEscrow('payment_held');

        $this->service->openDispute($escrow, '商品が破損');

        $escrow->refresh();
        $this->assertSame('disputed', $escrow->status);
        $this->assertSame('商品が破損', $escrow->notes);
    }

    public function test_confirmPayment_writes_audit_log_with_buyer_id(): void
    {
        Log::shouldReceive('channel')
            ->once()
            ->with('audit')
            ->andReturnSelf();
        Log::shouldReceive('info')
            ->once()
            ->with('ESCROW_PAYMENT_CONFIRMED', Mockery::on(function ($ctx) {
                return isset($ctx['escrow_id'], $ctx['amount'], $ctx['buyer_id']);
            }));

        $escrow = $this->makeEscrow('awaiting_payment');

        $this->service->confirmPayment($escrow);
        $this->assertTrue(true);
    }
}
