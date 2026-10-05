<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

class ReportCustomRangeTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
    }

    private function won(string $at, int $price): WonItem
    {
        $auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id, 'event_date' => substr($at, 0, 10), 'is_test' => false]);
        $item = Item::factory()->sold()->create(['auction_id' => $auction->id, 'seller_profile_id' => $this->sellerProfile->id, 'species_name' => '紅白']);

        return WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => $price,
            'quantity' => 1,
            'payment_status' => 'confirmed',
            'created_at' => $at,
        ]);
    }

    public function test_custom_range_includes_both_end_days(): void
    {
        $this->won('2026-08-31 23:00:00', 900);   // 範囲外（前日）
        $this->won('2026-09-01 10:00:00', 1000);  // 開始日
        $this->won('2026-09-15 23:59:00', 2000);  // 終了日
        $this->won('2026-09-16 00:01:00', 4000);  // 範囲外（翌日）

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/custom?start_date=2026-09-01&end_date=2026-09-15')
            ->assertOk()
            ->assertJsonPath('data.report_type', 'custom')
            ->assertJsonPath('data.transaction_summary.total_transactions', 2);

        $this->assertEquals(3000, $res->json('data.transaction_summary.total_sales'));
        $this->assertStringStartsWith('2026-09-01', $res->json('data.period.start'));
        $this->assertStringStartsWith('2026-09-15', $res->json('data.period.end'));
    }

    public function test_end_date_before_start_date_is_rejected(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/custom?start_date=2026-09-15&end_date=2026-09-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('end_date');
    }

    public function test_range_longer_than_a_year_is_rejected(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/reports/custom?start_date=2025-01-01&end_date=2026-09-01')
            ->assertStatus(422)
            ->assertJsonPath('message', '期間は1年以内で指定してください。');
    }

    public function test_requires_admin(): void
    {
        $this->actingAs($this->createParticipant(), 'sanctum')
            ->getJson('/api/admin/reports/custom?start_date=2026-09-01&end_date=2026-09-15')
            ->assertStatus(403);
    }
}
