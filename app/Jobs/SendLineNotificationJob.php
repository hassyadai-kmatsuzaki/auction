<?php

namespace App\Jobs;

use App\Services\LineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendLineNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(
        public int    $userId,
        public string $notificationType,
        public string $text,
        public ?array $flexContent = null,
    ) {
        $this->onQueue('notify');
    }

    public function handle(LineService $lineService): void
    {
        $lineService->notify($this->userId, $this->notificationType, $this->text, $this->flexContent);
    }
}
