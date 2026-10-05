<?php

namespace Tests\Feature\Api;

use App\Models\Auction;
use App\Models\Item;
use App\Models\PedigreeCertificate;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * 落札者マイページからの血統証明書（発行済みのみ・本人のみ）
 */
class PedigreeCertificateParticipantTest extends TestCase
{
    private User $buyer;
    private Item $item;
    private WonItem $wonItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['features.pedigree_certificate' => true]);

        $this->buyer = $this->createParticipant();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $this->item = Item::factory()->create([
            'auction_id' => Auction::factory()->finished()->create()->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $this->wonItem = WonItem::factory()->create([
            'item_id' => $this->item->id,
            'winner_id' => $this->buyer->id,
        ]);
    }

    private function makeCertificate(string $status): PedigreeCertificate
    {
        return PedigreeCertificate::create([
            'item_id' => $this->item->id,
            'issued_by' => $this->createAdmin()->id,
            'certificate_number' => $status === 'draft' ? 'DRAFT-test' : 'PD-20261001-ABC123',
            'breed_name' => '紅薊',
            'status' => $status,
            'issued_at' => $status === 'draft' ? null : now(),
        ]);
    }

    private function wonItemFlag(): mixed
    {
        $response = $this->actingAs($this->buyer, 'sanctum')->getJson('/api/participant/won-items')->assertOk();

        return $response->json('data.auctions.0.won_items.0.has_pedigree_certificate');
    }

    public function test_won_items_flag_is_true_only_for_issued_certificate(): void
    {
        $this->assertFalse($this->wonItemFlag());

        $cert = $this->makeCertificate('draft');
        $this->assertFalse($this->wonItemFlag());

        $cert->update(['status' => 'issued', 'certificate_number' => 'PD-20261001-ABC123', 'issued_at' => now()]);
        $this->assertTrue($this->wonItemFlag());

        $cert->update(['status' => 'revoked']);
        $this->assertFalse($this->wonItemFlag());
    }

    public function test_winner_gets_signed_link_and_pdf_opens(): void
    {
        $this->makeCertificate('issued');

        $url = $this->actingAs($this->buyer, 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}/pedigree-certificate-link")
            ->assertOk()
            ->json('data.url');

        $response = $this->get($url);
        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('inline; filename="pedigree_PD-20261001-ABC123.pdf"', (string) $response->headers->get('Content-Disposition'));
    }

    public function test_link_is_404_for_draft_or_revoked(): void
    {
        $cert = $this->makeCertificate('draft');
        $this->actingAs($this->buyer, 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}/pedigree-certificate-link")
            ->assertStatus(404);

        $cert->update(['status' => 'revoked', 'certificate_number' => 'PD-20261001-ABC123']);
        $this->actingAs($this->buyer, 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}/pedigree-certificate-link")
            ->assertStatus(404);
    }

    public function test_other_participant_cannot_get_link(): void
    {
        $this->makeCertificate('issued');

        $this->actingAs($this->createParticipant(), 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}/pedigree-certificate-link")
            ->assertStatus(404);
    }

    public function test_pdf_requires_valid_signature(): void
    {
        $cert = $this->makeCertificate('issued');

        $this->get("/api/pedigree/certificates/{$cert->id}/pdf")->assertStatus(403);

        $expired = URL::temporarySignedRoute('pedigree.signed-pdf', now()->subMinute(), ['id' => $cert->id]);
        $this->get($expired)->assertStatus(403);
    }

    public function test_signed_pdf_is_404_after_revoke(): void
    {
        $cert = $this->makeCertificate('issued');
        $url = URL::temporarySignedRoute('pedigree.signed-pdf', now()->addMinutes(10), ['id' => $cert->id]);

        $cert->update(['status' => 'revoked']);

        $this->get($url)->assertStatus(404);
    }

    public function test_everything_is_hidden_when_feature_is_off(): void
    {
        $cert = $this->makeCertificate('issued');
        $url = URL::temporarySignedRoute('pedigree.signed-pdf', now()->addMinutes(10), ['id' => $cert->id]);
        config(['features.pedigree_certificate' => false]);

        $this->assertFalse($this->wonItemFlag());
        $this->actingAs($this->buyer, 'sanctum')
            ->getJson("/api/participant/won-items/{$this->wonItem->id}/pedigree-certificate-link")
            ->assertStatus(404);
        $this->get($url)->assertStatus(404);
    }
}
