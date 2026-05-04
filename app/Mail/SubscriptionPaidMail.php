<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SubscriptionPaidMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public User $user;
    public Subscription $subscription;
    public Payment $payment;
    /** @var 'new'|'renewal' */
    public string $kind;

    public function __construct(User $user, Subscription $subscription, Payment $payment, string $kind = 'new')
    {
        $this->user = $user;
        $this->subscription = $subscription;
        $this->payment = $payment;
        $this->kind = $kind;
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        $subject = $this->kind === 'renewal'
            ? '【日本メダカオンライン市場】年会費の更新が完了しました'
            : '【日本メダカオンライン市場】年会費プランへのご加入ありがとうございます';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(markdown: 'emails.notifications.subscription-paid');
    }

    public function attachments(): array
    {
        return [];
    }
}
