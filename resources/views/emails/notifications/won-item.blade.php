<x-mail::message>
# 落札おめでとうございます！

{{ $user->name }} 様

この度は、日本メダカオンライン市場をご利用いただきありがとうございます。
下記の商品を落札されましたのでお知らせいたします。

---

## 落札内容

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**数量**: {{ $wonItem->quantity }}匹

**落札価格**: ¥{{ number_format($wonItem->winning_price) }} / 匹

**落札手数料**: ¥{{ number_format($wonItem->commission_amount ?? 0) }}

**小計（税抜・落札手数料込）**: ¥{{ number_format(\App\Services\InvoiceService::buyerLineAmount($wonItem)) }}

※ 落札時点では送料が未確定のため税抜の小計です。配送料金と消費税は別途加算されます。確定金額は請求書でご確認ください。

---

## お支払いについて

お支払い期限: **{{ $wonItem->payment_deadline ? \Carbon\Carbon::parse($wonItem->payment_deadline)->format('Y年m月d日') : '3営業日以内' }}**

下記のボタンからマイページにアクセスし、お支払い手続きをお願いいたします。

<x-mail::button :url="config('app.frontend_url') . '/participant/won-items'">
落札商品を確認する
</x-mail::button>

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
