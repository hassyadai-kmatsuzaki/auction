<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Models\Lane;
use App\Services\CountdownService;
use App\Jobs\ProcessCountdownJob;
use Illuminate\Console\Command;

class StartCountdownCommand extends Command
{
    protected $signature = 'countdown:start {auction_id?}';
    protected $description = 'Start countdown for all active lanes in a live auction';

    public function handle(CountdownService $countdownService): int
    {
        $auctionId = $this->argument('auction_id');

        if ($auctionId) {
            $auctions = Auction::where('id', $auctionId)->where('status', 'live')->get();
        } else {
            $auctions = Auction::where('status', 'live')->get();
        }

        if ($auctions->isEmpty()) {
            $this->error('No live auctions found.');
            return 1;
        }

        foreach ($auctions as $auction) {
            $this->info("Processing auction: {$auction->id} - {$auction->title}");

            $lanes = $auction->lanes()
                ->whereIn('status', ['active', 'waiting'])
                ->whereNotNull('current_item_id')
                ->get();

            foreach ($lanes as $lane) {
                $lane->load(['auction', 'currentItem']);
                
                if ($lane->currentItem && $lane->currentItem->status === 'live') {
                    // 既存のカウントダウンを停止
                    $countdownService->stopCountdown($lane->id);
                    
                    // 新しいカウントダウンを開始
                    $countdownService->startCountdown($lane);
                    ProcessCountdownJob::dispatch($lane->id);
                    
                    $this->info("  Started countdown for Lane {$lane->lane_number} (ID: {$lane->id}), Item: {$lane->currentItem->species_name}");
                } else {
                    $this->warn("  Lane {$lane->lane_number} (ID: {$lane->id}) has no live item");
                }
            }
        }

        $this->info('Done!');
        return 0;
    }
}
