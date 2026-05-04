<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToPriorityQueue;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SubscriptionPaidAdminMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToPriorityQueue;

    public User $user;
    public Subscription $subscription;
    public Payment $payment;
    /** @var 'new'|'renewal' */
    public string $kind;
    public string $adminUserUrl;

    public function __construct(User $user, Subscription $subscription, Payment $payment, string $kind = 'new')
    {
        $this->user = $user;
        $this->subscription = $subscription;
        $this->payment = $payment;
        $this->kind = $kind;
        $this->adminUserUrl = rtrim((string) config('app.frontend_url'), '/') . '/admin/users/' . $user->id;
        $this->routeViaPriority();
    }

    public function envelope(): Envelope
    {
        $subject = $this->kind === 'renewal'
            ? '【管理通知】年会費の自動更新課金が完了しました'
            : '【管理通知】年会費プランの新規加入課金が完了しました';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(markdown: 'emails.admin.subscription-paid');
    }

    public function attachments(): array
    {
        return [];
    }
}
