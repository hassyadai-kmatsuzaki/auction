<x-mail::message>
@if($kind === 'renewal')
# 年会費の更新が完了しました

{{ $user->name }} 様

いつも日本メダカオンライン市場をご利用いただきありがとうございます。
年会費プランの自動更新課金が完了いたしましたのでお知らせいたします。
@else
# ご加入ありがとうございます

{{ $user->name }} 様

この度は、日本メダカオンライン市場の年会費プランへご加入いただき、誠にありがとうございます。
クレジットカードでのご決済が完了いたしましたのでお知らせいたします。
@endif

---

## ご決済内容

**プラン名**: {{ $subscription->plan->name ?? '-' }}

**お支払い金額**: ¥{{ number_format((int) $payment->amount) }}（税込）

**お支払い日**: {{ optional($payment->paid_at)->format('Y年n月j日') ?? now()->format('Y年n月j日') }}

**次回更新日**: {{ optional($subscription->current_period_end)->format('Y年n月j日') ?? '-' }}

@if(!empty($payment->receipt_url))
@php($receiptUrl = $payment->receipt_url)
<x-mail::button :url="$receiptUrl">
Square 決済レシートを表示
</x-mail::button>
@endif

---

ご不明な点がございましたら、お気軽にお問い合わせください。

お問い合わせ: info@nep-corp.com

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
