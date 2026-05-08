<x-mail::message>
# 送料確定のお知らせ

{{ $user->name }} 様

いつも日本メダカオンライン市場をご利用いただきありがとうございます。
下記落札分の**送料が確定**しましたのでお知らせいたします。

---

@if($totalShippingFee === 0)
## 配送料

**¥0**@if($adjustmentReason)（{{ $adjustmentReason }}）@endif

@elseif($shippingBreakdown && ($shippingBreakdown['mode'] ?? null) === 'manual')
## 配送料

{{ $shippingBreakdown['manual_reason'] ?? '管理者により個別に設定された送料です。' }}

@if(!empty($shippingBreakdown['region']))
配送地域: **{{ $shippingBreakdown['region'] }}**
@endif

**配送料 計**: ¥{{ number_format($shippingBreakdown['manual_total'] ?? $totalShippingFee) }}

@elseif($shippingBreakdown && !empty($shippingBreakdown['boxes']))
## 配送料の内訳

@if(!empty($shippingBreakdown['region']))
配送地域: **{{ $shippingBreakdown['region'] }}**
@endif

| 箱サイズ | 個数 | 配送料 | 梱包資材費 | 小計 |
| :--- | :---: | ---: | ---: | ---: |
@foreach($shippingBreakdown['boxes'] as $box)
| {{ $box['box_size'] }}サイズ | {{ $box['count'] }}箱 | ¥{{ number_format($box['shipping_cost']) }} | ¥{{ number_format($box['packing_cost']) }} | ¥{{ number_format($box['subtotal']) }} |
@endforeach
| **合計** | | ¥{{ number_format($shippingBreakdown['shipping_cost_total']) }} | ¥{{ number_format($shippingBreakdown['packing_cost_total']) }} | **¥{{ number_format($shippingBreakdown['total_shipping_fee']) }}** |

※ 配送料は箱サイズ・配送地域に基づき算出され、梱包資材費（発泡スチロール等）を含みます。

@else
## 配送料

**送料合計**: ¥{{ number_format($totalShippingFee) }}

@endif
---

送料が含まれた請求書をマイページよりご確認いただけます。
お支払い期限までに、ご入金手続きをお願いいたします。

<x-mail::button :url="config('app.frontend_url') . '/participant/won-items'">
落札一覧を確認する
</x-mail::button>

ご不明な点がございましたら、お気軽にお問い合わせください。

{{ config('app.name') }}
</x-mail::message>
