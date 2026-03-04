<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BidLimitReachedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $speciesName,
        public float  $limitPrice,
        public float  $currentPrice,
        public string $userName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "【上限価格到達】{$this->speciesName} の入札が自動オフになりました");
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        $limit = number_format($this->limitPrice);
        $current = number_format($this->currentPrice);
        return <<<HTML
        <h2>上限価格に到達しました</h2>
        <p>{$this->userName} 様</p>
        <p><strong>{$this->speciesName}</strong> の現在価格が上限価格に達したため、自動的に入札がオフになりました。</p>
        <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #ddd">上限価格</td><td style="padding:8px;border:1px solid #ddd"><strong>¥{$limit}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">到達時価格</td><td style="padding:8px;border:1px solid #ddd">¥{$current}</td></tr>
        </table>
        <p>上限価格を変更して再入札することもできます。</p>
        HTML;
    }
}
