<?php

namespace Tests\Unit\Console;

use App\Actions\Auction\StartAuctionAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use Tests\TestCase;

class StartScheduledAuctionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        // 副作用（broadcast / queue / cache）を避けるため StartAuctionAction をモックし、
        // 「呼ばれたら status を live に更新する」という最小実装で置き換える
        $this->app->bind(StartAuctionAction::class, function () {
            return new class extends StartAuctionAction {
                public function execute(Auction $auction): void
                {
                    $auction->update(['status' => 'live']);
                }
            };
        });
    }

    private function makeAuctionWithRegisteredItem(array $auctionAttrs = []): Auction
    {
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $auction = Auction::factory()->create(array_merge([
            'status' => 'scheduled',
            'event_date' => now()->toDateString(),
            'start_time' => now()->subMinutes(5)->format('H:i:s'),
        ], $auctionAttrs));

        Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
            'status' => 'registered',
        ]);

        return $auction;
    }

    public function test_command_exits_with_zero_when_no_targets(): void
    {
        $this->artisan('auctions:start-scheduled')
            ->expectsOutput('開始対象のオークションはありません。')
            ->assertExitCode(0);
    }

    public function test_command_starts_auction_when_event_time_reached(): void
    {
        $auction = $this->makeAuctionWithRegisteredItem();

        $this->artisan('auctions:start-scheduled')->assertExitCode(0);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'live',
        ]);
    }

    public function test_command_does_not_start_future_auction(): void
    {
        $auction = $this->makeAuctionWithRegisteredItem([
            'event_date' => now()->addDays(2)->toDateString(),
            'start_time' => '10:00:00',
        ]);

        $this->artisan('auctions:start-scheduled')->assertExitCode(0);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'scheduled',
        ]);
    }

    public function test_command_does_not_start_auction_before_start_time_today(): void
    {
        $auction = $this->makeAuctionWithRegisteredItem([
            'event_date' => now()->toDateString(),
            'start_time' => now()->addHour()->format('H:i:s'),
        ]);

        $this->artisan('auctions:start-scheduled')->assertExitCode(0);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'scheduled',
        ]);
    }

    public function test_command_is_idempotent_for_already_live_auctions(): void
    {
        $auction = $this->makeAuctionWithRegisteredItem();
        $auction->update(['status' => 'live']);

        // StartAuctionAction が二重実行されないことを確認するため、
        // execute を呼ばれたらカウントするスパイに差し替える
        $callCount = 0;
        $this->app->bind(StartAuctionAction::class, function () use (&$callCount) {
            return new class($callCount) extends StartAuctionAction {
                public function __construct(private int &$count) {}
                public function execute(Auction $auction): void
                {
                    $this->count++;
                    $auction->update(['status' => 'live']);
                }
            };
        });

        $this->artisan('auctions:start-scheduled')->assertExitCode(0);

        $this->assertSame(0, $callCount, 'live状態のauctionにはStartAuctionActionが呼ばれない');
        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'live',
        ]);
    }

    public function test_command_skips_auctions_without_registered_items(): void
    {
        // 登録済アイテムなしの auction を作成（whereHas で除外される）
        $auction = Auction::factory()->create([
            'status' => 'scheduled',
            'event_date' => now()->toDateString(),
            'start_time' => now()->subMinutes(5)->format('H:i:s'),
        ]);

        $this->artisan('auctions:start-scheduled')->assertExitCode(0);

        $this->assertDatabaseHas('auctions', [
            'id' => $auction->id,
            'status' => 'scheduled',
        ]);
    }
}
