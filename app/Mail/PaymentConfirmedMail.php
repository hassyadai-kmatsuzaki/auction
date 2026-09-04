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

class PaymentConfirmedMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public $wonItem;
    public $user;
    public Collection $wonItems;
    public int $totalAmount;
    public int $totalShippingFee;
    /** @var array{subtotal:int, commission_total:int, total_shipping_fee:int, tax_rate:float, tax_amount:int, grand_total:int} 請求書と同式の税込内訳 */
    public array $totals = [];

    public function __construct(WonItem $wonItem)
    {
        $this->wonItem = $wonItem;
        $this->user = $wonItem->user;
        $auctionId = optional($wonItem->item)->auction_id;
        $items = $auctionId && $wonItem->winner_id
            ? WonItem::with('item')
                ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
                ->where('winner_id', $wonItem->winner_id)
                ->orderBy('id')
                ->get()
            : collect();
        // モックや単発呼び出しで auction × winner の解決ができない場合は受け取った wonItem を1件として扱う
        $this->wonItems = $items->isEmpty() ? collect([$wonItem]) : $items;
        $this->totalAmount = (int) $this->wonItems->sum(fn ($w) => (int) ($w->total_amount ?? 0));
        $this->totalShippingFee = (int) $this->wonItems->sum(fn ($w) => (int) ($w->shipping_fee ?? 0));
        // 入金済みの案内なので、実際に支払われた税込額を請求書PDFと同じ式・同じ丸めで出す
        // （total_amount は税抜・手数料込。そのまま「お支払い金額」と書くと請求書と食い違う）
        $this->totals = \App\Services\InvoiceService::buyerTotals($this->wonItems);
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】ご入金確認のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.notifications.payment-confirmed',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
