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

@if(count($trackingLinks) === 0)
**伝票番号**: -
@elseif(count($trackingLinks) === 1)
**伝票番号**: {{ $trackingLinks[0]['number'] }}
@else
**伝票番号（{{ count($trackingLinks) }}件）**:
@foreach($trackingLinks as $link)
- {{ $link['number'] }}
@endforeach

※ 複数口に分かれて発送しています。お荷物は別々に届く場合があります。
@endif

@foreach($trackingLinks as $link)
@if($link['url'])
<x-mail::button :url="$link['url']">
配送状況を確認する{{ count($trackingLinks) > 1 ? '（' . $link['number'] . '）' : '' }}
</x-mail::button>
@endif
@endforeach

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
