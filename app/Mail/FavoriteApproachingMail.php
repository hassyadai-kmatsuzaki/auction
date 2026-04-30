<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class FavoriteApproachingMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public function __construct(
        public string $speciesName,
        public int    $aheadCount,
        public string $laneName,
        public string $auctionTitle,
        public string $userName,
    ) {
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: "【まもなく出番】お気に入りの{$this->speciesName}があと{$this->aheadCount}つで出品されます");
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        return <<<HTML
        <h2>⏰ お気に入り生体の出番が近づいています</h2>
        <p>{$this->userName} 様</p>
        <p>お気に入りに登録した <strong>{$this->speciesName}</strong> の出番まであと <strong>{$this->aheadCount}つ</strong> です！</p>
        <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #ddd">オークション</td><td style="padding:8px;border:1px solid #ddd">{$this->auctionTitle}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">レーン</td><td style="padding:8px;border:1px solid #ddd">{$this->laneName}</td></tr>
        </table>
        <p>入札の準備をしてお待ちください。</p>
        HTML;
    }
}
