<x-mail::message>
# 商品発送のお知らせ

{{ $user->name }} 様

この度は、メダカライブオークションをご利用いただきありがとうございます。
下記の商品が発送されましたのでお知らせいたします。

---

## 発送内容

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**数量**: {{ $wonItem->quantity }}匹

---

## 配送情報

**配送業者**: {{ $wonItem->shipping_company ?? 'ヤマト運輸' }}

**伝票番号**: {{ $wonItem->tracking_number ?? '-' }}

@if($wonItem->tracking_number)
<x-mail::button :url="'https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=' . str_replace('-', '', $wonItem->tracking_number)">
配送状況を確認する
</x-mail::button>
@endif

---

## お届けについてのお願い

- 生体ですので、お届け日時にはご在宅をお願いいたします
- 長時間の不在は生体に影響を与える可能性があります
- お届け後は速やかに開封し、水合わせを行ってください

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後ともメダカライブオークションをよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
