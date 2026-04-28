<?php

namespace Tests\Unit\Services\AI;

use App\Models\AIFraudAlert;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\AI\FraudDetectionService;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FraudDetectionServiceTest extends TestCase
{
    private FraudDetectionService $service;
    private Auction $auction;
    private SellerProfile $sellerProfile;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->service = new FraudDetectionService();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
    }

    private function makeItem(array $overrides = []): Item
    {
        return Item::factory()->create(array_merge([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ], $overrides));
    }

    private function insertBidEvent(int $itemId, int $userId, string $type, ?string $createdAt = null): void
    {
        DB::table('bid_events')->insert([
            'item_id' => $itemId,
            'user_id' => $userId,
            'event_type' => $type,
            'price_at_event' => 1000,
            'created_at' => $createdAt ?? now(),
        ]);
    }

    /**
     * detectShillBidding を ReflectionMethod で直接呼ぶ。
     * detectBidPatternAnomalies は TIMESTAMPDIFF を使うため SQLite では実行不可。
     */
    private function callPrivate(string $method, array $args = [])
    {
        $ref = new \ReflectionMethod(FraudDetectionService::class, $method);
        $ref->setAccessible(true);
        return $ref->invoke($this->service, ...$args);
    }

    public function test_detectShillBidding_creates_alert_with_repeated_leaves_and_no_wins(): void
    {
        $item = $this->makeItem();
        $bidder = $this->createParticipant();

        for ($i = 0; $i < 5; $i++) {
            $this->insertBidEvent($item->id, $bidder->id, 'leave');
        }

        $alerts = $this->callPrivate('detectShillBidding', [$this->auction->id]);

        $this->assertNotEmpty($alerts);
        $this->assertDatabaseHas('ai_fraud_alerts', [
            'auction_id' => $this->auction->id,
            'alert_type' => 'shill_bidding',
            'severity' => 'high',
        ]);
    }

    public function test_detectShillBidding_skips_when_user_has_won_from_seller(): void
    {
        $item = $this->makeItem();
        $bidder = $this->createParticipant();

        for ($i = 0; $i < 5; $i++) {
            $this->insertBidEvent($item->id, $bidder->id, 'leave');
        }

        WonItem::factory()->paid()->create([
            'item_id' => $item->id,
            'winner_id' => $bidder->id,
        ]);

        $alerts = $this->callPrivate('detectShillBidding', [$this->auction->id]);
        $this->assertEmpty($alerts);
    }

    public function test_detectShillBidding_does_not_alert_below_threshold(): void
    {
        $item = $this->makeItem();
        $bidder = $this->createParticipant();

        // 2回のみ（閾値3未満）
        $this->insertBidEvent($item->id, $bidder->id, 'leave');
        $this->insertBidEvent($item->id, $bidder->id, 'leave');

        $alerts = $this->callPrivate('detectShillBidding', [$this->auction->id]);
        $this->assertEmpty($alerts);
    }

    public function test_detectPriceManipulation_creates_alert_when_winning_price_is_3x_average(): void
    {
        $species = 'TEST_SPECIES_X';

        $otherAuction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        for ($i = 0; $i < 3; $i++) {
            $otherItem = Item::factory()->create([
                'auction_id' => $otherAuction->id,
                'seller_profile_id' => $this->sellerProfile->id,
                'species_name' => $species,
            ]);
            WonItem::factory()->paid()->create([
                'item_id' => $otherItem->id,
                'winning_price' => 10000,
            ]);
        }

        $item = $this->makeItem(['species_name' => $species]);
        WonItem::factory()->paid()->create([
            'item_id' => $item->id,
            'winning_price' => 50000,
        ]);

        $alerts = $this->callPrivate('detectPriceManipulation', [$this->auction->id]);

        $this->assertNotEmpty($alerts);
        $this->assertDatabaseHas('ai_fraud_alerts', [
            'auction_id' => $this->auction->id,
            'alert_type' => 'price_manipulation',
            'severity' => 'high',
        ]);
    }

    public function test_detectPriceManipulation_does_not_alert_when_within_normal_range(): void
    {
        $species = 'TEST_SPECIES_Y';

        $otherAuction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        for ($i = 0; $i < 3; $i++) {
            $otherItem = Item::factory()->create([
                'auction_id' => $otherAuction->id,
                'seller_profile_id' => $this->sellerProfile->id,
                'species_name' => $species,
            ]);
            WonItem::factory()->paid()->create([
                'item_id' => $otherItem->id,
                'winning_price' => 10000,
            ]);
        }

        $item = $this->makeItem(['species_name' => $species]);
        WonItem::factory()->paid()->create([
            'item_id' => $item->id,
            'winning_price' => 12000, // 平均の1.2倍（3倍以下）
        ]);

        $alerts = $this->callPrivate('detectPriceManipulation', [$this->auction->id]);
        $this->assertEmpty($alerts);
    }

    public function test_getAlerts_returns_paginator(): void
    {
        AIFraudAlert::create([
            'auction_id' => $this->auction->id,
            'alert_type' => 'bid_pattern',
            'severity' => 'low',
            'status' => 'open',
            'description' => 'a',
            'evidence' => [],
        ]);

        $result = $this->service->getAlerts();
        $this->assertInstanceOf(\Illuminate\Contracts\Pagination\LengthAwarePaginator::class, $result);
        $this->assertSame(1, $result->total());
    }

    public function test_getAlerts_filters_by_status_and_severity(): void
    {
        AIFraudAlert::create([
            'auction_id' => $this->auction->id,
            'alert_type' => 'bid_pattern',
            'severity' => 'high',
            'status' => 'open',
            'description' => 'a',
            'evidence' => [],
        ]);
        AIFraudAlert::create([
            'auction_id' => $this->auction->id,
            'alert_type' => 'bid_pattern',
            'severity' => 'low',
            'status' => 'resolved',
            'description' => 'b',
            'evidence' => [],
        ]);

        $result = $this->service->getAlerts(['status' => 'resolved']);
        $this->assertSame(1, $result->total());

        $result2 = $this->service->getAlerts(['severity' => 'high']);
        $this->assertSame(1, $result2->total());
    }
}
