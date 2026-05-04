<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToPriorityQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\ReplyTo;
use Illuminate\Queue\SerializesModels;

class ContactReceivedMail extends Mailable
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
            subject: '【MEDAICHI】LP からお問い合わせを受け付けました',
            replyTo: [new ReplyTo($this->payload['email'], $this->payload['name'] ?? '')],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.contact.received',
            with: ['payload' => $this->payload],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
