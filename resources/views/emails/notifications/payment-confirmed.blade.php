<x-mail::message>
# ご入金確認のお知らせ

{{ $user->name }} 様

この度は、メダカライブオークションをご利用いただきありがとうございます。
下記の商品のご入金を確認いたしましたのでお知らせいたします。

---

## 入金確認内容

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**お支払い金額**: ¥{{ number_format($wonItem->total_amount) }}

---

## 今後の流れ

1. 出品者様へ発送依頼を行いました
2. 商品発送後、追跡番号をお知らせいたします
3. 商品到着までしばらくお待ちください

<x-mail::button :url="config('app.frontend_url') . '/participant/won-items'">
配送状況を確認する
</x-mail::button>

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後ともメダカライブオークションをよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
