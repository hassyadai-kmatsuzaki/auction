<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToPriorityQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactThankYouMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToPriorityQueue;

    public array $payload;

    public function __construct(array $payload)
    {
        $this->payload = $payload;
        $this->routeViaPriority();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【MEDAICHI】お問い合わせありがとうございます',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.contact.thank-you',
            with: ['payload' => $this->payload],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
