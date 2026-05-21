<x-mail::message>
# まもなくオークションが開始されます

{{ $user->name }} 様

ご参加予定のオークションがまもなく開始されます。
お時間になりましたら下記ボタンからご参加ください。

---

## オークション情報

**オークション名**: {{ $auction->title }}

**開催日**: {{ \Carbon\Carbon::parse($auction->event_date)->format('Y年m月d日') }}

**開始時刻**: {{ $auction->start_time ?? '本日中' }}

---

開始時刻になりましたら、下記ボタンからオークションにご参加いただけます。

<x-mail::button :url="config('app.frontend_url') . '/participant/auction/' . $auction->id . '/live'">
オークションに参加する
</x-mail::button>

---

※このメールはオークション開始通知を希望された方にお送りしています。
通知設定の変更はマイページから行えます。

{{ config('app.name') }}
</x-mail::message>
