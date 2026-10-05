<?php

namespace Tests\Unit\Console;

use App\Models\Auction;
use App\Services\AI\FraudDetectionService;
use Tests\TestCase;

class DetectFraudCommandTest extends TestCase
{
    private array $analyzed = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        $this->app->instance(FraudDetectionService::class, new class($this->analyzed) extends FraudDetectionService {
            public function __construct(private array &$analyzed) {}
            public function analyzeAuction(int $auctionId): array
            {
                if ($auctionId === 999999) {
                    throw new \RuntimeException('boom');
                }
                $this->analyzed[] = $auctionId;
                return [];
            }
        });
    }

    public function test_targets_only_recent_finished_production_auctions(): void
    {
        config(['services.ai.excluded_auction_ids' => []]);
        $recent = Auction::factory()->finished()->create(['event_date' => now()->subDays(2)]);
        Auction::factory()->finished()->create(['event_date' => now()->subDays(30)]);  // 古い
        Auction::factory()->live()->create(['event_date' => now()]);                    // 未終了
        Auction::factory()->finished()->create(['event_date' => now()->subDay(), 'is_test' => true]); // テスト開催

        $this->artisan('ai:detect-fraud')->assertExitCode(0);

        $this->assertSame([$recent->id], $this->analyzed);
    }

    public function test_respects_excluded_auction_ids(): void
    {
        $excluded = Auction::factory()->finished()->create(['event_date' => now()->subDay()]);
        config(['services.ai.excluded_auction_ids' => [$excluded->id]]);

        $this->artisan('ai:detect-fraud')->assertExitCode(0);

        $this->assertSame([], $this->analyzed);
    }

    public function test_one_failure_does_not_stop_others(): void
    {
        $this->artisan('ai:detect-fraud', ['--auction' => 999999])->assertExitCode(0);

        $ok = Auction::factory()->finished()->create(['event_date' => now()->subDay()]);
        config(['services.ai.excluded_auction_ids' => []]);
        $this->artisan('ai:detect-fraud')->assertExitCode(0);

        $this->assertSame([$ok->id], $this->analyzed);
    }
}
