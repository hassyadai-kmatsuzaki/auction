<?php

namespace App\Console\Commands;

use App\Models\Auction;
use Illuminate\Console\Command;

class StartScheduledAuctions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auctions:start-scheduled';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '予定されたオークションを自動的に開始する';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $now = now();
        
        $count = Auction::where('status', 'scheduled')
            ->whereDate('event_date', $now->toDateString())
            ->whereTime('start_time', '<=', $now->toTimeString())
            ->where(function ($query) {
                $query->whereHas('items');
            })
            ->update(['status' => 'live']);

        $this->info("開始されたオークション: {$count}件");
        
        return 0;
    }
}
