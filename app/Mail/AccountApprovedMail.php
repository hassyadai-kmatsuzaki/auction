<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToPriorityQueue;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountApprovedMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToPriorityQueue;

    public $user;
    public $loginUrl;

    public function __construct(User $user)
    {
        $this->user = $user;
        $this->loginUrl = rtrim((string) config('app.frontend_url'), '/') . '/login';
        $this->routeViaPriority();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】アカウント承認完了のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.auth.account-approved',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
