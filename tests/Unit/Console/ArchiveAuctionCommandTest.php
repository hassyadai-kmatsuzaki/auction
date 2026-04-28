<?php

namespace Tests\Unit\Console;

use App\Actions\Auction\ArchiveAuctionAction;
use App\Actions\Auction\UnarchiveAuctionAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use Tests\TestCase;

class ArchiveAuctionCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        // ArchiveAuctionAction を「副作用なしで成功を返す」スタブに差し替え
        $this->app->bind(ArchiveAuctionAction::class, function () {
            return new class extends ArchiveAuctionAction {
                public function execute(Auction $auction, array $options = []): array
                {
                    return [
                        'success' => true,
                        'message' => 'archived',
                        'counts' => ['bid_events_archive' => 0],
                        'dry_run' => (bool) ($options['dry_run'] ?? false),
                    ];
                }
            };
        });

        $this->app->bind(UnarchiveAuctionAction::class, function () {
            return new class extends UnarchiveAuctionAction {
                public function execute(int $auctionId, array $options = []): array
                {
                    return [
                        'success' => true,
                        'message' => 'unarchived',
                        'counts' => [],
                    ];
                }
            };
        });
    }

    private function makeFinishedAuction(?\DateTimeInterface $updatedAt = null): Auction
    {
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $auction = Auction::factory()->create([
            'status' => 'finished',
            'event_date' => now()->subDays(30)->toDateString(),
        ]);

        Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
            'status' => 'sold',
        ]);

        if ($updatedAt) {
            // 経過日数を制御するため updated_at を直接書き換える
            Auction::withoutEvents(function () use ($auction, $updatedAt) {
                $auction->forceFill(['updated_at' => $updatedAt])->save();
            });
        }

        return $auction->fresh();
    }

    public function test_command_reports_zero_when_no_targets(): void
    {
        $this->artisan('auction:archive')
            ->expectsOutputToContain('対象オークションはありません')
            ->assertExitCode(0);
    }

    public function test_command_archives_finished_auctions_older_than_days(): void
    {
        $this->makeFinishedAuction(now()->subDays(10));

        $this->artisan('auction:archive', ['--days' => 7])
            ->assertExitCode(0);
    }

    public function test_command_skips_recently_finished_auctions(): void
    {
        // updated_at が閾値より新しい finished は対象外
        $this->makeFinishedAuction(now()->subDays(2));

        $this->artisan('auction:archive', ['--days' => 7])
            ->expectsOutputToContain('対象オークションはありません')
            ->assertExitCode(0);
    }

    public function test_command_supports_single_auction_id(): void
    {
        $auction = $this->makeFinishedAuction(now()->subDays(10));

        $this->artisan('auction:archive', ['auction_id' => $auction->id])
            ->assertExitCode(0);
    }

    public function test_unarchive_requires_auction_id(): void
    {
        $this->artisan('auction:archive', ['--unarchive' => true])
            ->expectsOutputToContain('--unarchive はオークションIDが必須です')
            ->assertExitCode(1);
    }

    public function test_unarchive_with_id_succeeds(): void
    {
        $auction = $this->makeFinishedAuction(now()->subDays(10));

        $this->artisan('auction:archive', [
            'auction_id' => $auction->id,
            '--unarchive' => true,
        ])->assertExitCode(0);
    }
}
