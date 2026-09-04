<x-mail::message>
# ご入金確認のお知らせ

{{ $user->name }} 様

この度は、日本メダカオンライン市場をご利用いただきありがとうございます。
下記の商品のご入金を確認いたしましたのでお知らせいたします。

---

## 入金確認内容

@foreach($wonItems as $wi)
- **{{ $wi->item->species_name ?? '商品' }}**（No.{{ $wi->item->item_number ?? '-' }}）{{ $wi->quantity }}匹 — ¥{{ number_format(\App\Services\InvoiceService::buyerLineAmount($wi)) }}（税抜・落札手数料込）
@endforeach

**商品代金（税抜・落札手数料込）**: ¥{{ number_format(($totals['subtotal'] ?? 0) + ($totals['commission_total'] ?? 0)) }}

@if(($totals['total_shipping_fee'] ?? 0) > 0)
**配送料金**: ¥{{ number_format($totals['total_shipping_fee']) }}

@endif
**消費税（{{ rtrim(rtrim(number_format($totals['tax_rate'] ?? 10, 1), '0'), '.') }}%）**: ¥{{ number_format($totals['tax_amount'] ?? 0) }}

**お支払い金額合計（税込）**: ¥{{ number_format($totals['grand_total'] ?? 0) }}

※ 請求書と同じ計算で表示しています。

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
