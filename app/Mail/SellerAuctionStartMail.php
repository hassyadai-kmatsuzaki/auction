<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\Auction;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SellerAuctionStartMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public function __construct(
        public Auction $auction,
        public string  $sellerName,
    ) {
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: "【オークション開催のお知らせ】{$this->auction->title} がまもなく開始されます");
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        $title = $this->auction->title;
        $date = $this->auction->event_date?->format('Y/m/d') ?? '';
        $time = $this->auction->start_time ?? '';
        return <<<HTML
        <h2>🔔 まもなくオークションが開始されます</h2>
        <p>{$this->sellerName} 様</p>
        <p>出品いただいた生体のオークションがまもなく開始されます。</p>
        <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #ddd">オークション</td><td style="padding:8px;border:1px solid #ddd"><strong>{$title}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">開催日</td><td style="padding:8px;border:1px solid #ddd">{$date}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">開始時刻</td><td style="padding:8px;border:1px solid #ddd">{$time}</td></tr>
        </table>
        <p>結果はオークション終了後にお知らせいたします。</p>
        HTML;
    }
}
