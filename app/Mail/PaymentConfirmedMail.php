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

class PaymentConfirmedMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public $wonItem;
    public $user;
    public Collection $wonItems;
    public int $totalAmount;
    public int $totalShippingFee;

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
        $this->totalAmount = (int) $this->wonItems->sum(fn ($w) => (int) ($w->total_amount ?? 0));
        $this->totalShippingFee = (int) $this->wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】ご入金確認のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.payment-confirmed',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
