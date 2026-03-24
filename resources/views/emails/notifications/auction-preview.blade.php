<x-mail::message>
# 明日オークションが開催されます

{{ $user->name }} 様

明日開催予定のオークションのお知らせです。

---

## オークション情報

**オークション名**: {{ $auction->title }}

**開催日**: {{ \Carbon\Carbon::parse($auction->event_date)->format('Y年m月d日') }}

**開始時刻**: {{ $auction->start_time ?? '未定' }}

@if($auction->description)
**詳細**: {{ $auction->description }}
@endif

---

お気に入りの商品や気になる出品物を事前にチェックしておきましょう！

<x-mail::button :url="config('app.frontend_url') . '/participant/auctions/' . $auction->id">
オークション詳細を確認する
</x-mail::button>

---

※このメールはオークション予告通知を希望された方にお送りしています。
通知設定の変更はマイページから行えます。

{{ config('app.name') }}
</x-mail::message>
