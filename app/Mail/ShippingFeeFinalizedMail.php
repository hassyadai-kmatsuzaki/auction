<?php

namespace App\Mail;

use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class ShippingFeeFinalizedMail extends Mailable
{
    use Queueable, SerializesModels;

    public Collection $wonItems;
    public $user;
    public int $totalShippingFee;

    public function __construct(Collection $wonItems)
    {
        $this->wonItems = $wonItems;
        $this->user = $wonItems->first()->user;
        $this->totalShippingFee = (int) $wonItems->sum('shipping_fee');
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: '【メダカライブオークション】送料確定のお知らせ');
    }

    public function content(): Content
    {
        return new Content(markdown: 'emails.notifications.shipping-fee-finalized');
    }

    public function attachments(): array
    {
        return [];
    }
}
