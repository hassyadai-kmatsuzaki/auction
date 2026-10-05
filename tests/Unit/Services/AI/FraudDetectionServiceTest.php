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

    private function insertBidEvent(int $itemId, int $userId, string $type, ?string $createdAt = null, ?string $userAgent = null): void
    {
        DB::table('bid_events')->insert([
            'item_id' => $itemId,
            'user_id' => $userId,
            'event_type' => $type,
            'price_at_event' => 1000,
            'user_agent' => $userAgent,
            'created_at' => $createdAt ?? now(),
        ]);
    }

    /**
     * 出品者の商品を $count 件売り、各商品で $bidder が最後まで競り合って（最後に自動離脱して）負けた状態を作る
     */
    private function makeRunnerUpItems(User $bidder, int $count, ?SellerProfile $seller = null): void
    {
        $winner = $this->createParticipant();
        for ($i = 0; $i < $count; $i++) {
            $item = $this->makeItem(['seller_profile_id' => ($seller ?? $this->sellerProfile)->id]);
            $this->insertBidEvent($item->id, $bidder->id, 'join');
            $this->insertBidEvent($item->id, $winner->id, 'join');
            $this->insertBidEvent($item->id, $bidder->id, 'leave');
            WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $winner->id]);
        }
    }

    /**
     * private の検知メソッドを ReflectionMethod で直接呼ぶ
     */
    private function callPrivate(string $method, array $args = [])
    {
        $ref = new \ReflectionMethod(FraudDetectionService::class, $method);
        $ref->setAccessible(true);
        return $ref->invoke($this->service, ...$args);
    }

    public function test_detectShillBidding_does_not_duplicate_alerts_on_rerun(): void
    {
        $this->makeRunnerUpItems($this->createParticipant(), 3);

        $first = $this->callPrivate('detectShillBidding', [$this->auction->id]);
        $second = $this->callPrivate('detectShillBidding', [$this->auction->id]);

        $this->assertCount(1, $first);
        $this->assertCount(0, $second);
        $this->assertSame(1, AIFraudAlert::where('auction_id', $this->auction->id)->count());
    }

    public function test_detectPriceManipulation_uses_confirmed_payments_as_baseline(): void
    {
        $winner = $this->createParticipant();
        $otherAuction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        for ($i = 0; $i < 3; $i++) {
            $past = Item::factory()->create([
                'auction_id' => $otherAuction->id,
                'seller_profile_id' => $this->sellerProfile->id,
                'species_name' => '基準メダカ',
            ]);
            WonItem::factory()->create([
                'item_id' => $past->id,
                'winning_price' => 1000,
                'payment_status' => 'confirmed',
            ]);
        }
        $item = $this->makeItem(['species_name' => '基準メダカ']);
        WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => 5000,
            'payment_status' => 'pending',
        ]);

        $alerts = $this->callPrivate('detectPriceManipulation', [$this->auction->id]);

        $this->assertCount(1, $alerts);
        $this->assertSame('price_manipulation', $alerts[0]->alert_type);
    }

    public function test_detectShillBidding_alerts_when_user_is_repeatedly_runner_up_for_one_seller(): void
    {
        $bidder = $this->createParticipant();
        $this->makeRunnerUpItems($bidder, 3);

        $alerts = $this->callPrivate('detectShillBidding', [$this->auction->id]);
        $this->assertCount(1, $alerts);
        $this->assertSame('medium', $alerts[0]->severity);
        $this->assertSame($bidder->id, $alerts[0]->user_id);

        AIFraudAlert::query()->delete();
        $this->makeRunnerUpItems($bidder, 2);
        $alerts = $this->callPrivate('detectShillBidding', [$this->auction->id]);
        $this->assertSame('high', $alerts[0]->severity);
    }

    public function test_detectShillBidding_ignores_leaves_that_did_not_reach_the_end(): void
    {
        // 自動離脱（指値到達）を何回しても、最後まで競り合っていなければ対象外
        $bidder = $this->createParticipant();
        $winner = $this->createParticipant();
        $other = $this->createParticipant();
        for ($i = 0; $i < 5; $i++) {
            $item = $this->makeItem();
            $this->insertBidEvent($item->id, $bidder->id, 'join');
            $this->insertBidEvent($item->id, $other->id, 'join');
            $this->insertBidEvent($item->id, $bidder->id, 'leave');
            $this->insertBidEvent($item->id, $other->id, 'leave');
            WonItem::factory()->create(['item_id' => $item->id, 'winner_id' => $winner->id]);
        }
        // 売れていない商品での離脱も対象外
        $unsold = $this->makeItem();
        for ($i = 0; $i < 5; $i++) {
            $this->insertBidEvent($unsold->id, $bidder->id, 'leave');
        }

        $alerts = $this->callPrivate('detectShillBidding', [$this->auction->id]);
        $this->assertSame([$other->id], array_map(fn ($a) => $a->user_id, $alerts));
    }

    public function test_detectShillBidding_skips_when_user_has_won_from_seller(): void
    {
        $bidder = $this->createParticipant();
        $this->makeRunnerUpItems($bidder, 5);

        $past = Item::factory()->create([
            'auction_id' => Auction::factory()->finished()->create(['created_by' => $this->admin->id])->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        WonItem::factory()->paid()->create(['item_id' => $past->id, 'winner_id' => $bidder->id]);

        $this->assertEmpty($this->callPrivate('detectShillBidding', [$this->auction->id]));
    }

    public function test_detectShillBidding_does_not_alert_below_threshold(): void
    {
        $this->makeRunnerUpItems($this->createParticipant(), 2);

        $this->assertEmpty($this->callPrivate('detectShillBidding', [$this->auction->id]));
    }

    public function test_detectShillBidding_skips_users_bidding_widely_across_sellers(): void
    {
        // 入札の半分以上が他の出品者 → 偏りなしとして対象外
        $bidder = $this->createParticipant();
        $this->makeRunnerUpItems($bidder, 3);
        $otherSeller = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        for ($i = 0; $i < 4; $i++) {
            $item = $this->makeItem(['seller_profile_id' => $otherSeller->id]);
            $this->insertBidEvent($item->id, $bidder->id, 'join');
        }

        $this->assertEmpty($this->callPrivate('detectShillBidding', [$this->auction->id]));
    }

    public function test_detectShillBidding_excludes_house_buyer_and_test_users(): void
    {
        $house = $this->createParticipant();
        config(['services.ai.house_buyer_ids' => [$house->id]]);
        $tester = $this->createParticipant();
        $tester->forceFill(['is_test' => true])->save();
        $this->makeRunnerUpItems($house, 5);
        $this->makeRunnerUpItems($tester, 5);

        $this->assertEmpty($this->callPrivate('detectShillBidding', [$this->auction->id]));
    }

    public function test_detectBidPatternAnomalies_counts_consecutive_manual_bids_only(): void
    {
        $fast = $this->createParticipant();
        $auto = $this->createParticipant();
        $base = now()->startOfMinute();
        for ($i = 0; $i < 6; $i++) {
            $item = $this->makeItem();
            $at = $base->copy()->addSeconds($i)->toDateTimeString();
            $this->insertBidEvent($item->id, $fast->id, 'join', $at, 'Mozilla/5.0');
            // 指値からの自動入札は本人操作ではないので数えない
            $this->insertBidEvent($item->id, $auto->id, 'join', $at, 'auto-bid-from-limit');
        }

        $alerts = $this->callPrivate('detectBidPatternAnomalies', [$this->auction->id]);

        $this->assertSame([$fast->id], array_map(fn ($a) => $a->user_id, $alerts));
        $this->assertSame(5, $alerts[0]->evidence['rapid_bid_count']);
    }

    public function test_detectBidPatternAnomalies_ignores_spaced_bids_and_other_auctions(): void
    {
        $user = $this->createParticipant();
        $base = now()->startOfMinute();
        $other = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        for ($i = 0; $i < 6; $i++) {
            // この開催では 5 秒おき
            $this->insertBidEvent($this->makeItem()->id, $user->id, 'join', $base->copy()->addSeconds($i * 5)->toDateTimeString());
            // 別開催の連打は対象外
            $otherItem = Item::factory()->create(['auction_id' => $other->id, 'seller_profile_id' => $this->sellerProfile->id]);
            $this->insertBidEvent($otherItem->id, $user->id, 'join', $base->copy()->addSeconds($i * 5 + 1)->toDateTimeString());
        }

        $this->assertEmpty($this->callPrivate('detectBidPatternAnomalies', [$this->auction->id]));
    }

    public function test_detectPriceManipulation_baseline_ignores_house_buyer_and_test_auctions(): void
    {
        $house = $this->createParticipant();
        config(['services.ai.house_buyer_ids' => [$house->id]]);
        $species = '基準外メダカ';
        $testAuction = Auction::factory()->finished()->create(['created_by' => $this->admin->id, 'is_test' => true]);
        $normal = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        // 下支えの安値とテスト開催の安値だけが過去データ → 基準なし
        foreach ([[$normal, $house->id], [$testAuction, null], [$testAuction, null]] as [$auction, $winnerId]) {
            $past = Item::factory()->create(['auction_id' => $auction->id, 'seller_profile_id' => $this->sellerProfile->id, 'species_name' => $species]);
            WonItem::factory()->paid()->create(array_filter(['item_id' => $past->id, 'winning_price' => 500, 'winner_id' => $winnerId]));
        }
        $item = $this->makeItem(['species_name' => $species]);
        WonItem::factory()->paid()->create(['item_id' => $item->id, 'winning_price' => 5000]);

        $this->assertEmpty($this->callPrivate('detectPriceManipulation', [$this->auction->id]));
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
