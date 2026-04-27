<?php

namespace Tests\Feature\Api;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\InvoiceService;
use Mockery;
use Tests\TestCase;

/**
 * 請求書 / 領収書 / 納品書 / 出品者支払通知書 PDF エンドポイントのテスト。
 *
 * PDF 自体の中身は InvoiceService の責務（DomPDF 経由）でここでは扱わない。
 * Controller が認可・状態ゲート（送料承認/支払済み等）と HTTP レスポンスヘッダを正しく返すことを検証する。
 * InvoiceService は Mock してテスト時間とブラウザ起動依存を排除する。
 */
class InvoiceControllerTest extends TestCase
{
    private User $admin;
    private User $winner;
    private User $seller;
    private SellerProfile $sellerProfile;
    private Auction $auction;
    private Item $item;
    private WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->winner = $this->createParticipant();
        $this->seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $this->wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->winner->id,
            'shipping_calculated_at' => now(),
            'shipping_approved_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * InvoiceService の指定メソッドが PDF stub を返すよう Mock する
     */
    private function mockInvoice(string $method, ?string $body = null): void
    {
        $pdf = Mockery::mock(\Barryvdh\DomPDF\PDF::class);
        $pdf->shouldReceive('output')->andReturn($body ?? '%PDF-1.4 fake pdf body');

        $this->mock(InvoiceService::class, function ($m) use ($method, $pdf) {
            $m->shouldReceive($method)->once()->andReturn($pdf);
        });
    }

    public function test_participant_can_download_invoice_after_approval(): void
    {
        $this->mockInvoice('generateInvoice');

        $response = $this->actingAs($this->winner, 'sanctum')
            ->get("/api/participant/auctions/{$this->auction->id}/invoice");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('invoice_auction_', $response->headers->get('Content-Disposition'));
    }

    public function test_participant_invoice_blocked_before_shipping_approval(): void
    {
        $this->wonItem->update(['shipping_approved_at' => null]);

        $this->actingAs($this->winner, 'sanctum')
            ->get("/api/participant/auctions/{$this->auction->id}/invoice")
            ->assertStatus(400);
    }

    public function test_participant_invoice_404_when_no_won_items(): void
    {
        $other = $this->createParticipant();

        $this->actingAs($other, 'sanctum')
            ->get("/api/participant/auctions/{$this->auction->id}/invoice")
            ->assertStatus(404);
    }

    public function test_participant_can_download_receipt_when_paid(): void
    {
        $this->wonItem->update(['payment_status' => 'paid']);
        $this->mockInvoice('generateReceipt');

        $response = $this->actingAs($this->winner, 'sanctum')
            ->get("/api/participant/auctions/{$this->auction->id}/receipt");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_participant_receipt_blocked_when_unpaid(): void
    {
        $this->wonItem->update(['payment_status' => 'pending']);

        $this->actingAs($this->winner, 'sanctum')
            ->get("/api/participant/auctions/{$this->auction->id}/receipt")
            ->assertStatus(404);
    }

    public function test_admin_can_download_invoice(): void
    {
        $this->mockInvoice('generateInvoice');

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/invoice");

        $response->assertOk();
        $this->assertStringContainsString("winner_{$this->winner->id}", $response->headers->get('Content-Disposition'));
    }

    public function test_admin_can_download_delivery_note(): void
    {
        $this->mockInvoice('generateDeliveryNote');

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/delivery-note");

        $response->assertOk();
        $this->assertStringContainsString('delivery_note_', $response->headers->get('Content-Disposition'));
    }

    public function test_admin_can_download_payment_notice(): void
    {
        $this->mockInvoice('generateSellerPaymentNotice');

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/auctions/{$this->auction->id}/sellers/{$this->sellerProfile->id}/payment-notice");

        $response->assertOk();
        $this->assertStringContainsString('payment_notice_', $response->headers->get('Content-Disposition'));
    }

    public function test_seller_can_download_own_payment_notice(): void
    {
        $this->mockInvoice('generateSellerPaymentNotice');

        $response = $this->actingAs($this->seller, 'sanctum')
            ->get("/api/seller/settlements/{$this->auction->id}/payment-notice");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_seller_payment_notice_404_when_no_items_sold(): void
    {
        $other = $this->createSeller();
        SellerProfile::factory()->create(['user_id' => $other->id]);

        $this->actingAs($other, 'sanctum')
            ->get("/api/seller/settlements/{$this->auction->id}/payment-notice")
            ->assertStatus(404);
    }

    public function test_invoice_500_when_pdf_generation_throws(): void
    {
        $this->mock(InvoiceService::class, function ($m) {
            $m->shouldReceive('generateInvoice')->once()->andThrow(new \RuntimeException('pdf fail'));
        });

        $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/invoice")
            ->assertStatus(500);
    }

    public function test_line_signed_invoice_url_works(): void
    {
        $this->mockInvoice('generateInvoice');

        $url = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'line.invoice.download',
            now()->addHour(),
            ['auctionId' => $this->auction->id, 'winnerId' => $this->winner->id]
        );

        $response = $this->get($url);
        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
    }

    public function test_line_invoice_rejects_invalid_signature(): void
    {
        // 署名なしで叩く → 403
        $this->get("/api/line/invoices/{$this->auction->id}/{$this->winner->id}")
            ->assertStatus(403);
    }
}
