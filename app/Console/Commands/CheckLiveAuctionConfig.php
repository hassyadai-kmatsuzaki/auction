<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

/**
 * 本番でライブオークションを開始する前に、最低限の設定が正しいかを検証する。
 *
 * 確認項目:
 *   - QUEUE_CONNECTION が redis であること（database だと jobs テーブル詰まり）
 *   - CACHE_STORE / CACHE_DRIVER が redis であること（カウントダウン状態保持に必須）
 *   - Redis に PING で疎通可能
 *   - DB queue retry_after が 14400 秒以上（database 接続を使う場合のフェイルセーフ）
 *   - BROADCAST_HOST が 8080 を直接指していない（Reverb は 6001）
 *
 * 使い方: php artisan auctions:check-config
 * 終了コード: 0=OK / 1=NG（ライブ開始前にこれが 0 で返ることを確認すること）
 */
class CheckLiveAuctionConfig extends Command
{
    protected $signature = 'auctions:check-config {--strict : 警告も失敗扱いにする}';

    protected $description = 'ライブオークション開始前の設定検証（queue / cache / broadcast）';

    public function handle(): int
    {
        $errors = [];
        $warnings = [];

        // ─── Queue ─────────────────────────────────────────────
        $queue = config('queue.default');
        $this->line("queue.default = <info>{$queue}</info>");
        if ($queue !== 'redis') {
            $errors[] = "queue.default が '{$queue}' になっています。本番では 'redis' を使ってください（database だと long-running countdown ジョブで jobs テーブルが詰まります）。";
        }

        $dbQueueRetry = (int) config('queue.connections.database.retry_after', 0);
        if ($dbQueueRetry < 14400) {
            $warnings[] = "queue.connections.database.retry_after = {$dbQueueRetry} 秒。database を使う場合は 14400 以上推奨（countdown ジョブの timeout=14400 と一致）。";
        }
        $redisQueueRetry = (int) config('queue.connections.redis.retry_after', 0);
        if ($redisQueueRetry < 14400) {
            $errors[] = "queue.connections.redis.retry_after = {$redisQueueRetry} 秒。14400 以上必須（countdown ジョブが二重実行されます）。";
        } else {
            $this->line("queue.connections.redis.retry_after = <info>{$redisQueueRetry}</info>");
        }

        // ─── Cache ─────────────────────────────────────────────
        $cache = config('cache.default');
        $this->line("cache.default = <info>{$cache}</info>");
        if ($cache !== 'redis') {
            $errors[] = "cache.default が '{$cache}' になっています。countdown:lane:* キャッシュは Redis 前提なので 'redis' に設定してください。";
        }

        // ─── Redis 疎通 ────────────────────────────────────────
        try {
            $pong = Redis::connection()->ping();
            $this->line("redis ping = <info>{$pong}</info>");
        } catch (\Throwable $e) {
            $errors[] = 'Redis 疎通失敗: ' . $e->getMessage();
        }

        try {
            Cache::put('auctions:check-config:probe', '1', 5);
            $probe = Cache::get('auctions:check-config:probe');
            if ($probe !== '1') {
                $errors[] = 'Cache::put / Cache::get の疎通テストに失敗（値が一致しない）';
            } else {
                $this->line('cache write/read = <info>OK</info>');
            }
            Cache::forget('auctions:check-config:probe');
        } catch (\Throwable $e) {
            $errors[] = 'Cache 疎通失敗: ' . $e->getMessage();
        }

        // ─── DB ─────────────────────────────────────────────────
        try {
            $name = DB::connection()->getDatabaseName();
            $this->line("db connection = <info>{$name}</info>");
        } catch (\Throwable $e) {
            $errors[] = 'DB 疎通失敗: ' . $e->getMessage();
        }

        // ─── Broadcast / Reverb ────────────────────────────────
        $broadcast = config('broadcasting.default');
        $this->line("broadcast.default = <info>{$broadcast}</info>");
        if ($broadcast !== 'reverb') {
            $warnings[] = "broadcast.default = '{$broadcast}'。本番では 'reverb' 推奨。";
        }

        $reverbHost = config('broadcasting.connections.reverb.options.host')
            ?? env('REVERB_HOST');
        $reverbPort = (int) (config('broadcasting.connections.reverb.options.port')
            ?? env('REVERB_PORT', 0));
        $this->line("reverb host:port = <info>{$reverbHost}:{$reverbPort}</info>");
        if ($reverbPort === 8080) {
            $errors[] = "REVERB_PORT が 8080 です。nginx 8080 は WebSocket 専用 proxy。サーバ側 Reverb は 6001 を直接指してください（過去事故あり）。";
        }

        // ─── 結果出力 ──────────────────────────────────────────
        $this->newLine();
        foreach ($warnings as $w) {
            $this->warn('[WARN] ' . $w);
        }
        foreach ($errors as $err) {
            $this->error('[ERROR] ' . $err);
        }

        if (!empty($errors)) {
            return Command::FAILURE;
        }
        if ($this->option('strict') && !empty($warnings)) {
            return Command::FAILURE;
        }

        $this->info('All checks passed.');
        return Command::SUCCESS;
    }
}
