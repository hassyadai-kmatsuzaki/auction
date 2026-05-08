<x-mail::message>
# 商品発送のお知らせ

{{ $user->name }} 様

この度は、日本メダカオンライン市場をご利用いただきありがとうございます。
下記の商品が発送されましたのでお知らせいたします。

---

## 発送内容

@foreach($wonItems as $wi)
- **{{ $wi->item->species_name ?? '商品' }}**（No.{{ $wi->item->item_number ?? '-' }}）{{ $wi->quantity }}匹
@endforeach

---

## 配送情報

**配送業者**: {{ $wonItem->shipping_company ?? 'ヤマト運輸' }}

**伝票番号**: {{ $wonItem->tracking_number ?? '-' }}

@if($wonItem->tracking_number)
@php
    $trackingUrl = '';
    $company = $wonItem->shipping_company ?? '';
    $trackingNumber = str_replace('-', '', $wonItem->tracking_number);

    if (str_contains($company, 'ヤマト') || str_contains($company, 'クロネコ')) {
        $trackingUrl = 'https://member.kms.kuronekoyamato.co.jp/parcel/detail?pno=' . $trackingNumber;
    } elseif (str_contains($company, '佐川')) {
        $trackingUrl = 'https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=' . $trackingNumber;
    } elseif (str_contains($company, '郵便') || str_contains($company, 'ゆうパック')) {
        $trackingUrl = 'https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=' . $trackingNumber;
    }
@endphp

@if($trackingUrl)
<x-mail::button :url="$trackingUrl">
配送状況を確認する
</x-mail::button>
@endif
@endif

---

## お届けについてのお願い

- 生体ですので、お届け日時にはご在宅をお願いいたします
- 長時間の不在は生体に影響を与える可能性があります
- お届け後は速やかに開封し、水合わせを行ってください

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
