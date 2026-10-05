<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\PedigreeCertificate;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\PedigreeCertificateService;
use Tests\TestCase;

class PedigreeCertificateServiceTest extends TestCase
{
    protected PedigreeCertificateService $service;
    protected User $admin;
    protected User $sellerUser;
    protected SellerProfile $sellerProfile;
    protected Auction $auction;
    protected Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        config(['features.pedigree_certificate' => true]);
        $this->service = new PedigreeCertificateService();
        $this->admin = $this->createAdmin();
        $this->sellerUser = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->sellerUser->id]);
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
    }

    public function test_create_persists_pedigree_certificate_in_draft(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, [
            'breed_name' => '楊貴妃',
            'breed_type' => '体外光',
            'fixation_rate' => 85.5,
            'expression' => 'オレンジ強光',
            'parent_male' => ['name' => '父1', 'breed' => '楊貴妃'],
            'parent_female' => ['name' => '母1', 'breed' => '楊貴妃'],
            'lineage' => ['gen1' => 'A', 'gen2' => 'B', 'gen3' => 'C'],
            'breeding_notes' => '室内飼育',
        ]);

        $this->assertSame('draft', $cert->status);
        $this->assertSame('楊貴妃', $cert->breed_name);
        $this->assertSame($this->item->id, $cert->item_id);
        $this->assertSame($this->admin->id, $cert->issued_by);
        $this->assertNotNull($cert->certificate_number);
        $this->assertDatabaseHas('pedigree_certificates', ['id' => $cert->id]);
    }

    public function test_create_handles_optional_fields(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, [
            'breed_name' => '紅帝',
        ]);

        $this->assertNull($cert->breed_type);
        $this->assertNull($cert->expression);
        $this->assertNull($cert->parent_male);
        $this->assertNull($cert->lineage);
        $this->assertSame('draft', $cert->status);
    }

    public function test_draft_has_placeholder_number_until_issued(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'みゆき']);

        $this->assertTrue($this->service->isDraftNumber($cert->certificate_number));
        $this->assertNull($this->service->verificationUrl($cert));
    }

    public function test_certificate_number_format_is_PD_DATE_RANDOM_assigned_at_issue(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, [
            'breed_name' => 'みゆき',
        ]);
        $this->service->issue($cert);

        $expectedDate = now()->format('Ymd');
        $this->assertMatchesRegularExpression(
            '/^PD-' . $expectedDate . '-[A-Z0-9]{6}$/',
            $cert->certificate_number
        );
    }

    public function test_certificate_number_is_unique_across_creations(): void
    {
        $cert1 = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $item2 = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $cert2 = $this->service->create($item2, $this->admin->id, ['breed_name' => 'B']);
        $this->service->issue($cert1);
        $this->service->issue($cert2);

        $this->assertNotSame($cert1->certificate_number, $cert2->certificate_number);
    }

    public function test_create_rejects_second_certificate_for_same_item(): void
    {
        $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $this->service->create($this->item, $this->admin->id, ['breed_name' => 'B']);
    }

    public function test_generatePdf_with_qr_for_issued_certificate(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $this->service->issue($cert);

        $output = $this->service->generatePdf($cert->fresh())->output();

        $this->assertStringStartsWith('%PDF', $output);
    }

    public function test_issue_twice_keeps_first_number(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $stale = PedigreeCertificate::find($cert->id);
        $this->service->issue($cert);
        $number = $cert->certificate_number;

        // 画面に古い状態（draft）を持ったまま2回目の発行が来ても、DB の状態で弾き番号は変わらない
        try {
            $this->service->issue($stale);
            $this->fail('2回目の発行が通ってしまった');
        } catch (\Illuminate\Validation\ValidationException) {
        }
        $this->assertSame($number, $cert->fresh()->certificate_number);
    }

    public function test_pdf_shows_market_as_issuer_not_admin_name(): void
    {
        // 落札者もダウンロードするため、管理者アカウントの名前は出さない
        $this->admin->update(['name' => '管理者個人名']);
        $cert = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $this->service->issue($cert);
        $html = view('pdf.pedigree-certificate', [
            'certificate' => $cert, 'item' => $this->item, 'issuer' => $this->admin, 'verifyUrl' => null, 'qrDataUri' => null,
        ])->render();

        $this->assertStringContainsString('発行者: 日本メダカオンライン市場', $html);
        $this->assertStringNotContainsString('管理者個人名', $html);
        $this->assertStringContainsString('生体No', $html);
    }

    public function test_draft_pdf_does_not_show_placeholder_number(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $html = view('pdf.pedigree-certificate', [
            'certificate' => $cert, 'item' => $this->item, 'issuer' => $this->admin, 'verifyUrl' => null, 'qrDataUri' => null,
        ])->render();

        $this->assertStringContainsString('発行時に付与', $html);
        $this->assertStringNotContainsString('DRAFT-', $html);
    }

    public function test_pdf_view_shows_verify_url_only_when_qr_given(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $this->service->issue($cert);
        $render = fn (?string $qr) => view('pdf.pedigree-certificate', [
            'certificate' => $cert,
            'item' => $this->item,
            'issuer' => $this->admin,
            'verifyUrl' => $this->service->verificationUrl($cert),
            'qrDataUri' => $qr,
        ])->render();

        $this->assertStringNotContainsString('/pedigree/verify/', $render(null));
        $this->assertStringContainsString('/pedigree/verify/' . $cert->certificate_number, $render('data:image/png;base64,AAAA'));
    }

    public function test_issue_changes_status_and_sets_issued_at(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, [
            'breed_name' => 'ラメ系',
        ]);

        $this->assertSame('draft', $cert->status);
        $this->assertNull($cert->issued_at);

        $this->service->issue($cert);

        $cert->refresh();
        $this->assertSame('issued', $cert->status);
        $this->assertNotNull($cert->issued_at);
    }

    public function test_generatePdf_returns_pdf_binary(): void
    {
        $cert = PedigreeCertificate::create([
            'item_id' => $this->item->id,
            'issued_by' => $this->admin->id,
            'certificate_number' => 'PD-' . now()->format('Ymd') . '-ABC123',
            'breed_name' => 'みゆき',
            'breed_type' => '体外光',
            'fixation_rate' => 90.0,
            'expression' => '青系',
            'parent_male' => ['name' => '父系統A'],
            'parent_female' => ['name' => '母系統B'],
            'lineage' => ['g1' => 'X'],
            'breeding_notes' => 'メモ',
            'status' => 'issued',
            'issued_at' => now(),
        ]);

        $pdf = $this->service->generatePdf($cert);
        $output = $pdf->output();

        $this->assertNotEmpty($output);
        $this->assertStringStartsWith('%PDF-', $output);
    }

    public function test_generatePdf_works_with_minimal_certificate(): void
    {
        $cert = PedigreeCertificate::create([
            'item_id' => $this->item->id,
            'issued_by' => $this->admin->id,
            'certificate_number' => 'PD-' . now()->format('Ymd') . '-MIN001',
            'breed_name' => '最小データ',
            'status' => 'draft',
        ]);

        $pdf = $this->service->generatePdf($cert);

        $this->assertStringStartsWith('%PDF-', $pdf->output());
    }

    public function test_create_then_issue_workflow(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, [
            'breed_name' => 'workflow test',
            'breed_type' => 'standard',
        ]);

        $this->service->issue($cert);

        $this->assertDatabaseHas('pedigree_certificates', [
            'id' => $cert->id,
            'status' => 'issued',
            'breed_name' => 'workflow test',
        ]);
        $this->assertNotNull($cert->fresh()->issued_at);
    }
}
