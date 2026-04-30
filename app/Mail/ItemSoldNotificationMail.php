<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ItemSoldNotificationMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public $wonItem;
    public $seller;

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->seller = $wonItem->item->seller ?? null;
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【メダカライブオークション】出品商品が落札されました',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.item-sold',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
