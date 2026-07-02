<?php
// 使い捨て：入金確認LINE通知の擬似送信。実行後は削除してください。
// 実行例（auctionプロジェクト直下）:
//   docker exec -e LINE_TEST_TOKEN='チャネルアクセストークン' -e LINE_TEST_USER='あなたのLINEユーザーID' \
//     auction-app php artisan tinker /var/www/html/line_test_payment.php

$token = getenv('LINE_TEST_TOKEN');
$to    = getenv('LINE_TEST_USER');
if (!$token || !$to) {
    echo "LINE_TEST_TOKEN / LINE_TEST_USER が未設定です\n";
    return;
}

// 実データがあれば最新の落札を使い、なければサンプルを組み立てる（どちらでも見た目は同じ）
$wonItem = \App\Models\WonItem::with('item.auction')->latest('id')->first();
if (!$wonItem) {
    $auction = new \App\Models\Auction(['title' => '第5回 日本メダカオークション']);
    $item    = new \App\Models\Item(['species_name' => 'サンプル', 'thumbnail_path' => null]);
    $item->setRelation('auction', $auction);
    $wonItem = new \App\Models\WonItem();
    $wonItem->setRelation('item', $item);
}

// ── 本番と同じビルダー／文言で組み立て ──
$flex  = app(\App\Services\LineFlexBuilder::class)->paymentConfirmed($wonItem);
$title = $wonItem->item?->auction?->title ?? 'オークション';
$text  = "✅ 入金が確認されました\n{$title}\nご入金ありがとうございました。";

// 本番の LineService::notify と同じく Flex 1通のみ（text は altText として使用）
$altText  = mb_substr(strip_tags($text), 0, 200);
$messages = [
    ['type' => 'flex', 'altText' => $altText, 'contents' => $flex],
];

$res = \Illuminate\Support\Facades\Http::withToken($token)
    ->post('https://api.line.me/v2/bot/message/push', ['to' => $to, 'messages' => $messages]);

echo "HTTP ".$res->status()."\n".$res->body()."\n";
echo $res->successful() ? "✅ 送信成功\n" : "❌ 送信失敗（body参照）\n";
