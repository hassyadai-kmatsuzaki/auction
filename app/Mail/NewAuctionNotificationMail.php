<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\Auction;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewAuctionNotificationMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public $auction;
    public $user;

    public function __construct(Auction $auction, User $user)
    {
        $this->auction = $auction;
        $this->user = $user;
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【メダカライブオークション】新規オークション開催のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.new-auction',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
