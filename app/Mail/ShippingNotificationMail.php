<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class ShippingNotificationMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public $wonItem;
    public $user;
    public Collection $wonItems;
    /** @var array<int, array{number: string, url: ?string}> 伝票番号と追跡URL（複数口対応） */
    public array $trackingLinks = [];

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->user = $wonItem->user;
        $auctionId = optional($wonItem->item)->auction_id;
        $items = $auctionId && $wonItem->winner_id
            ? WonItem::with('item')
                ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
                ->where('winner_id', $wonItem->winner_id)
                ->orderBy('id')
                ->get()
            : collect();
        // モックや単発呼び出しで auction × winner の解決ができない場合は受け取った wonItem を1件として扱う
        $this->wonItems = $items->isEmpty() ? collect([$wonItem]) : $items;
        // 伝票番号はカンマ区切りで複数保持している。1通のメールに全件と追跡リンクを載せる
        $this->trackingLinks = array_map(
            fn (string $number) => ['number' => $number, 'url' => $wonItem->trackingUrlFor($number)],
            $wonItem->tracking_numbers,
        );
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】商品発送のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.shipping',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
