<?php

namespace App\Mail;

use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ShippingNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public $wonItem;
    public $user;

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->user = $wonItem->user;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【メダカライブオークション】商品発送のお知らせ',
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
