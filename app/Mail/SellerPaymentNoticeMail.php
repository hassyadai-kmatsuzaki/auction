<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\Auction;
use App\Models\SellerProfile;
use App\Services\InvoiceService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * 出品者向け支払通知書のPDF添付メール。
 *
 * 管理画面の一斉通知（LINE未連携の出品者向けフォールバック）から送信する。
 * 金額はPDF側にのみ記載し、本文には載せない（帳票との食い違い防止）。
 */
class SellerPaymentNoticeMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public function __construct(
        public Auction $auction,
        public SellerProfile $sellerProfile,
    ) {
        $this->routeViaNotify();
    }

    /** 宛名（会社名 → 屋号 → 名前）。InvoiceService の宛先表記と同じ優先順。 */
    public function sellerDisplayName(): string
    {
        $user = $this->sellerProfile->user;
        if (!$user) {
            return '出品者';
        }
        foreach (['company_name', 'trade_name', 'name'] as $field) {
            $value = trim((string) ($user->{$field} ?? ''));
            if ($value !== '') {
                return $value;
            }
        }
        return '出品者';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】支払通知書のご案内',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.seller-payment-notice',
            with: [
                'sellerName' => $this->sellerDisplayName(),
            ],
        );
    }

    public function attachments(): array
    {
        $pdf = app(InvoiceService::class)->generateSellerPaymentNotice($this->auction, $this->sellerProfile);
        $content = $pdf->output();

        return [
            Attachment::fromData(fn () => $content, "payment_notice_auction_{$this->auction->id}.pdf")
                ->withMime('application/pdf'),
        ];
    }
}
