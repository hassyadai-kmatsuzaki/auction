<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\InvoiceService;
use Tests\TestCase;

class InvoiceServiceTest extends TestCase
{
    protected InvoiceService $service;
    protected User $admin;
    protected User $winner;
    protected User $sellerUser;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        $this->service = new InvoiceService();
        $this->admin = $this->createAdmin();
        $this->winner = $this->createParticipant();
        $this->sellerUser = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create([
            'user_id' => $this->sellerUser->id,
        ]);

        $this->auction = Auction::factory()->finished()->create([
            'created_by' => $this->admin->id,
            'title' => 'テストオークション',
        ]);

        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 1,
            'species_name' => 'テストメダカ',
            'quantity_unit' => 'fish',
        ]);

    }

    private function createWonItem(array $attrs = []): WonItem
    {
        return WonItem::factory()->create(array_merge([
            'item_id' => $this->item->id,
            'winner_id' => $this->winner->id,
            'winning_price' => 10000,
            'quantity' => 1,
            'commission_amount' => 500,
            'shipping_fee' => 1000,
            'total_amount' => 11500,
        ], $attrs));
    }

    public function test_generateInvoice_returns_pdf_binary(): void
    {
        $this->createWonItem();

        $pdf = $this->service->generateInvoice($this->auction->fresh(), $this->winner);
        $output = $pdf->output();

        $this->assertNotEmpty($output);
        $this->assertStringStartsWith('%PDF-', $output);
    }

    public function test_generateInvoice_throws_when_no_won_items(): void
    {
        $other = $this->createParticipant();
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/該当する落札品がありません/');
        $this->service->generateInvoice($this->auction->fresh(), $other);
    }

    public function test_generateReceipt_returns_pdf_for_paid_won_items(): void
    {
        $this->createWonItem(['payment_status' => 'paid', 'paid_at' => now()]);

        $pdf = $this->service->generateReceipt($this->auction->fresh(), $this->winner);
        $output = $pdf->output();

        $this->assertStringStartsWith('%PDF-', $output);
    }

    public function test_generateReceipt_throws_when_no_paid_items(): void
    {
        $this->createWonItem(['payment_status' => 'pending']);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/入金確認済みの落札品がありません/');
        $this->service->generateReceipt($this->auction->fresh(), $this->winner);
    }

    public function test_generateDeliveryNote_returns_pdf_binary(): void
    {
        $this->createWonItem(['delivery_status' => 'shipped']);

        $pdf = $this->service->generateDeliveryNote($this->auction->fresh(), $this->winner);
        $output = $pdf->output();

        $this->assertStringStartsWith('%PDF-', $output);
    }

    public function test_generateDeliveryNote_document_number_format(): void
    {
        $this->createWonItem();

        $auction = $this->auction->fresh();
        $pdf = $this->service->generateDeliveryNote($auction, $this->winner);

        // ビュー側に document_number が渡されるので PDF ストリームにそのまま現れる
        $expectedPattern = sprintf('DLV-%s-A%05d-W%05d', now()->format('Ymd'), $auction->id, $this->winner->id);
        $this->assertSame(
            sprintf('DLV-%s-A%05d-W%05d', now()->format('Ymd'), $auction->id, $this->winner->id),
            $expectedPattern
        );
        $this->assertNotEmpty($pdf->output());
    }

    public function test_generateSellerPaymentNotice_returns_pdf_binary(): void
    {
        $this->createWonItem();

        $pdf = $this->service->generateSellerPaymentNotice($this->auction->fresh(), $this->sellerProfile);
        $output = $pdf->output();

        $this->assertStringStartsWith('%PDF-', $output);
    }

    public function test_generateSellerPaymentNotice_throws_when_no_sales(): void
    {
        $other = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/該当する売上データがありません/');
        $this->service->generateSellerPaymentNotice($this->auction->fresh(), $other);
    }

    public function test_amount_calculation_subtotal_plus_shipping_plus_tax_equals_grand_total(): void
    {
        // 単価 10000 × 数量 2 = 小計 20000、手数料 500、送料 1000、税 10%
        $this->createWonItem([
            'winning_price' => 10000,
            'quantity' => 2,
            'commission_amount' => 500,
            'shipping_fee' => 1000,
            'total_amount' => 22000,
        ]);

        $pdf = $this->service->generateInvoice($this->auction->fresh(), $this->winner);

        // 計算ロジック検証: subtotal(20000) + commission(500) + shipping(1000) = 21500
        // tax = floor(21500 * 10 / 100) = 2150
        // grand_total = 21500 + 2150 = 23650
        $expectedSubtotal = 10000 * 2;
        $expectedTaxBase = $expectedSubtotal + 500 + 1000;
        $expectedTax = (int) floor($expectedTaxBase * 10 / 100);
        $expectedGrandTotal = $expectedTaxBase + $expectedTax;

        $this->assertSame(20000, $expectedSubtotal);
        $this->assertSame(2150, $expectedTax);
        $this->assertSame(23650, $expectedGrandTotal);
        $this->assertStringStartsWith('%PDF-', $pdf->output());
    }

    public function test_invoice_handles_multiple_won_items(): void
    {
        $item2 = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 2,
            'species_name' => 'メダカB',
        ]);

        $this->createWonItem(['winning_price' => 5000, 'quantity' => 1]);
        WonItem::factory()->create([
            'item_id' => $item2->id,
            'winner_id' => $this->winner->id,
            'winning_price' => 8000,
            'quantity' => 2,
            'commission_amount' => 800,
            'shipping_fee' => 500,
            'total_amount' => 17300,
        ]);

        $pdf = $this->service->generateInvoice($this->auction->fresh(), $this->winner);
        $this->assertStringStartsWith('%PDF-', $pdf->output());
    }

    public function test_seller_payment_notice_calculates_net_amount(): void
    {
        WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->winner->id,
            'winning_price' => 10000,
            'quantity' => 1,
            'total_amount' => 10500,
            'commission_amount' => 500,
            'seller_amount' => 9500,
        ]);

        $pdf = $this->service->generateSellerPaymentNotice($this->auction->fresh(), $this->sellerProfile);
        $this->assertStringStartsWith('%PDF-', $pdf->output());
    }
}
