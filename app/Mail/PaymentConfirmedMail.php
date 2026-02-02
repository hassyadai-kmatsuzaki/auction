<?php

namespace App\Mail;

use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentConfirmedMail extends Mailable
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
            subject: '【メダカライブオークション】ご入金確認のお知らせ',
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
