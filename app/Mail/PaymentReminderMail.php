<?php

namespace App\Mail;

use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public WonItem $wonItem,
        public string  $urgency = '24時間前',
    ) {}

    public function envelope(): Envelope
    {
        $name = $this->wonItem->item?->species_name ?? '商品';
        return new Envelope(subject: "【入金期限のお知らせ】{$name} の入金期限が近づいています");
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        $item = $this->wonItem->item;
        $name = $item?->species_name ?? '商品';
        $total = number_format($this->wonItem->total_amount);
        $deadline = $this->wonItem->payment_deadline?->format('Y/m/d H:i') ?? '未定';
        $user = $this->wonItem->user;

        return <<<HTML
        <h2>⚠️ 入金期限のお知らせ</h2>
        <p>{$user?->name} 様</p>
        <p><strong>{$name}</strong> の入金期限が <strong>{$this->urgency}</strong> に迫っています。</p>
        <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #ddd">商品</td><td style="padding:8px;border:1px solid #ddd">{$name}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">合計金額</td><td style="padding:8px;border:1px solid #ddd"><strong>¥{$total}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">入金期限</td><td style="padding:8px;border:1px solid #ddd;color:#DC2626"><strong>{$deadline}</strong></td></tr>
        </table>
        <p>期限内にお振込みをお願いいたします。</p>
        HTML;
    }
}
