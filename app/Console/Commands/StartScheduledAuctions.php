<?php

namespace App\Console\Commands;

use App\Actions\Auction\StartAuctionAction;
use App\Models\Auction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class StartScheduledAuctions extends Command
{
    protected $signature = 'auctions:start-scheduled';

    protected $description = '予定されたオークションを自動的に開始する';

    public function handle(StartAuctionAction $startAuctionAction): int
    {
        $now = now();

        $auctions = Auction::where('status', 'scheduled')
            ->whereDate('event_date', $now->toDateString())
            ->whereTime('start_time', '<=', $now->toTimeString())
            ->whereHas('items', fn ($q) => $q->where('status', 'registered'))
            ->get();

        if ($auctions->isEmpty()) {
            $this->info('開始対象のオークションはありません。');
            return 0;
        }

        $started = 0;
        foreach ($auctions as $auction) {
            try {
                $startAuctionAction->execute($auction);
                $started++;
                $this->info("オークション #{$auction->id}「{$auction->title}」を開始しました。");
                Log::info("Scheduled auction started: id={$auction->id}, title={$auction->title}");
            } catch (\Exception $e) {
                $this->error("オークション #{$auction->id} の開始に失敗: {$e->getMessage()}");
                Log::error("Failed to start scheduled auction: id={$auction->id}, error={$e->getMessage()}");
            }
        }

        $this->info("開始されたオークション: {$started}/{$auctions->count()}件");

        return 0;
    }
}
