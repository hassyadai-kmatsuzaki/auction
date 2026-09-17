<?php

namespace Tests\Unit\Config;

use Tests\TestCase;

/**
 * 2026-09-17: Redis の常時接続（REDIS_PERSISTENT=true）を安全に使うための設定の前提。
 *
 * phpredis の常時接続は「ホスト・ポート・タイムアウト・persistent_id」が同じなら同じソケットを再利用する。
 * このアプリは 1 回の要求の中で DB 0（キュー・キャッシュのロック）と DB 1（キャッシュ本体）の両方に触れる
 * （例: BidService::sharedState が Cache::get と Cache::lock を続けて呼ぶ）。
 * persistent_id が同じだと、片方の select(DB) がもう片方に効き、カウントダウンの状態やキューが別の DB に書かれる。
 */
class RedisPersistentConnectionTest extends TestCase
{
    public function test_接続ごとにpersistent_idが設定されていて互いに異なる(): void
    {
        $default = config('database.redis.default');
        $cache   = config('database.redis.cache');

        $this->assertNotEmpty($default['persistent_id'] ?? null, 'default に persistent_id が無い');
        $this->assertNotEmpty($cache['persistent_id'] ?? null, 'cache に persistent_id が無い');
        $this->assertNotSame($default['persistent_id'], $cache['persistent_id'], 'default と cache が同じソケットを共有してしまう');
    }

    public function test_同じホストとポートで別のDBを使っている(): void
    {
        // この前提が崩れた（DB を分けなくなった）なら persistent_id を分ける必要も無くなるが、
        // 今は分けているので、上のテストが意味を持つことを確認しておく
        $default = config('database.redis.default');
        $cache   = config('database.redis.cache');

        $this->assertSame($default['host'], $cache['host']);
        $this->assertSame((string) $default['port'], (string) $cache['port']);
        $this->assertNotSame((string) $default['database'], (string) $cache['database']);
    }

    public function test_キャッシュのロックとキューはdefault接続を使う(): void
    {
        // 1 回の要求で DB 0 と DB 1 の両方に触れる根拠（これが変わったら見直す）
        $this->assertSame('cache', config('cache.stores.redis.connection'));
        $this->assertSame('default', config('cache.stores.redis.lock_connection'));
        $this->assertSame('default', config('queue.connections.redis.connection'));
    }

    public function test_常時接続は既定でオフ(): void
    {
        // 本番・ステージングで有効にするかは .env で決める。コードの既定は従来どおり false
        $this->assertFalse((bool) env('REDIS_PERSISTENT', false));
    }
}
