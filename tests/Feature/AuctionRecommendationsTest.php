<?php

namespace Tests\Feature;

use App\Jobs\GenerateAuctionRecommendationsJob;
use App\Models\Auction;
use App\Models\EscrowTransaction;
use App\Services\AI\RecommendationService;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

/**
 * F-057 公開時のおすすめ作成（作成のみ）／F-032 エスクロー状況（閲覧のみ）
 */
class AuctionRecommendationsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    private function publish(Auction $auction)
    {
        return $this->actingAs($this->createAdmin(), 'sanctum')
            ->patchJson("/api/admin/auctions/{$auction->id}/status", ['status' => 'scheduled']);
    }

    public function test_publishing_dispatches_generation_only_when_feature_on(): void
    {
        Queue::fake();
        $this->publish(Auction::factory()->preparing()->create())->assertOk();
        Queue::assertNotPushed(GenerateAuctionRecommendationsJob::class);

        config(['features.recommendations' => true]);
        $this->publish(Auction::factory()->preparing()->create())->assertOk();
        Queue::assertPushed(GenerateAuctionRecommendationsJob::class);
    }

    public function test_job_generates_for_recently_active_production_participants(): void
    {
        config(['features.recommendations' => true, 'services.ai.house_buyer_ids' => []]);
        $auction = Auction::factory()->scheduled()->create(['is_test' => false]);
        $active = $this->createParticipant();
        $active->forceFill(['last_login_at' => now()->subDays(3), 'is_test' => false])->save();
        $dormant = $this->createParticipant();
        $dormant->forceFill(['last_login_at' => now()->subYears(2), 'is_test' => false])->save();
        $tester = $this->createParticipant();
        $tester->forceFill(['last_login_at' => now(), 'is_test' => true])->save();

        $called = [];
        $mock = Mockery::mock(RecommendationService::class);
        $mock->shouldReceive('generateRecommendations')->andReturnUsing(function ($user) use (&$called) {
            $called[] = $user->id;
            return [];
        });

        (new GenerateAuctionRecommendationsJob($auction->id))->handle($mock);

        $this->assertSame([$active->id], $called);
    }

    public function test_job_waits_while_an_auction_is_live(): void
    {
        config(['features.recommendations' => true]);
        Queue::fake();
        Auction::factory()->live()->create();
        $auction = Auction::factory()->scheduled()->create();
        $mock = Mockery::mock(RecommendationService::class);
        $mock->shouldNotReceive('generateRecommendations');

        (new GenerateAuctionRecommendationsJob($auction->id))->handle($mock);

        Queue::assertPushed(GenerateAuctionRecommendationsJob::class, fn ($j) => $j->delay !== null);
    }

    public function test_escrow_list_includes_auction_title(): void
    {
        $escrow = EscrowTransaction::factory()->create();

        $this->actingAs($this->createAdmin(), 'sanctum')->getJson('/api/admin/escrow')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $escrow->id)
            ->assertJsonPath('data.data.0.won_item.item.auction.title', $escrow->wonItem->item->auction->title);
    }
}
