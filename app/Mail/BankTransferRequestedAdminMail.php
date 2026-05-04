<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToPriorityQueue;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BankTransferRequestedAdminMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToPriorityQueue;

    public User $user;
    public Plan $plan;
    public string $adminUserUrl;

    public function __construct(User $user, Plan $plan)
    {
        $this->user = $user;
        $this->plan = $plan;
        $this->adminUserUrl = rtrim((string) config('app.frontend_url'), '/') . '/admin/users/' . $user->id;
        $this->routeViaPriority();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】銀行振込のお申し込みがありました',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.admin.bank-transfer-requested',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
