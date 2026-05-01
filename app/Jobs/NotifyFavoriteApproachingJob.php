<?php

namespace App\Jobs;

use App\Actions\Line\NotifyFavoriteApproachingAction;
use App\Models\Item;
use App\Models\Lane;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class NotifyFavoriteApproachingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(
        public Lane $lane,
        public Item $currentItem,
    ) {
        $this->onQueue('notify');
    }

    public function handle(NotifyFavoriteApproachingAction $action): void
    {
        $action->execute($this->lane, $this->currentItem);
    }
}
