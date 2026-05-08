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

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->user = $wonItem->user;
        $auctionId = optional($wonItem->item)->auction_id;
        $this->wonItems = WonItem::with('item')
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->where('winner_id', $wonItem->winner_id)
            ->orderBy('id')
            ->get();
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
