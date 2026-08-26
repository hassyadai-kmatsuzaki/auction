<?php
// 使い捨て：本番でLINEに送られる全Flex通知(13種)を、あなたのLINEへ順番に送る。
// 画像有りは public/img/demo/medaka のデモ画像（本番 medaka-ichiba.com 配信）を使用。
// 実行後は削除してください。
//   docker exec -e LINE_TEST_TOKEN='...' -e LINE_TEST_USER='...' \
//     auction-app php artisan tinker /var/www/html/line_test_all.php

use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

$token = getenv('LINE_TEST_TOKEN');
$to    = getenv('LINE_TEST_USER');
if (!$token || !$to) { echo "LINE_TEST_TOKEN / LINE_TEST_USER が未設定です\n"; return; }

$flexBuilder = app(\App\Services\LineFlexBuilder::class);

// ── デモ画像URL（本番ドメインで公開配信。LINEはサーバー側から取得するため公開HTTPS必須） ──
$img = fn (string $file) => 'https://medaka-ichiba.com/img/demo/medaka/' . rawurlencode($file);
$IMG = [
    'エメキン'            => $img('エメキン_サムネ.jpg'),
    '三色体外光亜種'      => $img('三色体外光亜種_サムネ.jpg'),
    '和墨ミッドナイトフリル' => $img('和墨ミッドナイトフリル_サムネ.jpg'),
    '和墨白銀'            => $img('和墨白銀_サムネ.jpg'),
    '紅帝リアルロングフィン' => $img('紅帝リアルロングフィン_サムネ.jpg'),
    '黒天幻龍'            => $img('黒天幻龍_サムネ.jpg'),
];

// ── ヘルパー ──
$mkItem = function (string $species, ?string $thumb) {
    $item = new \App\Models\Item();
    $item->species_name   = $species;
    $item->thumbnail_path = $thumb; // フルHTTPS URL → itemHeroImage がそのまま採用
    return $item;
};
$mkAuction = function (string $title) {
    $a = new \App\Models\Auction();
    $a->id         = 999;                       // DBに無いID → featuredItem は null（後で画像注入）
    $a->title      = $title;
    $a->event_date = Carbon::parse('2026-07-15');
    $a->start_time = '20:00';
    return $a;
};
// Auction系Flexは featuredItem(DB依存)で画像が出ないため、hero を直接注入
$withHero = function (array $flex, string $url) {
    $flex['hero'] = ['type' => 'image', 'url' => $url, 'size' => 'full', 'aspectRatio' => '4:3', 'aspectMode' => 'cover'];
    return $flex;
};
$push = function (string $label, array $flex) use ($token, $to) {
    $res = Http::withToken($token)->post('https://api.line.me/v2/bot/message/push', [
        'to' => $to,
        'messages' => [['type' => 'flex', 'altText' => mb_substr($label, 0, 200), 'contents' => $flex]],
    ]);
    echo str_pad($label, 34, ' ') . ' => HTTP ' . $res->status() . ($res->successful() ? ' ✅' : ' ❌ ' . $res->body()) . "\n";
};

$auction = $mkAuction('第11回 メダカライブオークション');

// ══ 落札者向け ══════════════════════════════════════════════
// ① 落札通知
$w = new \App\Models\WonItem();
$w->setRelation('item', $mkItem('エメキン', $IMG['エメキン']));
$w->winning_price = 12000; $w->quantity = 3; $w->total_amount = 39600;
$push('①落札通知', $flexBuilder->wonItem($w));

// ② 入金確認（画像なし）
$w = new \App\Models\WonItem();
$item = $mkItem('三色体外光亜種', null);
$item->setRelation('auction', $auction);
$w->setRelation('item', $item);
$push('②入金確認', $flexBuilder->paymentConfirmed($w));

// ③ 発送完了
$w = new \App\Models\WonItem();
$w->setRelation('item', $mkItem('和墨白銀', $IMG['和墨白銀']));
$w->shipping_company = 'ヤマト運輸'; $w->tracking_number = '1234-5678-9012';
$push('③発送完了', $flexBuilder->shippingCompleted($w));

// ④ 指値到達（画像なし）
$push('④指値到達', $flexBuilder->bidLimitReached('紅帝リアルロングフィン', 30000, 30000));

// ⑤ オークション開始（参加者）
$push('⑤オークション開始(参加者)', $withHero($flexBuilder->auctionStart($auction), $IMG['黒天幻龍']));

// ⑥ 新規オークション（参加者）
$push('⑥新規オークション', $withHero($flexBuilder->newAuction($auction, 'participant'), $IMG['エメキン']));

// ⑦ お気に入り接近（画像なし）
$push('⑦お気に入り接近', $flexBuilder->favoriteApproaching(999, '和墨ミッドナイトフリル', 3, 'Aレーン', $auction->title));

// ⑧ 入金催促
$w = new \App\Models\WonItem();
$w->setRelation('item', $mkItem('三色体外光亜種', $IMG['三色体外光亜種']));
$w->payment_deadline = Carbon::parse('2026-07-08 23:59'); $w->total_amount = 39600;
$push('⑧入金催促', $flexBuilder->paymentReminder(collect([$w]), 'あと2日'));

// ══ 出品者向け ══════════════════════════════════════════════
// ⑨ 出品落札（出品者）
$w = new \App\Models\WonItem();
$w->setRelation('item', $mkItem('紅帝リアルロングフィン', $IMG['紅帝リアルロングフィン']));
$w->winning_price = 25000; $w->quantity = 2; $w->seller_amount = 45000;
$push('⑨出品落札(出品者)', $flexBuilder->itemSold($w));

// ⑩ 出品ID発行（出品者）
$items = [
    ['exhibit_code' => 'A-001', 'item_number' => 1, 'species_name' => 'エメキン'],
    ['exhibit_code' => 'A-002', 'item_number' => 2, 'species_name' => '三色体外光亜種'],
    ['exhibit_code' => 'A-003', 'item_number' => 3, 'species_name' => '和墨白銀'],
];
$push('⑩出品ID発行(出品者)', $withHero($flexBuilder->exhibitCodeIssued($auction, $items), $IMG['和墨白銀']));

// ⑪ オークション開始（出品者）
$push('⑪オークション開始(出品者)', $withHero($flexBuilder->sellerAuctionStart($auction), $IMG['紅帝リアルロングフィン']));

// ⑫ 請求書発行（PDFボタン・画像なし）
$push('⑫請求書発行', $flexBuilder->invoiceReady($auction, 39600, 'https://medaka-ichiba.com/storage/invoices/demo.pdf'));

echo "---- 完了 ----\n";
