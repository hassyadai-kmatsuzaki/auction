<?php

namespace App\Support\Aws;

use Aws\CacheInterface;
use Illuminate\Support\Facades\Cache;

/**
 * A-13 (2026-09-08): AWS SDK の認証情報キャッシュを Laravel の cache（本番は Redis）に載せる。
 *
 * IAM Role 運用では php-fpm の各プロセスがリクエストごとに IMDS（169.254.169.254）へ
 * 認証情報を取りに行き、一斉アクセス時に散発的な 401 → 画像 API 500（0.2%）になっていた。
 * ここに載せると、ホスト上の全プロセスが 1 回取った認証情報を共有する。
 *
 * TTL は有効期限の 5 分手前で切る（期限ぎりぎりの認証情報を使い回さない）。
 */
class LaravelCacheAdapter implements CacheInterface
{
    public const EARLY_REFRESH_SECONDS = 300;

    public function __construct(private readonly ?string $store = null) {}

    public function get($key)
    {
        try {
            return Cache::store($this->store)->get($this->prefix($key));
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function set($key, $value, $ttl = 0)
    {
        $ttl = (int) $ttl;
        if ($ttl > 0) {
            $ttl = max(60, $ttl - self::EARLY_REFRESH_SECONDS);
        }

        try {
            if ($ttl > 0) {
                Cache::store($this->store)->put($this->prefix($key), $value, $ttl);
            } else {
                // 期限なし（静的キー）はそもそも IMDS を使わないので 1 時間で十分
                Cache::store($this->store)->put($this->prefix($key), $value, 3600);
            }
        } catch (\Throwable $e) {
            // キャッシュに書けなくても認証情報自体は返せるので握る
        }
    }

    public function remove($key)
    {
        try {
            Cache::store($this->store)->forget($this->prefix($key));
        } catch (\Throwable $e) {
        }
    }

    private function prefix(string $key): string
    {
        return 'aws:' . $key;
    }
}
