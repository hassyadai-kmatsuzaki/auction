<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\StorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 第1回オークション(auction_id=48) 用 サムネ一括設定スクリプト。
 *
 * 各 item に対して、`サムネにする画像サイズ(bytes)` に一致する item_media を
 * is_thumbnail=true / item.thumbnail_path 更新 にて確定する。
 *
 * フロー:
 *   1) ステータス確認 (preparing/scheduled 以外なら --force 必須)
 *   2) 全 183 行を read-only で事前検証
 *      - item が auction 48 に存在
 *      - file_size 一致が「ちょうど1件」
 *      - 動画でない
 *   3) 検証エラーが1件でも残れば書き込みせず終了
 *   4) 単一トランザクションで全件更新
 *   5) コミット後に再 SELECT して final check
 *
 * 使い方:
 *   sudo -u ec2-user php artisan auction48:set-thumbnails --dry-run
 *   sudo -u ec2-user php artisan auction48:set-thumbnails --execute
 */
class SetThumbnailsAuction48 extends Command
{
    protected $signature = 'auction48:set-thumbnails
        {--dry-run : 既定。書き込みせず検証のみ}
        {--execute : 実際にDBへコミット}
        {--force : preparing/scheduled 以外でも実行を許可}';

    protected $description = '第1回オークション(48) のサムネを CSV マッピングに沿って一括設定';

    private const AUCTION_ID = 48;

    /**
     * item_id => 期待 file_size (bytes)
     * CSV「サムネにする画像サイズ(bytes)」より生成。183 件。
     */
    private const ITEM_TARGET_SIZE = [
        1197 => 271060,
        1198 => 468118,
        1199 => 696666,
        1200 => 520578,
        1201 => 690992,
        1202 => 1277369,
        1203 => 3026502,
        1204 => 2341016,
        1205 => 1951429,
        1206 => 3285921,
        1236 => 2918180,
        1237 => 2716242,
        1238 => 3176357,
        1239 => 1782586,
        1240 => 1181325,
        1241 => 2126777,
        1242 => 2778146,
        1243 => 1937354,
        1244 => 939707,
        1245 => 716354,
        1246 => 806526,
        1247 => 577567,
        1248 => 1008811,
        1249 => 835147,
        1250 => 791755,
        1251 => 993267,
        1252 => 699428,
        1253 => 913119,
        1254 => 664220,
        1255 => 624793,
        1256 => 596333,
        1257 => 666096,
        1258 => 667165,
        1259 => 661331,
        1260 => 640786,
        1261 => 883714,
        1262 => 728302,
        1263 => 675718,
        1264 => 2453800,
        1265 => 2574159,
        1266 => 1529850,
        1267 => 2430531,
        1268 => 3115740,
        1269 => 2604616,
        1270 => 2563423,
        1271 => 2429552,
        1272 => 2984758,
        1273 => 3542316,
        1274 => 2806431,
        1275 => 2901834,
        1276 => 2348490,
        1277 => 3441894,
        1278 => 2430193,
        1279 => 2903082,
        1280 => 2219551,
        1281 => 1984186,
        1282 => 3501206,
        1283 => 2290937,
        1284 => 2137344,
        1285 => 2285592,
        1286 => 2460152,
        1287 => 1526040,
        1288 => 2330602,
        1289 => 2354141,
        1290 => 2008522,
        1291 => 1909650,
        1292 => 2631285,
        1293 => 1750801,
        1294 => 2206772,
        1295 => 2598963,
        1296 => 1740752,
        1297 => 2420937,
        1298 => 4316868,
        1299 => 3346070,
        1300 => 2521896,
        1301 => 2812465,
        1302 => 1731263,
        1303 => 3027506,
        1304 => 2015663,
        1305 => 2110644,
        1306 => 2540430,
        1307 => 2202594,
        1308 => 2594784,
        1309 => 1091069,
        1310 => 4274169,
        1311 => 2086931,
        1312 => 2216081,
        1313 => 2028985,
        1314 => 713109,
        1315 => 576139,
        1316 => 661900,
        1317 => 825358,
        1318 => 976304,
        1319 => 593315,
        1320 => 767264,
        1321 => 750318,
        1322 => 556686,
        1323 => 665140,
        1324 => 527085,
        1325 => 979021,
        1326 => 531430,
        1327 => 796526,
        1328 => 1224901,
        1329 => 692255,
        1330 => 610697,
        1331 => 804554,
        1332 => 822620,
        1333 => 710886,
        1334 => 978372,
        1335 => 869763,
        1336 => 667961,
        1337 => 864719,
        1338 => 1014751,
        1339 => 767636,
        1340 => 1016179,
        1341 => 717600,
        1342 => 634403,
        1343 => 821022,
        1344 => 1034305,
        1345 => 618698,
        1346 => 599876,
        1347 => 774254,
        1348 => 506667,
        1349 => 906296,
        1350 => 482954,
        1351 => 654816,
        1352 => 652804,
        1353 => 990111,
        1354 => 698400,
        1355 => 861616,
        1356 => 675479,
        1357 => 765432,
        1358 => 483159,
        1359 => 474383,
        1360 => 2223158,
        1361 => 1692309,
        1362 => 2495779,
        1363 => 2117046,
        1364 => 4756420,
        1365 => 3618860,
        1366 => 1474823,
        1367 => 2518632,
        1368 => 3247703,
        1369 => 3554942,
        1370 => 5091768,
        1371 => 3606221,
        1372 => 2376854,
        1373 => 2789103,
        1374 => 2796741,
        1375 => 3029768,
        1376 => 2597677,
        1377 => 2898165,
        1378 => 2624112,
        1379 => 3140156,
        1580 => 3246506,
        1581 => 2646131,
        1582 => 3066573,
        1583 => 2250826,
        1584 => 2249244,
        1585 => 3062602,
        1586 => 2593118,
        1587 => 2150756,
        1588 => 2923549,
        1589 => 1993747,
        1590 => 2220125,
        1591 => 2164952,
        1592 => 3231050,
        1593 => 2790328,
        1594 => 2480634,
        1595 => 1860495,
        1596 => 3101153,
        1597 => 4033556,
        1598 => 2278483,
        1599 => 1793317,
        1600 => 3546623,
        1601 => 2403115,
        1602 => 4593523,
        1603 => 2203036,
        1604 => 2477558,
        1605 => 3310467,
        1606 => 2315739,
        1607 => 2416461,
        1608 => 2440512,
    ];

    public function handle(StorageService $storage): int
    {
        $execute = (bool) $this->option('execute');
        $force = (bool) $this->option('force');

        // 念のため item_id 数の自己チェック
        $rowCount = count(self::ITEM_TARGET_SIZE);
        if ($rowCount !== 183) {
            $this->error("内部マッピングが183件ではありません: {$rowCount} 件");
            return self::FAILURE;
        }

        // --- ステータスチェック ---
        $auction = Auction::find(self::AUCTION_ID);
        if (! $auction) {
            $this->error('auction_id=' . self::AUCTION_ID . ' が見つかりません');
            return self::FAILURE;
        }
        $this->info("auction_id={$auction->id} title=\"{$auction->title}\" status={$auction->status}");
        if (! in_array($auction->status, ['preparing', 'scheduled'], true) && ! $force) {
            $this->error("status が preparing/scheduled ではありません ({$auction->status})。--force で上書き可。");
            return self::FAILURE;
        }

        // --- 事前検証 (read-only) ---
        $this->info('--- 事前検証 ---');
        $plans = [];
        $errors = [
            'item_not_found' => [],
            'no_match' => [],
            'multiple_match' => [],
            'video_match' => [],
        ];

        foreach (self::ITEM_TARGET_SIZE as $itemId => $targetSize) {
            $item = Item::where('auction_id', self::AUCTION_ID)
                ->where('id', $itemId)
                ->first();
            if (! $item) {
                $errors['item_not_found'][] = $itemId;
                continue;
            }

            $matches = ItemMedia::where('item_id', $itemId)
                ->where('file_size', $targetSize)
                ->get();

            if ($matches->isEmpty()) {
                $allSizes = ItemMedia::where('item_id', $itemId)
                    ->pluck('file_size')->all();
                $errors['no_match'][] = [
                    'item_id' => $itemId,
                    'target' => $targetSize,
                    'actual_sizes' => $allSizes,
                ];
                continue;
            }
            if ($matches->count() > 1) {
                $errors['multiple_match'][] = [
                    'item_id' => $itemId,
                    'target' => $targetSize,
                    'media_ids' => $matches->pluck('id')->all(),
                ];
                continue;
            }

            $target = $matches->first();
            if (str_starts_with((string) $target->media_type, 'video')
                || str_starts_with((string) $target->mime_type, 'video/')) {
                $errors['video_match'][] = [
                    'item_id' => $itemId,
                    'media_id' => $target->id,
                    'media_type' => $target->media_type,
                ];
                continue;
            }

            $plans[] = [
                'item' => $item,
                'media' => $target,
            ];
        }

        $errCount = array_sum(array_map('count', $errors));
        $this->info('検証OK: ' . count($plans) . ' 件 / 検証NG: ' . $errCount . ' 件');

        if ($errCount > 0) {
            $this->displayErrors($errors);
            $this->error('検証エラーがあるため処理を中断します（書き込みなし）。');
            return self::FAILURE;
        }

        if (count($plans) !== 183) {
            $this->error('検証通過件数が183件と一致しません: ' . count($plans));
            return self::FAILURE;
        }

        // --- DryRun はここで終了 ---
        if (! $execute) {
            $this->warn('DRY-RUN: 183 件すべて検証OK。--execute で実コミットします。');
            return self::SUCCESS;
        }

        // --- 実行 (single transaction) ---
        $this->info('--- 実行 ---');
        $updated = 0;
        $skippedAlready = 0;

        DB::transaction(function () use ($plans, $storage, &$updated, &$skippedAlready) {
            foreach ($plans as $plan) {
                /** @var Item $item */
                $item = $plan['item'];
                /** @var ItemMedia $target */
                $target = $plan['media'];

                $desiredUrl = $storage->url($target->file_path);

                // すでに完全一致なら no-op (1197-1201 等で発生想定)
                if ((bool) $target->is_thumbnail === true
                    && $item->thumbnail_path === $desiredUrl) {
                    // 他のメディアの is_thumbnail が誤って true になっていないかも一応確認
                    $stale = ItemMedia::where('item_id', $item->id)
                        ->where('id', '!=', $target->id)
                        ->where('is_thumbnail', true)
                        ->exists();
                    if (! $stale) {
                        $skippedAlready++;
                        continue;
                    }
                }

                // 既存のサムネを全解除
                ItemMedia::where('item_id', $item->id)->update(['is_thumbnail' => false]);

                // 対象を立てる (fresh して latest data に基づいて save)
                $target->refresh();
                $target->is_thumbnail = true;
                $target->save();

                // item.thumbnail_path 更新
                $item->thumbnail_path = $desiredUrl;
                $item->save();

                $updated++;
            }
        });

        $this->info("コミット完了: 更新={$updated} 件, 既に正しい={$skippedAlready} 件");

        // --- 事後検証 ---
        $this->info('--- 事後検証 ---');
        $finalErrors = [];
        foreach (self::ITEM_TARGET_SIZE as $itemId => $targetSize) {
            $thumb = ItemMedia::where('item_id', $itemId)
                ->where('is_thumbnail', true)
                ->get();
            if ($thumb->count() !== 1) {
                $finalErrors[] = ['item_id' => $itemId, 'reason' => 'thumb_count=' . $thumb->count()];
                continue;
            }
            if ((int) $thumb->first()->file_size !== $targetSize) {
                $finalErrors[] = [
                    'item_id' => $itemId,
                    'reason' => 'size_mismatch',
                    'target' => $targetSize,
                    'actual' => $thumb->first()->file_size,
                ];
            }
        }

        if (! empty($finalErrors)) {
            $this->error('事後検証 NG: ' . count($finalErrors) . ' 件');
            foreach ($finalErrors as $e) {
                $this->line(json_encode($e, JSON_UNESCAPED_UNICODE));
            }
            return self::FAILURE;
        }

        $this->info('事後検証 OK: 183/183 件 サムネ整合済み');
        return self::SUCCESS;
    }

    private function displayErrors(array $errors): void
    {
        foreach ($errors as $kind => $list) {
            if (empty($list)) {
                continue;
            }
            $this->warn("--- {$kind}: " . count($list) . ' 件 ---');
            foreach ($list as $row) {
                $this->line(is_array($row)
                    ? json_encode($row, JSON_UNESCAPED_UNICODE)
                    : (string) $row);
            }
        }
    }
}
