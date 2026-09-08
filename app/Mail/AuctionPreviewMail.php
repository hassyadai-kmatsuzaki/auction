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

class AuctionPreviewMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public function __construct(
        public Auction $auction,
        public User    $user,
    ) {
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "【日本メダカオンライン市場】明日開催のお知らせ - {$this->auction->title}",
        );
    }

    public function content(): Content
    {
        return new Content(
            // A-11 (2026-09-08): テンプレートは <x-mail::message> を使う markdown メール。view: だと
            //   mail コンポーネント名前空間が登録されず「No hint path defined for [mail]」で全件失敗する
            //   （5/21 244 件・8/27 951 ERROR）。他 21 本と同じ markdown: に揃える。
            markdown: 'emails.notifications.auction-preview',
        );
    }
}
