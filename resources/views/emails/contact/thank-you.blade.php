<x-mail::message>
# お問い合わせを受け付けました

{{ $payload['name'] }} 様

このたびは MEDAICHI（日本メダカオンライン市場）にお問い合わせいただき、誠にありがとうございます。

下記内容で受付いたしました。担当より追ってご連絡いたします。

@if (in_array($payload['category'] ?? null, ['apply', 'demo'], true))
---

**デモはこちらからご利用いただけます:**

<x-mail::button :url="'https://medaka-ichiba.com/presentation'">
デモを試す
</x-mail::button>

URL: https://medaka-ichiba.com/presentation
@endif

---

**お名前:** {{ $payload['name'] }}

**メールアドレス:** {{ $payload['email'] }}

**お電話番号:** {{ $payload['phone'] ?? '（未入力）' }}

**会社名 / 屋号:** {{ $payload['company'] ?? '（未入力）' }}

**お問い合わせ種別:** {{ $payload['category_label'] ?? '（未指定）' }}

**お問い合わせ内容:**

{!! filled($payload['message'] ?? null) ? nl2br(e($payload['message'])) : '（未入力）' !!}

---

※ 本メールは自動送信です。ご返信いただいてもお応えできない場合がありますので、追加のご連絡は元のフォームまたは下記窓口までお願いいたします。

お問い合わせ窓口: info@nep-corp.com

{{ config('app.name') }}
</x-mail::message>
