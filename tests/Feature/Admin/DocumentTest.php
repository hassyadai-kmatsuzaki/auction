<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * Admin/DocumentController の追加カバレッジ。
 *
 * - 認可・認証境界
 * - 構造アサート
 * - WonItem / SellerProfile 連動の表示と issued_at / transfer_scheduled
 * - フィルタの絞り込み
 */
class DocumentTest extends TestCase
{
    private User $admin;
    private User $winner;
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->winner = $this->createParticipant();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
    }

    private function makeWon(array $override = [], ?Auction $auction = null, ?SellerProfile $seller = null): WonItem
    {
        $auction = $auction ?? $this->auction;
        $seller = $seller ?? $this->sellerProfile;

        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $seller->id,
        ]);
        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->winner->id,
            'total_amount' => 10000,
            'commission_amount' => 500,
            'seller_amount' => 9500,
            'shipping_fee' => 600,
            'payment_status' => 'pending',
        ], $override));
    }

    public function test_invoices_returns_expected_structure(): void
    {
        $this->makeWon();

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/invoices');

        $r->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => [
                        'auction_id',
                        'winner_id',
                        'invoice_number',
                        'buyer' => ['id', 'name', 'email'],
                        'auction',
                        'items_count',
                        'total_amount',
                        'status',
                        'issued_at',
                    ],
                ],
            ]);
    }

    public function test_payment_notices_includes_transfer_scheduled_after_event_date(): void
    {
        $this->makeWon();

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/payment-notices');

        $r->assertOk();
        $row = $r->json('data.0');
        $this->assertNotNull($row['transfer_scheduled']);
        $this->assertSame(
            $this->auction->event_date->copy()->addDays(7)->format('Y-m-d'),
            $row['transfer_scheduled']
        );
        $this->assertStringStartsWith('PAY-A', $row['notice_number']);
    }

    public function test_payment_notices_filtered_by_auction_id(): void
    {
        $this->makeWon();
        $other = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->makeWon([], $other);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/documents/payment-notices?auction_id={$this->auction->id}");

        $r->assertOk();
        $rows = $r->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($this->auction->id, $rows[0]['auction_id']);
    }

    public function test_delivery_notes_filtered_by_auction_id(): void
    {
        $this->makeWon();
        $other = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->makeWon([], $other);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/documents/delivery-notes?auction_id={$other->id}");

        $r->assertOk();
        $rows = $r->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($other->id, $rows[0]['auction_id']);
        $this->assertStringStartsWith('DLV-A', $rows[0]['delivery_note_number']);
    }

    public function test_invoices_returns_empty_data_when_no_won_items(): void
    {
        $r = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/documents/invoices');

        $r->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data', []);
    }

    public function test_seller_cannot_access_documents(): void
    {
        $seller = $this->createSeller();
        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/admin/documents/payment-notices')
            ->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_delivery_notes(): void
    {
        $this->getJson('/api/admin/documents/delivery-notes')
            ->assertStatus(401);
    }
}
