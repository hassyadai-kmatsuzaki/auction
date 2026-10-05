<?php

namespace Tests\Feature\Api;

use App\Models\Auction;
use App\Models\Item;
use App\Models\PedigreeCertificate;
use App\Models\SellerProfile;
use Tests\TestCase;

class PedigreeCertificateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['features.pedigree_certificate' => true]);
    }

    private function makeItem(): Item
    {
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->create();
        return Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
    }

    private function makeCertificate(int $itemId, int $issuedBy, array $overrides = []): PedigreeCertificate
    {
        return PedigreeCertificate::create(array_merge([
            'item_id' => $itemId,
            'issued_by' => $issuedBy,
            'certificate_number' => 'PD-' . now()->format('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3))),
            'breed_name' => '三色ラメ体外光',
            'breed_type' => '体外光',
            'fixation_rate' => 80.5,
            'expression' => 'ラメ強',
            'parent_male' => ['name' => '父魚A'],
            'parent_female' => ['name' => '母魚B'],
            'lineage' => [],
            'breeding_notes' => 'テスト',
            'status' => 'draft',
        ], $overrides));
    }

    public function test_admin_can_view_certificate_for_item(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $cert = $this->makeCertificate($item->id, $admin->id);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/pedigree/{$item->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $cert->id)
            ->assertJsonPath('data.certificate_number', $cert->certificate_number);
    }

    public function test_admin_can_create_certificate(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree', [
                'item_id' => $item->id,
                'breed_name' => '楊貴妃',
                'breed_type' => 'ヒカリ',
                'fixation_rate' => 60.5,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.breed_name', '楊貴妃');
        $this->assertDatabaseHas('pedigree_certificates', [
            'item_id' => $item->id,
            'breed_name' => '楊貴妃',
            'status' => 'draft',
        ]);
    }

    public function test_admin_can_issue_certificate(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $cert = $this->makeCertificate($item->id, $admin->id, ['status' => 'draft']);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/pedigree/{$cert->id}/issue");

        $response->assertOk()
            ->assertJsonPath('data.status', 'issued');
        $this->assertDatabaseHas('pedigree_certificates', [
            'id' => $cert->id,
            'status' => 'issued',
        ]);
    }

    public function test_download_returns_pdf_content_type(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $cert = $this->makeCertificate($item->id, $admin->id, ['status' => 'issued']);

        $response = $this->actingAs($admin, 'sanctum')
            ->get("/api/admin/pedigree/{$cert->id}/download");

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $disposition = $response->headers->get('Content-Disposition');
        $this->assertStringContainsString("pedigree_{$cert->certificate_number}.pdf", (string) $disposition);
    }

    public function test_non_admin_user_cannot_access_pedigree(): void
    {
        $participant = $this->createParticipant();
        $item = $this->makeItem();

        $response = $this->actingAs($participant, 'sanctum')
            ->getJson("/api/admin/pedigree/{$item->id}");

        $response->assertStatus(403);
    }

    public function test_seller_cannot_access_other_users_pedigree(): void
    {
        $seller = $this->createSeller();
        $item = $this->makeItem();

        $response = $this->actingAs($seller, 'sanctum')
            ->getJson("/api/admin/pedigree/{$item->id}");

        $response->assertStatus(403);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/admin/pedigree/1');
        $response->assertStatus(401);
    }

    public function test_store_validates_required_fields(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['item_id', 'breed_name']);
    }

    public function test_issue_returns_404_for_missing_certificate(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree/999999/issue');

        $response->assertStatus(404);
    }

    public function test_number_is_assigned_at_issue_not_at_create(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();

        $created = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree', ['item_id' => $item->id, 'breed_name' => '楊貴妃'])
            ->assertStatus(201)
            ->assertJsonPath('data.verify_url', null);
        $this->assertStringStartsWith('DRAFT-', $created->json('data.certificate_number'));

        $issued = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree/' . $created->json('data.id') . '/issue')
            ->assertOk();
        $number = $issued->json('data.certificate_number');
        $this->assertMatchesRegularExpression('/^PD-\d{8}-[A-Z0-9]{6}$/', $number);
        $this->assertStringEndsWith('/pedigree/verify/' . $number, $issued->json('data.verify_url'));
    }

    public function test_store_rejects_second_certificate_for_same_item(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $this->makeCertificate($item->id, $admin->id);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pedigree', ['item_id' => $item->id, 'breed_name' => '楊貴妃']);

        $response->assertStatus(422)->assertJsonValidationErrors(['item_id']);
        $this->assertSame(1, PedigreeCertificate::where('item_id', $item->id)->count());
    }

    public function test_admin_can_update_draft(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $cert = $this->makeCertificate($item->id, $admin->id);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/pedigree/{$cert->id}", ['breed_name' => '幹之', 'fixation_rate' => 90]);

        $response->assertOk()->assertJsonPath('data.breed_name', '幹之');
        $this->assertDatabaseHas('pedigree_certificates', ['id' => $cert->id, 'breed_name' => '幹之']);
    }

    public function test_issued_certificate_cannot_be_updated_or_reissued(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $cert = $this->makeCertificate($item->id, $admin->id, ['status' => 'issued', 'issued_at' => now()]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/pedigree/{$cert->id}", ['breed_name' => '改ざん'])
            ->assertStatus(422);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/pedigree/{$cert->id}/issue")
            ->assertStatus(422);

        $this->assertDatabaseHas('pedigree_certificates', ['id' => $cert->id, 'breed_name' => '三色ラメ体外光']);
    }

    public function test_admin_can_revoke_issued_certificate_only(): void
    {
        $admin = $this->createAdmin();
        $draft = $this->makeCertificate($this->makeItem()->id, $admin->id);
        $issued = $this->makeCertificate($this->makeItem()->id, $admin->id, ['status' => 'issued', 'issued_at' => now()]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/pedigree/{$draft->id}/revoke")
            ->assertStatus(422);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/pedigree/{$issued->id}/revoke")
            ->assertOk()
            ->assertJsonPath('data.status', 'revoked');
    }

    public function test_verify_returns_issued_certificate_without_login(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        $cert = $this->makeCertificate($item->id, $admin->id, ['status' => 'issued', 'issued_at' => now()]);

        $response = $this->getJson('/api/pedigree/verify/' . strtolower($cert->certificate_number));

        $response->assertOk()
            ->assertJsonPath('data.certificate_number', $cert->certificate_number)
            ->assertJsonPath('data.status', 'issued')
            ->assertJsonPath('data.breed_name', '三色ラメ体外光')
            ->assertJsonMissingPath('data.issued_by')
            ->assertJsonMissingPath('data.breeding_notes');
    }

    public function test_verify_shows_revoked_status(): void
    {
        $admin = $this->createAdmin();
        $cert = $this->makeCertificate($this->makeItem()->id, $admin->id, ['status' => 'revoked', 'issued_at' => now()]);

        $this->getJson("/api/pedigree/verify/{$cert->certificate_number}")
            ->assertOk()
            ->assertJsonPath('data.status', 'revoked');
    }

    public function test_verify_hides_draft_and_unknown_numbers(): void
    {
        $admin = $this->createAdmin();
        $draft = $this->makeCertificate($this->makeItem()->id, $admin->id);

        $this->getJson("/api/pedigree/verify/{$draft->certificate_number}")->assertStatus(404);
        $this->getJson('/api/pedigree/verify/PD-20260101-XXXXXX')->assertStatus(404);
    }

    public function test_verify_is_404_when_feature_is_off(): void
    {
        config(['features.pedigree_certificate' => false]);
        $admin = $this->createAdmin();
        $cert = $this->makeCertificate($this->makeItem()->id, $admin->id, ['status' => 'issued', 'issued_at' => now()]);

        $this->getJson("/api/pedigree/verify/{$cert->certificate_number}")->assertStatus(404);
    }
}
