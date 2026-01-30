<?php

namespace App\Console\Commands;

use App\Models\Announcement;
use Illuminate\Console\Command;

class PublishScheduledAnnouncements extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'announcements:publish-scheduled';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '公開予約されたお知らせを自動的に公開する';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $count = Announcement::where('status', 'scheduled')
            ->where('published_at', '<=', now())
            ->whereNull('deleted_at')
            ->update(['status' => 'published']);

        $this->info("公開されたお知らせ: {$count}件");
        
        return 0;
    }
}
