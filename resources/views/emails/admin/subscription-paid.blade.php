<x-mail::message>
@if($kind === 'renewal')
# 年会費の自動更新課金が完了しました
@else
# 年会費プランの新規加入課金が完了しました
@endif

下記ユーザーのクレジットカード決済が正常に完了しました。

---

## ユーザー情報

**お名前**: {{ $user->name }}

**メールアドレス**: {{ $user->email }}

**ユーザーID**: {{ $user->id }}

@if($user->trade_name)
**屋号**: {{ $user->trade_name }}
@endif

@if($user->company_name)
**会社名**: {{ $user->company_name }}
@endif

---

## 決済内容

**プラン名**: {{ $subscription->plan->name ?? '-' }}

**金額**: ¥{{ number_format((int) $payment->amount) }}（税込）

**決済日時**: {{ optional($payment->paid_at)->format('Y-m-d H:i:s') ?? now()->format('Y-m-d H:i:s') }}

**次回更新日**: {{ optional($subscription->current_period_end)->format('Y-m-d') ?? '-' }}

**Square Payment ID**: {{ $payment->square_payment_id ?? '-' }}

@if(!empty($payment->receipt_url))
@php($receiptUrl = $payment->receipt_url)
<x-mail::button :url="$receiptUrl">
Square 決済レシートを表示
</x-mail::button>
@endif

<x-mail::button :url="$adminUserUrl">
管理画面でユーザーを確認する
</x-mail::button>

{{ config('app.name') }}
</x-mail::message>
