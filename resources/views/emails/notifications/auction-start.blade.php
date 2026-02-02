<x-mail::message>
# オークション開始のお知らせ

{{ $user->name }} 様

お待たせいたしました！
オークションが開始されましたのでお知らせいたします。

---

## オークション情報

**オークション名**: {{ $auction->title }}

**開催日**: {{ \Carbon\Carbon::parse($auction->event_date)->format('Y年m月d日') }}

**開始時刻**: {{ $auction->start_time ?? '開催中' }}

---

今すぐ参加しましょう！

<x-mail::button :url="config('app.frontend_url') . '/participant/auction/' . $auction->id . '/live'">
オークションに参加する
</x-mail::button>

---

※このメールはオークション開始通知を希望された方にお送りしています。
通知設定の変更はマイページから行えます。

{{ config('app.name') }}
</x-mail::message>
