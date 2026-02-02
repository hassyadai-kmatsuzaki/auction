<x-mail::message>
# 入金確認・発送依頼のお知らせ

{{ $seller->sellerProfile->seller_name ?? $seller->name ?? '出品者' }} 様

いつもメダカライブオークションをご利用いただきありがとうございます。
下記の商品について、買受者様からの入金が確認されました。

**発送手続きをお願いいたします。**

---

## 発送対象商品

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**数量**: {{ $wonItem->quantity }}匹

**落札価格**: ¥{{ number_format($wonItem->winning_price) }}

---

## 買受者情報

**お届け先**: {{ $wonItem->shipping_address ?? '住所未登録' }}

---

## 発送について

1. 商品を梱包し、発送手続きを行ってください
2. 発送後、管理画面から伝票番号をご登録ください
3. 伝票番号登録後、買受者様に自動通知されます

<x-mail::button :url="config('app.frontend_url') . '/seller/shipping'">
発送管理へ
</x-mail::button>

---

**発送期限**: 入金確認後3営業日以内

ご不明な点がございましたら、お気軽にお問い合わせください。

{{ config('app.name') }}
</x-mail::message>
