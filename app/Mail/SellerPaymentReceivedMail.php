<?php

namespace App\Mail;

use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SellerPaymentReceivedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $wonItem;
    public $seller;

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->seller = $wonItem->item->seller ?? null;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【メダカライブオークション】入金確認・発送依頼のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.seller-payment-received',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
