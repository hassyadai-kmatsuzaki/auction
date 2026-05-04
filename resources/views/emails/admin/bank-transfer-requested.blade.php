<x-mail::message>
# 銀行振込のお申し込みがありました

下記のユーザーが年会費プランの銀行振込でのお申し込みを行いました。
入金確認のうえ、管理画面より承認をお願いいたします。

---

## ユーザー情報

**お名前**: {{ $user->name }}

**メールアドレス**: {{ $user->email }}

**ユーザーID**: {{ $user->id }}

@if($user->phone)
**電話番号**: {{ $user->phone }}
@endif

@if($user->trade_name)
**屋号**: {{ $user->trade_name }}
@endif

@if($user->company_name)
**会社名**: {{ $user->company_name }}
@endif

---

## 申込プラン

**プラン名**: {{ $plan->name }}

**金額**: ¥{{ number_format((int) $plan->amount) }}（年・税込）

---

<x-mail::button :url="$adminUserUrl">
管理画面でユーザーを確認する
</x-mail::button>

{{ config('app.name') }}
</x-mail::message>
