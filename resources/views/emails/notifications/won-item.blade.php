<x-mail::message>
# 落札おめでとうございます！

{{ $user->name }} 様

この度は、メダカライブオークションをご利用いただきありがとうございます。
下記の商品を落札されましたのでお知らせいたします。

---

## 落札内容

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**数量**: {{ $wonItem->quantity }}匹

**落札価格**: ¥{{ number_format($wonItem->winning_price) }}

**手数料**: ¥{{ number_format($wonItem->commission_amount ?? 0) }}

@if(($wonItem->shipping_fee ?? 0) > 0)
**配送料金**: ¥{{ number_format($wonItem->shipping_fee) }}

**合計金額**: ¥{{ number_format($wonItem->total_amount + $wonItem->shipping_fee) }}
@else
**合計金額**: ¥{{ number_format($wonItem->total_amount) }}

※ 配送料金は配送先地域により異なります。配送先住所をご登録いただくと自動計算されます。
@endif

---

## お支払いについて

お支払い期限: **{{ $wonItem->payment_deadline ? \Carbon\Carbon::parse($wonItem->payment_deadline)->format('Y年m月d日') : '3営業日以内' }}**

下記のボタンからマイページにアクセスし、お支払い手続きをお願いいたします。

<x-mail::button :url="config('app.frontend_url') . '/participant/won-items'">
落札商品を確認する
</x-mail::button>

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後ともメダカライブオークションをよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
