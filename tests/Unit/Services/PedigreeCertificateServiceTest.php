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

    public function test_certificate_number_format_is_PD_DATE_RANDOM(): void
    {
        $cert = $this->service->create($this->item, $this->admin->id, [
            'breed_name' => 'みゆき',
        ]);

        $expectedDate = now()->format('Ymd');
        $this->assertMatchesRegularExpression(
            '/^PD-' . $expectedDate . '-[A-Z0-9]{6}$/',
            $cert->certificate_number
        );
    }

    public function test_certificate_number_is_unique_across_creations(): void
    {
        $cert1 = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'A']);
        $cert2 = $this->service->create($this->item, $this->admin->id, ['breed_name' => 'B']);

        $this->assertNotSame($cert1->certificate_number, $cert2->certificate_number);
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
