<x-mail::message>
# 送料確定のお知らせ

{{ $user->name }} 様

いつもメダカライブオークションをご利用いただきありがとうございます。
下記落札分の**送料が確定**しましたのでお知らせいたします。

---

## 落札明細

@foreach($wonItems as $wi)
- **{{ $wi->item->species_name ?? '商品' }}**（No.{{ $wi->item->item_number ?? '-' }}）
  送料: ¥{{ number_format((int) $wi->shipping_fee) }}
@endforeach

**送料合計**: ¥{{ number_format($totalShippingFee) }}

---

送料が含まれた請求書をマイページよりご確認いただけます。
お支払い期限までに、ご入金手続きをお願いいたします。

<x-mail::button :url="config('app.frontend_url') . '/participant/won-items'">
落札一覧を確認する
</x-mail::button>

ご不明な点がございましたら、お気軽にお問い合わせください。

{{ config('app.name') }}
</x-mail::message>
