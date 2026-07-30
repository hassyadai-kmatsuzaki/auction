<?php

namespace Tests\Feature\Admin;

use App\Mail\SellerPaymentNoticeMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\SellerSettlement;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * AdminDocumentController のテスト。
 *
 * - invoices: 請求書一覧（落札者単位でグルーピング、status 計算）
 * - paymentNotices: 出品者支払通知書一覧
 * - deliveryNotes: 納品書一覧
 */
class DocumentControllerTest extends TestCase
{
    private User $admin;
    private User $winner;
    private SellerProfile $sellerProfile;
    private Auction $auction;
    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->winner = $this->createParticipant();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
    }

    private function makeWon(array $override = []): WonItem
    {
        // won_items.item_id は UNIQUE なので毎回新規 Item を生成する
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->winner->id,
            'total_amount' => 12000,
            'commission_amount' => 600,
            'seller_amount' => 11400,
            'shipping_fee' => 800,
            'payment_status' => 'pending',
        ], $override));
    }

    public function test_invoices_lists_grouped_by_winner(): void
    {
        $this->makeWon();
        $this->makeWon(['total_amount' => 5000, 'shipping_fee' => 500]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/invoices');
        $r->assertOk();
        $rows = $r->json('data');
        $this->assertCount(1, $rows, 'グルーピングで1行');
        $this->assertSame(2, $rows[0]['items_count']);
        $this->assertSame(12000 + 5000 + 800 + 500, $rows[0]['total_amount']);
        $this->assertSame('pending', $rows[0]['status']);
        $this->assertStringStartsWith('INV-A', $rows[0]['invoice_number']);
    }

    public function test_invoices_marks_paid_when_all_paid(): void
    {
        $this->makeWon(['payment_status' => 'paid', 'paid_at' => now()->subDay()]);
        $this->makeWon(['payment_status' => 'confirmed', 'paid_at' => now()]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/invoices');
        $rows = $r->json('data');
        $this->assertSame('paid', $rows[0]['status']);
        $this->assertNotNull($rows[0]['paid_at']);
    }

    public function test_invoices_marks_overdue(): void
    {
        $this->makeWon([
            'payment_status' => 'pending',
            'payment_deadline' => now()->subDays(2),
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/invoices');
        $rows = $r->json('data');
        $this->assertSame('overdue', $rows[0]['status']);
    }

    public function test_invoices_filtered_by_auction_id(): void
    {
        $this->makeWon();
        $otherAuction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $otherItem = Item::factory()->sold()->create([
            'auction_id' => $otherAuction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        WonItem::factory()->create([
            'item_id' => $otherItem->id,
            'winner_id' => $this->winner->id,
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/documents/invoices?auction_id={$this->auction->id}");
        $rows = $r->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($this->auction->id, $rows[0]['auction_id']);
    }

    public function test_payment_notices_lists_grouped_by_seller(): void
    {
        $this->makeWon();
        $this->makeWon();

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/payment-notices');
        $r->assertOk();
        $rows = $r->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame(2, $rows[0]['items_count']);
        $this->assertSame(24000, $rows[0]['sales_amount']);
        $this->assertSame(1200, $rows[0]['commission']);
        $this->assertSame(22800, $rows[0]['net_amount']);
        $this->assertSame('draft', $rows[0]['status']);
    }

    public function test_payment_notices_marks_sent_when_all_paid(): void
    {
        $this->makeWon(['payment_status' => 'confirmed']);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/payment-notices');
        $rows = $r->json('data');
        $this->assertSame('sent', $rows[0]['status']);
        $this->assertNotNull($rows[0]['issued_at']);
    }

    public function test_delivery_notes_lists_grouped_by_winner(): void
    {
        $this->makeWon(['quantity' => 2]);
        $this->makeWon(['quantity' => 3]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/delivery-notes');
        $r->assertOk();
        $rows = $r->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame(5, (int) $rows[0]['total_quantity']);
        $this->assertSame('preparing', $rows[0]['status']);
    }

    public function test_delivery_notes_marks_shipped(): void
    {
        $this->makeWon([
            'delivery_status' => 'shipped',
            'shipped_at' => now()->subHour(),
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/delivery-notes');
        $rows = $r->json('data');
        $this->assertSame('shipped', $rows[0]['status']);
        $this->assertNotNull($rows[0]['shipped_at']);
    }

    public function test_delivery_notes_marks_completed_when_all_completed(): void
    {
        $this->makeWon(['delivery_status' => 'completed']);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/delivery-notes');
        $rows = $r->json('data');
        $this->assertSame('completed', $rows[0]['status']);
    }

    public function test_non_admin_cannot_access_documents(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/documents/invoices')
            ->assertStatus(403);
    }

    public function test_notify_payment_notices_queues_mail_and_records_sent_at(): void
    {
        Mail::fake();
        $this->makeWon();

        $r = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/documents/payment-notices/notify', [
                'auction_id' => $this->auction->id,
            ]);

        $r->assertOk();
        // LINE 未連携の出品者はメールにフォールバックする
        $this->assertSame(1, $r->json('data.mail'));
        $this->assertSame(0, $r->json('data.line'));
        Mail::assertQueued(SellerPaymentNoticeMail::class, 1);

        $settlement = SellerSettlement::where('auction_id', $this->auction->id)
            ->where('seller_profile_id', $this->sellerProfile->id)
            ->first();
        $this->assertNotNull($settlement?->payment_notice_sent_at);
        $this->assertSame($this->admin->id, $settlement->payment_notice_sent_by);

        // 一覧にも送信日時が反映される
        $rows = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/payment-notices')
            ->json('data');
        $this->assertNotNull($rows[0]['notice_sent_at']);
    }

    public function test_notify_payment_notices_rejects_unfinished_auction(): void
    {
        Mail::fake();
        $this->makeWon();
        $this->auction->update(['status' => 'live']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/documents/payment-notices/notify', [
                'auction_id' => $this->auction->id,
            ])
            ->assertStatus(400);

        Mail::assertNotQueued(SellerPaymentNoticeMail::class);
    }

    public function test_notify_payment_notices_requires_won_items(): void
    {
        Mail::fake();
        $emptyAuction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/documents/payment-notices/notify', [
                'auction_id' => $emptyAuction->id,
            ])
            ->assertStatus(404);

        Mail::assertNotQueued(SellerPaymentNoticeMail::class);
    }
}
