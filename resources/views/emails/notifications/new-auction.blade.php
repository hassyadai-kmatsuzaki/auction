<x-mail::message>
# 新規オークション開催のお知らせ

{{ $user->name }} 様

いつもメダカライブオークションをご利用いただきありがとうございます。
新しいオークションが開催されますのでお知らせいたします。

---

## オークション情報

**オークション名**: {{ $auction->title }}

**開催日**: {{ \Carbon\Carbon::parse($auction->event_date)->format('Y年m月d日') }}

**開始時刻**: {{ $auction->start_time ?? '未定' }}

@if($auction->description)
**説明**: {{ $auction->description }}
@endif

---

ぜひご参加ください！

<x-mail::button :url="config('app.frontend_url') . '/participant/auctions'">
オークション一覧を見る
</x-mail::button>

---

※このメールは新規オークション通知を希望された方にお送りしています。
通知設定の変更はマイページから行えます。

{{ config('app.name') }}
</x-mail::message>
