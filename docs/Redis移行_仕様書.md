# Redis移行 & Pusher廃止 仕様書

> 作成日: 2026-03-04
> ステータス: 実装中
> 目的: DB依存のキャッシュ/キュー/セッションをRedisに移行し、PusherをLaravel Reverbに置き換える

---

## 目次

1. [概要](#1-概要)
2. [移行対象と変更一覧](#2-移行対象と変更一覧)
3. [アーキテクチャ比較](#3-アーキテクチャ比較)
4. [AWS ElastiCache 設定ガイド](#4-aws-elasticache-設定ガイド)
5. [Laravel Reverb 導入ガイド](#5-laravel-reverb-導入ガイド)
6. [環境変数の変更](#6-環境変数の変更)
7. [Docker開発環境の変更](#7-docker開発環境の変更)
8. [コード変更一覧](#8-コード変更一覧)
9. [移行手順（本番デプロイ）](#9-移行手順本番デプロイ)
10. [パフォーマンス改善効果](#10-パフォーマンス改善効果)
11. [ロールバック手順](#11-ロールバック手順)

---

## 1. 概要

### 移行の目的

| 課題 | 現状 | 移行後 |
|------|------|--------|
| キャッシュがDB経由で低速 | `CACHE_STORE=database` | `CACHE_STORE=redis` |
| キューがDB経由で高負荷 | `QUEUE_CONNECTION=database` | `QUEUE_CONNECTION=redis` |
| セッションがDB経由 | `SESSION_DRIVER=database` | `SESSION_DRIVER=redis` |
| Pusher月額$299/月 | `BROADCAST_CONNECTION=pusher` | `BROADCAST_CONNECTION=reverb`（無料） |
| 500人同時接続でボトルネック | DBキャッシュで60クエリ/秒 | Redisで12回/秒（インメモリ） |

### 移行後のアーキテクチャ

```
[ブラウザ] ←WebSocket→ [Laravel Reverb] ←Redis Pub/Sub→ [Laravel App]
                                                              ↓
                                                     [Redis] (Cache/Queue/Session)
                                                              ↓
                                                     [MySQL] (永続データのみ)
```

---

## 2. 移行対象と変更一覧

| 対象 | 変更前 | 変更後 | 影響範囲 |
|------|--------|--------|---------|
| キャッシュ | database | **redis** | .env のみ |
| キュー | database | **redis** | .env + docker-compose |
| セッション | database | **redis** | .env のみ |
| ブロードキャスト | pusher | **reverb** | .env + echo.ts + composer |
| WebSocket | Pusher SaaS | **Laravel Reverb** | docker-compose + デプロイ |

---

## 3. アーキテクチャ比較

### 現在（Pusher + DB）

```
[ブラウザ] ←WebSocket→ [Pusher SaaS (月額$299)]
                              ↑
[Laravel] → broadcast() → HTTP POST → [Pusher API]
    ↓
[MySQL] ← Cache::get/put (DBキャッシュ)
[MySQL] ← Queue::push (DBキュー)
[MySQL] ← Session (DBセッション)
```

### 移行後（Reverb + Redis）

```
[ブラウザ] ←WebSocket→ [Laravel Reverb (自前・無料)]
                              ↑
[Laravel] → broadcast() → [Redis Pub/Sub] → [Reverb]
    ↓
[Redis] ← Cache::get/put (インメモリ・100倍高速)
[Redis] ← Queue::push (インメモリ)
[Redis] ← Session (インメモリ)
    ↓
[MySQL] ← 永続データのみ（商品・入札・落札）
```

---

## 4. AWS ElastiCache 設定ガイド

### 4.1 ElastiCache for Redis の作成

#### ステップ1: AWSコンソールでElastiCacheを作成

1. AWS Management Console → **ElastiCache** → 「Redis OSS キャッシュを作成」
2. 以下の設定を選択:

| 設定項目 | 推奨値 | 説明 |
|---------|--------|------|
| クラスターモード | **無効** | 単一ノードで十分（500人規模） |
| エンジンバージョン | **7.x** | 最新安定版 |
| ノードタイプ | **cache.t3.small** | 500人規模なら十分（1.5GB RAM） |
| レプリカ数 | **1**（本番）/ **0**（開発） | 可用性のため |
| マルチAZ | **有効**（本番） | 障害時の自動フェイルオーバー |
| サブネットグループ | EC2と同じVPC内 | プライベートサブネット推奨 |
| セキュリティグループ | EC2からの6379ポートを許可 | インバウンド: TCP 6379 |
| 暗号化（転送中） | **有効** | TLS通信 |
| 暗号化（保存時） | **有効** | データ暗号化 |
| 認証 | **AUTH トークン設定** | パスワード保護 |

#### ステップ2: セキュリティグループの設定

```
インバウンドルール:
  タイプ: カスタムTCP
  ポート: 6379
  ソース: EC2のセキュリティグループID（sg-xxxxx）
```

#### ステップ3: 接続情報の確認

作成完了後、以下の情報をメモ:

```
プライマリエンドポイント: your-cluster.xxxxx.0001.apne1.cache.amazonaws.com
ポート: 6379
AUTH トークン: （設定したパスワード）
```

### 4.2 コスト見積もり

| インスタンス | 月額（東京リージョン） | 用途 |
|-------------|---------------------|------|
| cache.t3.micro | 約$15/月 | 開発・テスト |
| cache.t3.small | 約$30/月 | 本番（500人規模） |
| cache.t3.medium | 約$60/月 | 本番（1000人規模） |

**Pusher Business ($299/月) → ElastiCache ($30/月) + Reverb (無料) = 約$270/月の削減**

### 4.3 本番 .env の設定

```env
# Redis (AWS ElastiCache)
REDIS_CLIENT=phpredis
REDIS_HOST=your-cluster.xxxxx.0001.apne1.cache.amazonaws.com
REDIS_PASSWORD=your-auth-token
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1

# TLS接続（ElastiCacheの暗号化有効時）
REDIS_SCHEME=tls
```

---

## 5. Laravel Reverb 導入ガイド

### 5.1 Reverbとは

Laravel公式のWebSocketサーバー。Pusherプロトコル互換のため、既存の `laravel-echo` + `pusher-js` がそのまま動作する。

### 5.2 インストール

```bash
composer require laravel/reverb
php artisan reverb:install
```

### 5.3 Reverb の設定

`config/reverb.php` が自動生成される。主要設定:

```php
'servers' => [
    'reverb' => [
        'host' => env('REVERB_SERVER_HOST', '0.0.0.0'),
        'port' => env('REVERB_SERVER_PORT', 8080),
        'hostname' => env('REVERB_HOST'),
        'options' => [
            'tls' => [],
        ],
        'scaling' => [
            'enabled' => env('REVERB_SCALING_ENABLED', false),
            'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
        ],
        'pulse_ingest_interval' => env('REVERB_PULSE_INGEST_INTERVAL', 15),
        'allowed_origins' => ['*'],
    ],
],
```

### 5.4 Reverbの起動

```bash
php artisan reverb:start --host=0.0.0.0 --port=8080
```

本番ではsupervisordで常駐化:

```ini
[program:reverb]
command=php /var/www/html/artisan reverb:start --host=0.0.0.0 --port=8080
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/reverb.log
```

---

## 6. 環境変数の変更

### 6.1 開発環境 (.env)

```env
# === Redis ===
REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1

# === Cache / Queue / Session → Redis ===
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

# === Broadcast → Reverb ===
BROADCAST_CONNECTION=reverb

# === Reverb (Pusher廃止) ===
REVERB_APP_ID=auction-local
REVERB_APP_KEY=auction-local-key
REVERB_APP_SECRET=auction-local-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

### 6.2 本番環境 (.env)

```env
# === Redis (AWS ElastiCache) ===
REDIS_CLIENT=phpredis
REDIS_HOST=your-cluster.xxxxx.0001.apne1.cache.amazonaws.com
REDIS_PASSWORD=your-auth-token
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1
REDIS_SCHEME=tls

# === Cache / Queue / Session → Redis ===
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

# === Broadcast → Reverb ===
BROADCAST_CONNECTION=reverb

# === Reverb ===
REVERB_APP_ID=auction-prod
REVERB_APP_KEY=your-production-key
REVERB_APP_SECRET=your-production-secret
REVERB_HOST=ws.your-domain.com
REVERB_PORT=443
REVERB_SCHEME=https

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

---

## 7. Docker開発環境の変更

### docker-compose.yml に追加するサービス

```yaml
redis:
  container_name: auction-redis
  image: redis:7-alpine
  ports:
    - "26379:6379"
  volumes:
    - auction-redis-volume:/data
  command: redis-server --appendonly yes
  restart: unless-stopped

reverb:
  container_name: auction-reverb
  build: ./docker/php
  volumes:
    - ./docker/php/php.ini:/usr/local/etc/php/conf.d/custom.ini
    - ./src:/var/www/html
  command: php artisan reverb:start --host=0.0.0.0 --port=8080
  ports:
    - "8080:8080"
  depends_on:
    - redis
  restart: unless-stopped
```

---

## 8. コード変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `docker-compose.yml` | redis, reverb サービス追加、queue コマンド変更 |
| `docker/php/Dockerfile` | phpredis 拡張追加 |
| `.env.example` | Redis/Reverb 設定に変更 |
| `resources/ts/lib/echo.ts` | Pusher → Reverb に接続先変更 |
| `config/queue.php` | redis の retry_after を調整 |

---

## 9. 移行手順（本番デプロイ）

### Phase 1: AWS ElastiCache 準備

1. ElastiCache for Redis を作成（セクション4参照）
2. セキュリティグループでEC2→Redis の6379を許可
3. EC2から接続テスト: `redis-cli -h <endpoint> -p 6379 -a <password> ping`

### Phase 2: Redis移行（キャッシュ/キュー/セッション）

1. `.env` を更新（CACHE_STORE, QUEUE_CONNECTION, SESSION_DRIVER）
2. `php artisan config:clear && php artisan cache:clear`
3. キューワーカーを再起動（redis接続に切り替え）
4. 動作確認

### Phase 3: Reverb導入（Pusher廃止）

1. `composer require laravel/reverb`
2. `php artisan reverb:install`
3. `.env` に REVERB_* 設定を追加
4. BROADCAST_CONNECTION=reverb に変更
5. フロントエンドの echo.ts を更新
6. `npm run build` でフロントをリビルド
7. Reverbプロセスを起動（supervisord）
8. Nginx でWebSocketプロキシ設定
9. 動作確認後、Pusherのサブスクリプションを解約

### Nginx WebSocket プロキシ設定

```nginx
# /etc/nginx/conf.d/reverb.conf
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name ws.your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass             http://127.0.0.1:8080;
        proxy_http_version     1.1;
        proxy_set_header       Upgrade $http_upgrade;
        proxy_set_header       Connection $connection_upgrade;
        proxy_set_header       Host $host;
        proxy_set_header       X-Real-IP $remote_addr;
        proxy_set_header       X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header       X-Forwarded-Proto $scheme;
        proxy_read_timeout     86400;
        proxy_send_timeout     86400;
    }
}
```

---

## 10. パフォーマンス改善効果

| 指標 | 移行前 | 移行後 | 改善率 |
|------|--------|--------|--------|
| Cache読み書き | 5〜10ms (MySQL) | **0.1〜0.5ms (Redis)** | **20倍高速** |
| Queue処理 | 10〜50ms (MySQL) | **1〜5ms (Redis)** | **10倍高速** |
| カウントダウンtick | 60 DBクエリ/秒 | **12 Redis操作/秒** | **5倍削減** |
| WebSocket月額 | $299/月 (Pusher) | **$0 (Reverb)** | **100%削減** |
| Redis月額 | $0 | **$30/月 (ElastiCache)** | — |
| **合計月額** | **$299/月** | **$30/月** | **$269/月削減** |

---

## 11. ロールバック手順

万が一問題が発生した場合:

```env
# .env を元に戻す
CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database
BROADCAST_CONNECTION=pusher
```

```bash
php artisan config:clear
php artisan cache:clear
# キューワーカーを再起動
```

Pusherの設定は残しておくため、即座にロールバック可能。
