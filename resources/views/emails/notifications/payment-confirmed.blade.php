<x-mail::message>
# ご入金確認のお知らせ

{{ $user->name }} 様

この度は、日本メダカオンライン市場をご利用いただきありがとうございます。
下記の商品のご入金を確認いたしましたのでお知らせいたします。

---

## 入金確認内容

@foreach($wonItems as $wi)
- **{{ $wi->item->species_name ?? '商品' }}**（No.{{ $wi->item->item_number ?? '-' }}）{{ $wi->quantity }}匹 — 落札 ¥{{ number_format((int) ($wi->total_amount ?? 0)) }}
@endforeach

**お支払い金額合計**: ¥{{ number_format($totalAmount + $totalShippingFee) }}

@if($totalShippingFee > 0)
（内訳: 商品代金 ¥{{ number_format($totalAmount) }} ＋ 配送料金 ¥{{ number_format($totalShippingFee) }}）
@endif

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
