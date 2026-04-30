<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WonItemNotificationMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public $wonItem;
    public $user;

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->user = $wonItem->user;
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【メダカライブオークション】落札のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.won-item',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
