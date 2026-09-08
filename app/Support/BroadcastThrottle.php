<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * B-2 (2026-09-08): 配信の間引き。
 *
 * 入札成功ごとに BidderUpdated を全接続へ配っていたが、その内容（入札者数）は
 * CountdownTick が入札受付中に毎秒運んでいるため、サブ秒の即時性以外は冗長。
 * 500 接続で人気商品に 100 タップ/2秒が来ると 100 × 500 = 5 万通を単一プロセスの
 * Reverb が配ることになり、tick まで遅れて「全画面が止まって見える」経路になる。
 *
 * 商品ごとにミリ秒粒度の排他キーを置き、窓内の再送を抑止する。間引かれた分は次の tick が正す。
 * Redis が使えない環境（テストの array キャッシュ等）では間引かず通す（best-effort）。
 */
class BroadcastThrottle
{
    /**
     * @param  string $key        商品単位などの識別子
     * @param  int    $windowMs   抑止する窓（ミリ秒）。0 以下なら常に許可
     * @return bool               true = 配信してよい
     */
    public static function allow(string $key, int $windowMs): bool
    {
        if ($windowMs <= 0) {
            return true;
        }

        try {
            if (config('cache.default') !== 'redis') {
                // Redis 前提のミリ秒キーは張れない。1 秒粒度の Cache::add で近似せず、
                // 挙動をテストで変えないために素通しにする。
                return true;
            }
            // SET key 1 PX <ms> NX … 既にあれば false（= 窓内なので抑止）
            $result = Redis::connection('cache')->set("broadcast_throttle:{$key}", 1, 'PX', $windowMs, 'NX');
            return (bool) $result;
        } catch (\Throwable $e) {
            // 間引きの失敗で配信を止めない。ログは 60 秒に 1 回に抑える。
            if (Cache::add('broadcast_throttle:warned', 1, 60)) {
                Log::warning('BroadcastThrottle unavailable, passing through', ['error' => $e->getMessage()]);
            }
            return true;
        }
    }
}
