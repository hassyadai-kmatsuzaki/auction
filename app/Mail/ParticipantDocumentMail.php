<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\Auction;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * 落札者向け帳票（請求書/領収書）のPDF添付メール。
 *
 * LINE内ブラウザ等、PDFを直接ダウンロードできない環境向けに
 * 落札管理ページの操作からメールで帳票を届けるために使う。
 */
class ParticipantDocumentMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public function __construct(
        public Auction $auction,
        public User $winner,
        public string $documentType, // 'invoice' | 'receipt'
    ) {
        $this->routeViaNotify();
    }

    public function documentLabel(): string
    {
        return $this->documentType === 'receipt' ? '領収書' : '請求書';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "【日本メダカオンライン市場】{$this->documentLabel()}のご案内",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.participant-document',
            with: [
                'documentLabel' => $this->documentLabel(),
            ],
        );
    }

    public function attachments(): array
    {
        $service = app(InvoiceService::class);
        $pdf = $this->documentType === 'receipt'
            ? $service->generateReceipt($this->auction, $this->winner)
            : $service->generateInvoice($this->auction, $this->winner);
        $content = $pdf->output();

        return [
            Attachment::fromData(fn () => $content, "{$this->documentType}_auction_{$this->auction->id}.pdf")
                ->withMime('application/pdf'),
        ];
    }
}
