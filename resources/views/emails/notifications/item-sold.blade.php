<x-mail::message>
# 出品商品が落札されました

{{ $seller->sellerProfile->seller_name ?? $seller->name ?? '出品者' }} 様

おめでとうございます！
出品された商品が落札されましたのでお知らせいたします。

---

## 落札内容

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**数量**: {{ $wonItem->quantity }}匹

**落札価格**: ¥{{ number_format($wonItem->winning_price) }}

---

## 今後の流れ

1. 買受者様からの入金をお待ちください
2. 入金確認後、発送依頼のメールをお送りします
3. 発送後、伝票番号を管理画面からご登録ください

<x-mail::button :url="config('app.frontend_url') . '/seller/shipping'">
発送管理を確認する
</x-mail::button>

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後ともメダカライブオークションをよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
