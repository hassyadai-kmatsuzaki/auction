<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\Auction;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * 出品者向け 出品ID発行通知メール。
 *
 * 1人の出品者の同一オークションでの出品ID発行をまとめて1通で配信する。
 */
class SellerExhibitCodeNotificationMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    /**
     * @param  Auction  $auction
     * @param  string   $sellerName
     * @param  array<int, array{exhibit_code: string, item_number: int|null, species_name: string}>  $items
     */
    public function __construct(
        public Auction $auction,
        public string  $sellerName,
        public array   $items,
    ) {
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "【出品ID発行】{$this->auction->title}",
        );
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        $title = e($this->auction->title);
        $date = e($this->auction->event_date?->format('Y/m/d') ?? '');
        $sellerName = e($this->sellerName);

        $rows = '';
        foreach ($this->items as $row) {
            $exhibitCode = e((string) ($row['exhibit_code'] ?? ''));
            $itemNumber = e((string) ($row['item_number'] ?? ''));
            $speciesName = e((string) ($row['species_name'] ?? ''));
            $rows .= <<<HTML
            <tr>
                <td style="padding:8px;border:1px solid #ddd"><strong>{$exhibitCode}</strong></td>
                <td style="padding:8px;border:1px solid #ddd">{$itemNumber}</td>
                <td style="padding:8px;border:1px solid #ddd">{$speciesName}</td>
            </tr>
            HTML;
        }

        $count = count($this->items);

        return <<<HTML
        <h2>📋 出品ID発行のお知らせ</h2>
        <p>{$sellerName} 様</p>
        <p>下記オークションにて、ご出品いただいた生体に「出品ID」が発行されましたのでお知らせいたします。
        当日の会場および落札者の画面ではこの出品IDで進行いたします。</p>
        <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #ddd">オークション</td><td style="padding:8px;border:1px solid #ddd"><strong>{$title}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">開催日</td><td style="padding:8px;border:1px solid #ddd">{$date}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd">対象件数</td><td style="padding:8px;border:1px solid #ddd">{$count} 件</td></tr>
        </table>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
            <thead>
                <tr style="background:#f5f5f5">
                    <th style="padding:8px;border:1px solid #ddd;text-align:left">出品ID</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:left">商品ID</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:left">タイトル</th>
                </tr>
            </thead>
            <tbody>
                {$rows}
            </tbody>
        </table>
        <p style="color:#6B7280;font-size:12px;margin-top:24px">
            ご不明な点がございましたら info@nep-corp.com までお問い合わせください。<br>
            （このメールは送信専用アドレスから配信されています。返信いただいても回答できません）
        </p>
        HTML;
    }
}
