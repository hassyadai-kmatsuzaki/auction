<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\WonItem;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

/**
 * 入金催促メール（落札者単位で集約）
 *
 * 同一落札者・同一期限の未入金 WonItem をまとめて1通にする。
 * 合計は請求書と同じ「落札金額(税込)+送料」。
 */
class PaymentReminderMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    /**
     * @param  Collection<int, WonItem>  $wonItems  同一 winner_id の WonItem
     */
    public function __construct(
        public Collection $wonItems,
        public string     $urgency = '24時間前',
    ) {
        $this->wonItems = $wonItems->values();
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        $count = $this->wonItems->count();
        $name  = $this->wonItems->first()?->item?->species_name ?? '商品';
        $subject = $count > 1
            ? "【入金期限のお知らせ】{$name} ほか" . ($count - 1) . "件の入金期限が近づいています"
            : "【入金期限のお知らせ】{$name} の入金期限が近づいています";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        $first    = $this->wonItems->first();
        $user     = $first?->user;
        $count    = $this->wonItems->count();
        $deadline = $first?->payment_deadline?->format('Y/m/d H:i') ?? '未定';

        $td = 'padding:8px;border:1px solid #ddd';
        $tdAmount = $td . ';text-align:right;white-space:nowrap';

        $rows = '';
        foreach ($this->wonItems as $w) {
            $name   = $w->item?->species_name ?? '商品';
            $amount = number_format((int) $w->total_amount);
            $rows .= "<tr><td style=\"{$td}\">{$name}</td><td style=\"{$tdAmount}\">¥{$amount}</td></tr>\n";
        }

        $shippingTotal = (int) $this->wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
        if ($shippingTotal > 0) {
            $rows .= "<tr><td style=\"{$td}\">送料</td><td style=\"{$tdAmount}\">¥" . number_format($shippingTotal) . "</td></tr>\n";
        }

        $total = number_format((int) $this->wonItems->sum(fn ($w) => (int) $w->total_amount + (int) ($w->shipping_fee ?? 0)));

        $lead = $count > 1
            ? "落札された <strong>{$count} 点</strong> の入金期限が <strong>{$this->urgency}</strong> に迫っています。"
            : "<strong>" . ($first?->item?->species_name ?? '商品') . "</strong> の入金期限が <strong>{$this->urgency}</strong> に迫っています。";

        return <<<HTML
        <h2>⚠️ 入金期限のお知らせ</h2>
        <p>{$user?->name} 様</p>
        <p>{$lead}</p>
        <table style="border-collapse:collapse;margin:16px 0">
            <tr><th style="{$td};background:#f3f4f6;text-align:left">商品</th><th style="{$td};background:#f3f4f6;text-align:right">金額（税込）</th></tr>
            {$rows}
            <tr><td style="{$td}"><strong>合計金額</strong></td><td style="{$tdAmount}"><strong>¥{$total}</strong></td></tr>
            <tr><td style="{$td}">入金期限</td><td style="{$td};color:#DC2626"><strong>{$deadline}</strong></td></tr>
        </table>
        <p>期限内にお振込みをお願いいたします。</p>
        HTML;
    }
}
