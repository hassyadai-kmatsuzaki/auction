<x-mail::message>
# LP からのお問い合わせ

MEDAICHI LP のお問い合わせフォームから新しい問い合わせが届きました。

**お名前:** {{ $payload['name'] }}

**メールアドレス:** {{ $payload['email'] }}

**お電話番号:** {{ $payload['phone'] ?? '（未入力）' }}

**会社名 / 屋号:** {{ $payload['company'] ?? '（未入力）' }}

**お問い合わせ内容:**

{!! nl2br(e($payload['message'])) !!}

---

返信は本メールの差出人 (Reply-To) にそのまま返信いただけます。

{{ config('app.name') }}
</x-mail::message>
