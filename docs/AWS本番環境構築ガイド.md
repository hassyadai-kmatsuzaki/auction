# AWS 本番環境構築ガイド

> 作成日: 2026-03-04
> 対象: ライブオークションシステム（Laravel + React + WebSocket）
> 目標: 同時接続500人に耐える高可用性インフラ

---

## 目次

1. [アーキテクチャ全体図](#1-アーキテクチャ全体図)
2. [AWSサービス構成と選定理由](#2-awsサービス構成と選定理由)
3. [VPC・ネットワーク設計](#3-vpcネットワーク設計)
4. [EC2 インスタンス構築](#4-ec2-インスタンス構築)
5. [ALB（Application Load Balancer）設定](#5-albapplication-load-balancer設定)
6. [RDS（MySQL）設定](#6-rdsmysql設定)
7. [ElastiCache（Redis）設定](#7-elasticacheredis設定)
8. [Nginx 本番設定](#8-nginx-本番設定)
9. [PHP-FPM 本番チューニング](#9-php-fpm-本番チューニング)
10. [Supervisor プロセス管理](#10-supervisor-プロセス管理)
11. [SSL/TLS 証明書（ACM）](#11-ssltls-証明書acm)
12. [デプロイ手順](#12-デプロイ手順)
13. [監視・アラート（CloudWatch）](#13-監視アラートcloudwatch)
14. [セキュリティ設定](#14-セキュリティ設定)
15. [バックアップ・DR](#15-バックアップdr)
16. [コスト見積もり](#16-コスト見積もり)
17. [スケールアップ・スケールアウト戦略](#17-スケールアップスケールアウト戦略)
18. [本番 .env 設定テンプレート](#18-本番-env-設定テンプレート)
19. [トラブルシューティング](#19-トラブルシューティング)

---

## 1. アーキテクチャ全体図

```
                         ┌─────────────┐
                         │  Route 53   │
                         │  (DNS)      │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │    ACM      │
                         │ (SSL証明書)  │
                         └──────┬──────┘
                                │
                    ┌───────────▼───────────┐
                    │   ALB (Application    │
                    │   Load Balancer)      │
                    │                       │
                    │  :443 HTTPS → :80     │
                    │  /app (WebSocket)     │
                    │  / (HTTP)             │
                    └───┬───────────┬───────┘
                        │           │
              ┌─────────▼──┐  ┌────▼─────────┐
              │  EC2 #1    │  │  EC2 #2      │
              │ (Primary)  │  │ (Standby/    │
              │            │  │  Scale-out)  │
              │ ┌────────┐ │  │              │
              │ │ Nginx  │ │  │  (同構成)     │
              │ └──┬──┬──┘ │  │              │
              │    │  │    │  └──────────────┘
              │ ┌──▼┐┌▼──┐ │
              │ │PHP││Rev-│ │
              │ │FPM││erb │ │
              │ └──┬┘└─┬──┘ │
              │    │   │    │
              └────┼───┼────┘
                   │   │
          ┌────────▼───▼────────┐
          │                     │
    ┌─────▼─────┐    ┌─────────▼─────────┐
    │   RDS     │    │   ElastiCache     │
    │  MySQL    │    │   Redis           │
    │ (Multi-AZ)│    │  (Multi-AZ)       │
    │           │    │                   │
    │ 永続データ  │    │ Cache/Queue/      │
    │ 入札/落札  │    │ Session/Pub-Sub   │
    └───────────┘    └───────────────────┘
```

### プロセス構成（EC2 1台あたり）

```
EC2 インスタンス
├── Nginx          … リバースプロキシ + 静的ファイル配信
├── PHP-FPM        … Laravel API（複数ワーカー）
├── Laravel Reverb … WebSocketサーバー（1プロセス）
├── Queue Worker   … キューワーカー（countdown + default）
└── Supervisor     … 上記プロセスの管理・自動再起動
```

---

## 2. AWSサービス構成と選定理由

| サービス | 用途 | 選定理由 |
|---------|------|---------|
| **EC2** (t3.medium) | App/Nginx/Reverb/Queue | WebSocket常駐プロセスがあるためECS/Fargateより制御しやすい |
| **ALB** | ロードバランサー | WebSocket対応、パスベースルーティング、SSL終端 |
| **RDS MySQL** | 永続データ | マネージドDB、自動バックアップ、Multi-AZ |
| **ElastiCache Redis** | Cache/Queue/Session/Pub-Sub | インメモリ高速処理、Reverb Pub/Sub |
| **ACM** | SSL証明書 | 無料、自動更新、ALB統合 |
| **Route 53** | DNS | ALBとの統合、ヘルスチェック |
| **CloudWatch** | 監視・ログ | EC2/RDS/Redis メトリクス、アラート |
| **S3** | 画像/静的アセット | 商品画像の保存（将来） |

### なぜ EC2 か（ECS/Fargate ではなく）

| 要件 | EC2 | ECS/Fargate |
|------|-----|-------------|
| WebSocket常駐プロセス（Reverb） | 簡単に管理 | タスク定義が複雑 |
| Queue Worker（長時間実行） | supervisorで安定 | タイムアウト制約あり |
| 0.5秒ティックのリアルタイム処理 | 低レイテンシ | コンテナオーバーヘッド |
| 運用コスト | 低い | 学習コスト高い |
| 将来のスケールアウト | AMI複製で容易 | より柔軟だが複雑 |

---

## 3. VPC・ネットワーク設計

### 3.1 VPC 作成

```
VPC: auction-vpc
CIDR: 10.0.0.0/16

サブネット構成:
┌─────────────────────────────────────────────┐
│ Public Subnet (AZ-a)  : 10.0.1.0/24        │ ← ALB, EC2
│ Public Subnet (AZ-c)  : 10.0.2.0/24        │ ← ALB (Multi-AZ)
│ Private Subnet (AZ-a) : 10.0.10.0/24       │ ← RDS, Redis
│ Private Subnet (AZ-c) : 10.0.20.0/24       │ ← RDS Standby, Redis Replica
└─────────────────────────────────────────────┘
```

### 3.2 サブネット設計

| サブネット | CIDR | AZ | 用途 |
|-----------|------|-----|------|
| public-a | 10.0.1.0/24 | ap-northeast-1a | ALB, EC2 |
| public-c | 10.0.2.0/24 | ap-northeast-1c | ALB (Multi-AZ) |
| private-a | 10.0.10.0/24 | ap-northeast-1a | RDS Primary, Redis Primary |
| private-c | 10.0.20.0/24 | ap-northeast-1c | RDS Standby, Redis Replica |

### 3.3 ルートテーブル

**Public サブネット（ALB + EC2）:**
```
0.0.0.0/0 → Internet Gateway (igw-xxxxx)
```

**Private サブネット（RDS + Redis）:**
```
10.0.0.0/16 → local（VPC内通信のみ）
※ インターネットアクセス不要（EC2からのみ接続される）
```

> **補足**: EC2をパブリックサブネットに配置するため、NAT Gateway は不要です。
> これにより月額約$45のコスト削減になります。

### 3.4 セキュリティグループ設計

#### sg-alb（ALB用）

| 方向 | ポート | ソース | 説明 |
|------|-------|--------|------|
| インバウンド | 443 | 0.0.0.0/0 | HTTPS |
| インバウンド | 80 | 0.0.0.0/0 | HTTP（→443リダイレクト） |
| アウトバウンド | 全て | 0.0.0.0/0 | — |

#### sg-ec2（EC2用）

| 方向 | ポート | ソース | 説明 |
|------|-------|--------|------|
| インバウンド | 80 | sg-alb | ALBからのHTTP |
| インバウンド | 8080 | sg-alb | ALBからのWebSocket |
| インバウンド | 22 | 3.112.23.0/29 | EC2 Instance Connect（東京リージョン） |
| アウトバウンド | 全て | 0.0.0.0/0 | — |

> **ポイント**: `3.112.23.0/29` は東京リージョン（ap-northeast-1）の EC2 Instance Connect 用IPレンジです。
> これにより、AWSコンソールのブラウザSSHからのみ接続を許可し、外部からのSSHアクセスをブロックできます。

#### sg-rds（RDS用）

| 方向 | ポート | ソース | 説明 |
|------|-------|--------|------|
| インバウンド | 3306 | sg-ec2 | EC2からのMySQL |
| アウトバウンド | 全て | 0.0.0.0/0 | — |

#### sg-redis（ElastiCache用）

| 方向 | ポート | ソース | 説明 |
|------|-------|--------|------|
| インバウンド | 6379 | sg-ec2 | EC2からのRedis |
| アウトバウンド | 全て | 0.0.0.0/0 | — |

---

## 4. EC2 インスタンス構築（画面の手順付き）

> **この章では、AWSコンソールの画面を見ながら1ステップずつ進められるように説明します。**

---

### 4.1 EC2 インスタンスを作成する

#### 手順1: EC2ダッシュボードを開く

1. AWSコンソール（https://console.aws.amazon.com）にログイン
2. 上部の検索バーに「**EC2**」と入力 → 「EC2」をクリック
3. 左メニューの「**インスタンス**」をクリック
4. 右上の「**インスタンスを起動**」ボタン（オレンジ色）をクリック

#### 手順2: 名前を入力

| 項目 | 入力値 |
|------|--------|
| 名前 | `auction-server` |

#### 手順3: AMI（OS）を選択

1. 「**Amazon Linux 2023 AMI**」を選択（デフォルトで選ばれています）
2. アーキテクチャは「**64ビット (x86)**」のまま

> **なぜ Amazon Linux 2023？**: AWSが提供する無料のLinux。EC2 Instance Connect がプリインストール済みです。

#### 手順4: インスタンスタイプを選択

| 項目 | 選択値 | 説明 |
|------|--------|------|
| インスタンスタイプ | **t3.medium** | 2 vCPU / 4GB RAM（同時接続500人規模に対応） |

> **コストの目安**: 約$30〜35/月（東京リージョン）

#### 手順5: キーペアの設定

1. 「**キーペアなしで続行**」を選択

> **理由**: EC2 Instance Connect（ブラウザSSH）で接続するため、キーペアは不要です。
> キーペアのファイル管理が不要になり、セキュリティも向上します。

#### 手順6: ネットワーク設定

「**編集**」ボタンをクリックして、以下を設定します。

| 項目 | 設定値 |
|------|--------|
| VPC | `auction-vpc`（作成済みのVPC） |
| サブネット | **`public-a`**（10.0.1.0/24） |
| パブリックIPの自動割り当て | **有効化** |
| ファイアウォール（セキュリティグループ） | 「**既存のセキュリティグループを選択する**」 |
| セキュリティグループ | **`sg-ec2`**（作成済み） |

> **重要**: 「パブリックIPの自動割り当て」が「**有効化**」になっていることを必ず確認してください。
> これがないと EC2 Instance Connect で接続できません。

#### 手順7: ストレージの設定

| 項目 | 設定値 |
|------|--------|
| サイズ | **30 GiB** |
| ボリュームタイプ | **gp3** |

#### 手順8: 高度な詳細（ユーザーデータ）

1. 「**高度な詳細**」セクションを展開（クリックして開く）
2. 一番下の「**ユーザーデータ**」欄に、以下をコピー＆ペースト

```bash
#!/bin/bash

# === システムアップデート ===
sudo dnf update -y

# === Nginx インストール ===
sudo dnf install -y nginx
sudo systemctl enable nginx

# === PHP 8.2 + 拡張 インストール ===
sudo dnf install -y php8.2 php8.2-fpm php8.2-cli php8.2-common \
    php8.2-mysqlnd php8.2-pdo php8.2-mbstring php8.2-xml \
    php8.2-curl php8.2-zip php8.2-bcmath php8.2-intl \
    php8.2-redis php8.2-opcache php8.2-pcntl

sudo systemctl enable php-fpm

# === Composer インストール ===
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# === Node.js 20 LTS インストール ===
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# === Supervisor インストール ===
sudo dnf install -y supervisor
sudo systemctl enable supervisord

# === Git インストール ===
sudo dnf install -y git

# === CloudWatch Agent インストール ===
sudo dnf install -y amazon-cloudwatch-agent

# === アプリ用ディレクトリ作成 ===
sudo mkdir -p /var/www/auction
sudo chown -R ec2-user:nginx /var/www/auction

# === ログディレクトリ ===
sudo mkdir -p /var/log/auction
sudo chown -R ec2-user:nginx /var/log/auction

echo "=== 初期セットアップ完了 ==="
```

> **ユーザーデータとは？**: EC2が起動した時に自動で実行されるスクリプトです。
> 上記を貼り付けておくと、必要なソフトウェアが全て自動でインストールされます。

#### 手順9: インスタンスを起動

1. 右側の「**概要**」パネルで設定内容を確認
2. 「**インスタンスを起動**」ボタン（オレンジ色）をクリック
3. 「**インスタンスの起動に成功しました**」と表示されれば完了

> **起動には2〜3分かかります。** ユーザーデータのインストールも含めると **約5分** で準備完了です。

---

### 4.2 EC2 Instance Connect で接続する

#### 手順1: インスタンスの状態を確認

1. EC2 → 「**インスタンス**」をクリック
2. `auction-server` の「インスタンスの状態」が「**実行中**」になるまで待つ
3. 「ステータスチェック」が「**2/2 のチェックに合格しました**」になるまで待つ（約2分）

#### 手順2: 接続する

1. `auction-server` のチェックボックスにチェック
2. 上部の「**接続**」ボタンをクリック
3. 「**EC2 Instance Connect**」タブを選択（デフォルト）
4. ユーザー名: **`ec2-user`**（そのまま）
5. 「**接続**」ボタンをクリック

> **ブラウザ上に黒い画面（ターミナル）が開けば接続成功です！**

#### 接続できない場合のチェックリスト

| 確認項目 | 確認方法 |
|---------|---------|
| インスタンスが「実行中」か | EC2 → インスタンス一覧で確認 |
| パブリックIPがあるか | インスタンス詳細の「パブリック IPv4 アドレス」を確認 |
| サブネットがパブリックか | サブネットのルートテーブルに `0.0.0.0/0 → igw-xxx` があるか |
| セキュリティグループ | ポート22で `3.112.23.0/29` が許可されているか |
| ステータスチェック | 「2/2 のチェックに合格」になっているか |

---

### 4.3 初期セットアップの確認

EC2 Instance Connect で接続したら、ユーザーデータが正常に実行されたか確認します。

```bash
# ユーザーデータのログを確認（エラーがないか）
sudo cat /var/log/cloud-init-output.log | tail -5
```

「`=== 初期セットアップ完了 ===`」と表示されていればOKです。

もしまだ実行中の場合は数分待ってから再度確認してください。

各ソフトウェアのバージョン確認:

```bash
nginx -v          # nginx version: 1.xx.x
php -v            # PHP 8.2.x
composer -V       # Composer version 2.x.x
node -v           # v20.x.x
git --version     # git version 2.x.x
```

> **もし PHP 8.2 がインストールされていない場合**（Amazon Linux 2023 のバージョンによる）:
>
> ```bash
> sudo dnf install -y https://rpms.remirepo.net/enterprise/remi-release-9.rpm
> sudo dnf module reset php -y
> sudo dnf module enable php:remi-8.2 -y
> sudo dnf install -y php php-fpm php-cli php-common php-mysqlnd php-pdo \
>     php-mbstring php-xml php-curl php-zip php-bcmath php-intl \
>     php-redis php-opcache php-pcntl
> sudo systemctl enable php-fpm
> ```

---

### 4.4 アプリケーションのデプロイ

EC2 Instance Connect で接続した状態で、以下のコマンドを **1行ずつコピー＆ペースト** して実行します。

#### ステップ1: アプリコードの配置

```bash
cd /var/www/auction
sudo git clone <あなたのリポジトリURL> .
sudo chown -R ec2-user:nginx /var/www/auction
```

> `<あなたのリポジトリURL>` は GitHub などのリポジトリURLに置き換えてください。
> 例: `https://github.com/yourname/auction.git`

#### ステップ2: 依存パッケージのインストール

```bash
cd /var/www/auction
composer install --no-dev --optimize-autoloader
npm ci && npm run build
```

> **この処理には3〜5分かかります。** 途中でエラーが出なければ成功です。

#### ステップ3: 環境設定ファイル（.env）の作成

```bash
cp .env.example .env
```

次に .env ファイルを編集します:

```bash
sudo nano .env
```

> **nano の使い方**:
> - 矢印キーでカーソル移動
> - 文字を入力・削除して編集
> - 保存: `Ctrl + O` → `Enter`
> - 終了: `Ctrl + X`

.env の主要な設定値（セクション18に詳細テンプレートあり）:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://あなたのドメイン

DB_HOST=（RDSのエンドポイント）
DB_DATABASE=auction
DB_USERNAME=admin
DB_PASSWORD=（RDS作成時に設定したパスワード）

REDIS_HOST=（ElastiCacheのエンドポイント）

REVERB_HOST=0.0.0.0
REVERB_PORT=8080
```

#### ステップ4: Laravel の初期設定

```bash
php artisan key:generate
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
```

#### ステップ5: パーミッションの設定

```bash
sudo chown -R ec2-user:nginx /var/www/auction
sudo chmod -R 775 storage bootstrap/cache
```

> **ここまで完了すれば、アプリケーションの配置は完了です！**
> 次のセクション（Nginx設定、Supervisor設定）に進んでください。

---

## 5. ALB（Application Load Balancer）設定

### 5.1 ALB 作成

| 設定項目 | 値 |
|---------|-----|
| 名前 | auction-alb |
| スキーム | インターネット向け |
| IPアドレスタイプ | IPv4 |
| VPC | auction-vpc |
| サブネット | public-a, public-c |
| セキュリティグループ | sg-alb |

### 5.2 リスナー設定

#### HTTPS リスナー（:443）

| ルール | 条件 | アクション |
|--------|------|-----------|
| WebSocket | パス: `/app/*` | → TG: auction-ws (port 8080) |
| デフォルト | その他すべて | → TG: auction-http (port 80) |

#### HTTP リスナー（:80）

| ルール | アクション |
|--------|-----------|
| デフォルト | HTTPS:443 にリダイレクト |

### 5.3 ターゲットグループ

#### auction-http（Nginx / Laravel API）

| 設定 | 値 |
|------|-----|
| プロトコル | HTTP |
| ポート | 80 |
| ヘルスチェックパス | `/api/health` |
| ヘルスチェック間隔 | 30秒 |
| 正常しきい値 | 2回 |
| 異常しきい値 | 3回 |
| タイムアウト | 10秒 |

#### auction-ws（Reverb WebSocket）

| 設定 | 値 |
|------|-----|
| プロトコル | HTTP |
| ポート | 8080 |
| ヘルスチェックパス | `/` |
| ヘルスチェック間隔 | 30秒 |
| **スティッキーセッション** | **有効**（WebSocket接続維持） |
| スティッキー期間 | 86400秒（1日） |

> **重要**: WebSocketターゲットグループでは**スティッキーセッション**を有効にすること。
> WebSocket接続は一度確立されたら同じEC2に維持する必要がある。

### 5.4 ALBのアイドルタイムアウト

```
ALB属性:
  idle_timeout.timeout_seconds = 3600  (デフォルト60秒→1時間に延長)
```

WebSocket接続が途切れないよう、ALBのアイドルタイムアウトを延長する。

### 5.5 ヘルスチェック用エンドポイント

Laravel側に追加:

```php
// routes/api.php
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        Cache::store('redis')->get('health-check');
        return response()->json(['status' => 'ok'], 200);
    } catch (\Exception $e) {
        return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
});
```

---

## 6. RDS（MySQL）設定

### 6.1 RDS 作成

| 設定項目 | 推奨値 | 説明 |
|---------|--------|------|
| エンジン | MySQL 8.0 | 現行と同じ |
| インスタンスクラス | **db.t3.small** | 2 vCPU / 2GB RAM |
| ストレージ | gp3 20GB（自動拡張有効） | 初期は小さく |
| Multi-AZ | **有効** | 自動フェイルオーバー |
| サブネットグループ | private-a, private-c | プライベートサブネット |
| セキュリティグループ | sg-rds | EC2からのみ |
| バックアップ保持期間 | **7日** | 自動バックアップ |
| 暗号化 | **有効** | データ暗号化 |
| パフォーマンスインサイト | **有効** | クエリ分析 |

### 6.2 パラメータグループ（チューニング）

```
[mysqld]
# 文字コード
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci

# 接続数（500人同時接続対応）
max_connections = 200

# バッファ
innodb_buffer_pool_size = 1073741824  # 1GB（メモリの50-75%）
innodb_log_file_size = 268435456      # 256MB

# スロークエリログ
slow_query_log = 1
long_query_time = 1

# タイムゾーン
time_zone = Asia/Tokyo
```

---

## 7. ElastiCache（Redis）設定

> 詳細は `Redis移行_仕様書.md` セクション4を参照

| 設定項目 | 推奨値 |
|---------|--------|
| エンジン | Redis 7.x |
| ノードタイプ | **cache.t3.small**（1.5GB RAM） |
| レプリカ | 1（Multi-AZ） |
| サブネットグループ | private-a, private-c |
| セキュリティグループ | sg-redis |
| 暗号化（転送中/保存時） | 有効 |
| AUTH トークン | 設定する |

---

## 8. Nginx 本番設定

### /etc/nginx/nginx.conf

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    multi_accept on;
    use epoll;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time';

    access_log /var/log/nginx/access.log main;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml;

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # WebSocket upgrade map
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    include /etc/nginx/conf.d/*.conf;
}
```

### /etc/nginx/conf.d/auction.conf

```nginx
# PHP-FPM upstream
upstream php-fpm {
    server unix:/run/php-fpm/www.sock;
}

# Reverb WebSocket upstream
upstream reverb {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name _;

    root /var/www/auction/public;
    index index.php index.html;

    # ALBヘルスチェック
    location /api/health {
        access_log off;
        try_files $uri /index.php?$query_string;
    }

    # 静的ファイル（Viteビルド済み）
    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # 画像・アセット
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # WebSocket (Laravel Reverb)
    location /app {
        proxy_pass http://reverb;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Laravel API & SPA
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass php-fpm;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;

        fastcgi_buffer_size 32k;
        fastcgi_buffers 16 16k;
        fastcgi_read_timeout 300;
    }

    # .ht ファイルへのアクセス拒否
    location ~ /\.ht {
        deny all;
    }

    # .env ファイルへのアクセス拒否
    location ~ /\.env {
        deny all;
    }
}
```

---

## 9. PHP-FPM 本番チューニング

### /etc/php-fpm.d/www.conf

```ini
[www]
user = nginx
group = nginx

; Unix ソケット（TCP より高速）
listen = /run/php-fpm/www.sock
listen.owner = nginx
listen.group = nginx
listen.mode = 0660

; === プロセス管理 ===
; dynamic: 負荷に応じてワーカー数を自動調整
pm = dynamic

; t3.medium (4GB RAM) の場合:
; 1プロセス ≈ 40-60MB → 最大50プロセスで約2.5GB
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
pm.max_requests = 1000

; タイムアウト
request_terminate_timeout = 300

; OPcache（本番必須）
php_admin_value[opcache.enable] = 1
php_admin_value[opcache.memory_consumption] = 256
php_admin_value[opcache.interned_strings_buffer] = 32
php_admin_value[opcache.max_accelerated_files] = 20000
php_admin_value[opcache.validate_timestamps] = 0
php_admin_value[opcache.jit] = 1255
php_admin_value[opcache.jit_buffer_size] = 128M

; ログ
php_admin_value[error_log] = /var/log/php-fpm/www-error.log
slowlog = /var/log/php-fpm/www-slow.log
request_slowlog_timeout = 5
```

> **注意**: `opcache.validate_timestamps = 0` はデプロイ時に `php-fpm reload` が必要。

---

## 10. Supervisor プロセス管理

### /etc/supervisord.d/auction.ini

```ini
; === Laravel Queue Worker (countdown + default) ===
[program:auction-queue-countdown]
command=php /var/www/auction/artisan queue:work redis --queue=countdown --sleep=1 --tries=1 --timeout=14400 --memory=256
directory=/var/www/auction
user=ec2-user
numprocs=5
process_name=%(program_name)s_%(process_num)02d
autostart=true
autorestart=true
startsecs=5
startretries=10
stopwaitsecs=14400
redirect_stderr=true
stdout_logfile=/var/log/auction/queue-countdown-%(process_num)02d.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5

[program:auction-queue-default]
command=php /var/www/auction/artisan queue:work redis --queue=default --sleep=3 --tries=3 --timeout=300 --memory=256
directory=/var/www/auction
user=ec2-user
numprocs=2
process_name=%(program_name)s_%(process_num)02d
autostart=true
autorestart=true
startsecs=5
startretries=10
redirect_stderr=true
stdout_logfile=/var/log/auction/queue-default.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5

; === Laravel Reverb (WebSocket) ===
[program:auction-reverb]
command=php /var/www/auction/artisan reverb:start --host=0.0.0.0 --port=8080
directory=/var/www/auction
user=ec2-user
autostart=true
autorestart=true
startsecs=5
startretries=10
redirect_stderr=true
stdout_logfile=/var/log/auction/reverb.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5

; === グループ定義 ===
[group:auction]
programs=auction-queue-countdown,auction-queue-default,auction-reverb
priority=999
```

### Supervisor 操作コマンド

```bash
# 設定再読み込み
sudo supervisorctl reread
sudo supervisorctl update

# 全プロセス状態確認
sudo supervisorctl status auction:*

# 個別再起動
sudo supervisorctl restart auction:auction-queue-countdown
sudo supervisorctl restart auction:auction-reverb

# 全プロセス再起動
sudo supervisorctl restart auction:*

# キューワーカーの安全な再起動（処理中のジョブ完了後）
php /var/www/auction/artisan queue:restart
```

---

## 11. SSL/TLS 証明書（ACM）

### 11.1 ACM で証明書を発行

1. AWS Certificate Manager → 「証明書をリクエスト」
2. パブリック証明書を選択
3. ドメイン名を入力:
   - `auction.your-domain.com`（メインドメイン）
   - `*.your-domain.com`（ワイルドカード、WebSocket用）
4. DNS検証を選択
5. Route 53 で CNAME レコードを自動作成

### 11.2 ALB に証明書を設定

ALBのHTTPSリスナー (443) に ACM 証明書を関連付け。

> ALBでSSL終端するため、EC2上のNginxはHTTP (80) のみでOK。

---

## 12. デプロイ手順

### 12.1 手動デプロイ手順

```bash
#!/bin/bash
# deploy.sh - 本番デプロイスクリプト

set -e

APP_DIR="/var/www/auction"
BRANCH="main"

echo "=== デプロイ開始: $(date) ==="

cd $APP_DIR

# 1. メンテナンスモード ON
php artisan down --retry=60

# 2. コード更新
git fetch origin
git reset --hard origin/$BRANCH

# 3. Composer 依存関係
composer install --no-dev --optimize-autoloader --no-interaction

# 4. フロントエンドビルド
npm ci
npm run build

# 5. マイグレーション
php artisan migrate --force

# 6. キャッシュクリア & 再生成
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# 7. キューワーカー再起動（処理中のジョブ完了後に再起動）
php artisan queue:restart

# 8. PHP-FPM リロード（OPcache更新）
sudo systemctl reload php-fpm

# 9. Reverb 再起動
sudo supervisorctl restart auction:auction-reverb

# 10. メンテナンスモード OFF
php artisan up

echo "=== デプロイ完了: $(date) ==="
```

### 12.2 デプロイ時の注意点

| 注意点 | 対策 |
|--------|------|
| オークション中のデプロイ | **絶対に避ける**。オークション終了後にデプロイ |
| WebSocket切断 | Reverb再起動でクライアントは自動再接続する |
| OPcache | `php-fpm reload` しないと古いコードが実行される |
| Queue Worker | `queue:restart` で安全に再起動（処理中ジョブ完了後） |

---

## 13. 監視・アラート（CloudWatch）

### 13.1 CloudWatch Agent 設定

`/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`:

```json
{
  "agent": {
    "metrics_collection_interval": 60
  },
  "metrics": {
    "namespace": "Auction",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"],
        "totalcpu": true
      },
      "mem": {
        "measurement": ["mem_used_percent"]
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "resources": ["/"]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/www/auction/storage/logs/laravel.log",
            "log_group_name": "/auction/laravel",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Tokyo"
          },
          {
            "file_path": "/var/log/auction/queue-countdown.log",
            "log_group_name": "/auction/queue-countdown",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Tokyo"
          },
          {
            "file_path": "/var/log/auction/reverb.log",
            "log_group_name": "/auction/reverb",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Tokyo"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/auction/nginx-error",
            "log_stream_name": "{instance_id}",
            "timezone": "Asia/Tokyo"
          }
        ]
      }
    }
  }
}
```

### 13.2 アラート設定

| アラート | メトリクス | 閾値 | アクション |
|---------|----------|------|-----------|
| CPU高負荷 | CPUUtilization | > 80% (5分) | SNS通知 |
| メモリ不足 | mem_used_percent | > 85% | SNS通知 |
| ディスク不足 | disk_used_percent | > 80% | SNS通知 |
| RDS CPU | CPUUtilization | > 80% (5分) | SNS通知 |
| RDS 空き容量 | FreeStorageSpace | < 5GB | SNS通知 |
| Redis メモリ | DatabaseMemoryUsagePercentage | > 80% | SNS通知 |
| Redis 接続数 | CurrConnections | > 200 | SNS通知 |
| ALB 5xx | HTTPCode_ELB_5XX_Count | > 10 (1分) | SNS通知 |
| ALB レイテンシ | TargetResponseTime | > 3秒 (5分) | SNS通知 |
| ヘルスチェック失敗 | UnHealthyHostCount | > 0 | SNS通知 |

---

## 14. セキュリティ設定

### 14.1 EC2 セキュリティ

EC2 Instance Connect を使用するため、SSH鍵の管理は不要です。
セキュリティグループ（sg-ec2）で以下のみ許可しています:

| ポート | 許可元 | 用途 |
|--------|--------|------|
| 80 | sg-alb | ALBからのHTTP |
| 8080 | sg-alb | ALBからのWebSocket |
| 22 | 3.112.23.0/29 | EC2 Instance Connect（東京リージョン） |

> **ポイント**: SSH（ポート22）は EC2 Instance Connect の AWS IPレンジのみ許可。
> 外部からの直接SSH接続はブロックされます。

#### EC2への接続方法

1. AWSコンソール → EC2 → インスタンス → `auction-server` を選択
2. 「**接続**」ボタン → 「**EC2 Instance Connect**」タブ → 「**接続**」

> ブラウザ上でターミナルが開きます。SSH鍵やSSMの設定は不要です。

### 14.2 アプリケーションセキュリティ

EC2 Instance Connect で接続後、以下を確認してください:

```bash
# .env ファイルのパーミッション（他ユーザーから読めないようにする）
chmod 600 /var/www/auction/.env

# storage ディレクトリ
chmod -R 775 /var/www/auction/storage
chmod -R 775 /var/www/auction/bootstrap/cache
```

.env ファイルで以下が設定されていることを確認:

```
APP_DEBUG=false
APP_ENV=production
```

---

## 15. バックアップ・DR

### 15.1 RDS 自動バックアップ

| 設定 | 値 |
|------|-----|
| 自動バックアップ | 有効 |
| 保持期間 | 7日 |
| バックアップウィンドウ | 18:00-19:00 UTC（日本時間 03:00-04:00） |
| Multi-AZ | 有効（自動フェイルオーバー） |

### 15.2 ElastiCache バックアップ

| 設定 | 値 |
|------|-----|
| 自動バックアップ | 有効 |
| 保持期間 | 3日 |
| バックアップウィンドウ | 19:00-20:00 UTC |

### 15.3 EC2 AMI バックアップ

```bash
# 週次でAMIを作成（AWS Backup or スクリプト）
aws ec2 create-image \
  --instance-id i-xxxxxxxxxxxxx \
  --name "auction-$(date +%Y%m%d)" \
  --no-reboot
```

### 15.4 アプリコードのバックアップ

Git リポジトリ（GitHub/CodeCommit）が正のソース。EC2上のコードは `git pull` で復元可能。

---

## 16. コスト見積もり

> ※ 東京リージョン (ap-northeast-1) 2026年3月時点の概算。
> 為替レート $1 = ¥150 で日本円換算。
> 正確な料金は [AWS Pricing Calculator](https://calculator.aws/) で確認してください。

### 16.1 推奨構成（500人同時接続）— 月額詳細

#### コンピューティング

| サービス | スペック | 単価 | 時間/月 | 月額 (USD) | 月額 (JPY) |
|---------|---------|------|---------|-----------|-----------|
| EC2 | t3.medium (2vCPU/4GB) × 1 | $0.0544/時 | 730h | **$39.71** | ¥5,957 |
| EBS (gp3) | 30GB | $0.096/GB | — | **$2.88** | ¥432 |

#### データベース

| サービス | スペック | 単価 | 月額 (USD) | 月額 (JPY) | 備考 |
|---------|---------|------|-----------|-----------|------|
| RDS MySQL | db.t3.small (2vCPU/2GB) | $0.044/時 | **$32.12** | ¥4,818 | シングルAZ |
| RDS MySQL | db.t3.small **Multi-AZ** | $0.088/時 | **$64.24** | ¥9,636 | 推奨 |
| RDS ストレージ | gp3 20GB | $0.138/GB | **$2.76** | ¥414 | |
| RDS バックアップ | 20GB（自動） | 無料 | **$0** | ¥0 | DB容量まで無料 |

#### キャッシュ

| サービス | スペック | 単価 | 月額 (USD) | 月額 (JPY) | 備考 |
|---------|---------|------|-----------|-----------|------|
| ElastiCache | cache.t3.small (1.5GB) | $0.034/時 | **$24.82** | ¥3,723 | シングルノード |
| ElastiCache | cache.t3.small **+ レプリカ** | — | **$49.64** | ¥7,446 | Multi-AZ推奨 |

#### ネットワーク

| サービス | スペック | 単価 | 月額 (USD) | 月額 (JPY) | 備考 |
|---------|---------|------|-----------|-----------|------|
| ALB | 基本料金 | $0.0243/時 | **$17.74** | ¥2,661 | |
| ALB LCU | 500人接続想定 | ~$0.008/LCU-時 | **$8〜15** | ¥1,200〜2,250 | 通信量で変動 |
| NAT Gateway | 基本料金 | $0.045/時 | **$32.85** | ¥4,928 | |
| NAT Gateway | データ処理 50GB/月 | $0.045/GB | **$2.25** | ¥338 | |
| Route 53 | ホストゾーン | $0.50/ゾーン | **$0.50** | ¥75 | |
| Route 53 | DNSクエリ | $0.40/100万 | **$0.40** | ¥60 | |
| データ転送 | インターネット向け 100GB | $0.114/GB | **$11.40** | ¥1,710 | 最初の1GBは無料 |

#### セキュリティ・監視

| サービス | スペック | 月額 (USD) | 月額 (JPY) | 備考 |
|---------|---------|-----------|-----------|------|
| ACM | SSL証明書 | **$0** | ¥0 | ALB利用時は無料 |
| CloudWatch | メトリクス (基本) | **$0** | ¥0 | EC2基本メトリクス無料 |
| CloudWatch | カスタムメトリクス 10個 | **$3.00** | ¥450 | |
| CloudWatch Logs | 5GB/月 取り込み | **$3.17** | ¥476 | $0.76/GB |
| CloudWatch Logs | 5GB/月 保存 | **$0.175** | ¥26 | $0.035/GB |

---

### 16.2 合計コスト（3パターン）

#### パターンA: 最小構成（コスト優先）

シングルAZ、レプリカなし。開発・テスト・小規模運用向け。

| 項目 | 月額 (USD) |
|------|-----------|
| EC2 t3.medium × 1 | $39.71 |
| EBS 30GB | $2.88 |
| RDS db.t3.small (シングルAZ) | $32.12 |
| RDS ストレージ 20GB | $2.76 |
| ElastiCache cache.t3.small (シングル) | $24.82 |
| ALB | $25.74 |
| NAT Gateway | $35.10 |
| Route 53 | $0.90 |
| データ転送 100GB | $11.40 |
| CloudWatch | $6.35 |
| **合計** | **約 $182/月（¥27,300）** |

#### パターンB: 推奨構成（可用性重視）★おすすめ

Multi-AZ有効、レプリカあり。本番運用向け。

| 項目 | 月額 (USD) |
|------|-----------|
| EC2 t3.medium × 1 | $39.71 |
| EBS 30GB | $2.88 |
| RDS db.t3.small (**Multi-AZ**) | $64.24 |
| RDS ストレージ 20GB | $2.76 |
| ElastiCache cache.t3.small (**+ レプリカ**) | $49.64 |
| ALB | $25.74 |
| NAT Gateway | $35.10 |
| Route 53 | $0.90 |
| データ転送 100GB | $11.40 |
| CloudWatch | $6.35 |
| **合計** | **約 $239/月（¥35,850）** |

#### パターンC: 高可用性構成（1000人対応）

EC2 2台、大きめインスタンス。

| 項目 | 月額 (USD) |
|------|-----------|
| EC2 t3.large × 2 | $122.64 |
| EBS 30GB × 2 | $5.76 |
| RDS db.t3.medium (Multi-AZ) | $128.48 |
| RDS ストレージ 50GB | $6.90 |
| ElastiCache cache.t3.medium (+ レプリカ) | $99.28 |
| ALB | $30.00 |
| NAT Gateway | $40.00 |
| Route 53 | $0.90 |
| データ転送 200GB | $22.80 |
| CloudWatch | $10.00 |
| **合計** | **約 $467/月（¥70,050）** |

---

### 16.3 旧構成との比較

| 項目 | 旧構成（Pusher + DB） | 新構成（Reverb + Redis） | 差額 |
|------|---------------------|------------------------|------|
| Pusher Business | $299/月 (¥44,850) | $0 | **-$299** |
| ElastiCache Redis | $0 | $50/月 | +$50 |
| EC2/RDS/ALB等 | 同等 | 同等 | $0 |
| **インフラ合計** | **$482/月** | **$239/月** | **-$243/月** |
| **年間** | **$5,784** | **$2,868** | **-$2,916/年（¥437,400節約）** |

---

### 16.4 コスト削減のヒント

| 方法 | 削減額 | 説明 |
|------|--------|------|
| **EC2 リザーブドインスタンス（1年）** | 約30〜40%OFF | t3.medium: $39→$25/月 |
| **EC2 リザーブドインスタンス（3年）** | 約50〜60%OFF | t3.medium: $39→$17/月 |
| **RDS リザーブドインスタンス（1年）** | 約30%OFF | Multi-AZ: $64→$45/月 |
| **ElastiCache リザーブドノード（1年）** | 約30%OFF | $50→$35/月 |
| **NAT Gateway → VPCエンドポイント** | $35→$10/月 | S3/CloudWatch等はVPCエンドポイントで無料化 |
| **Savings Plans（1年）** | 約30%OFF | EC2 + Fargate 横断で適用 |

#### リザーブド適用時の最安構成

| 項目 | オンデマンド | RI 1年適用後 |
|------|-----------|-------------|
| EC2 t3.medium | $39.71 | **$25.00** |
| RDS db.t3.small Multi-AZ | $64.24 | **$45.00** |
| ElastiCache cache.t3.small + レプリカ | $49.64 | **$35.00** |
| その他（ALB/NAT/Route53等） | $82.37 | $82.37 |
| **合計** | **$239/月** | **約 $187/月（¥28,050）** |

---

## 17. スケールアップ・スケールアウト戦略

### 17.1 段階的スケーリング

| 同時接続数 | EC2 | RDS | Redis | 月額概算 |
|-----------|-----|-----|-------|---------|
| ~500人 | t3.medium × 1 | db.t3.small | cache.t3.small | $223 |
| ~1,000人 | t3.large × 1 | db.t3.medium | cache.t3.medium | $350 |
| ~2,000人 | t3.large × 2 (ALB) | db.t3.large | cache.m6g.large | $600 |
| ~5,000人 | c6i.xlarge × 3 (ALB) | db.r6g.large | cache.m6g.xlarge | $1,200 |

### 17.2 スケールアウト時の注意点

#### WebSocket (Reverb) のスケーリング

EC2を複数台にする場合、Reverbの**Redis Scaling**を有効にする:

```env
# .env
REVERB_SCALING_ENABLED=true
```

これにより、複数のReverbインスタンスがRedis Pub/Subで同期し、
どのEC2に接続しているユーザーにもブロードキャストが届く。

#### Queue Worker の注意

カウントダウンジョブ（`ProcessAuctionCountdownJob`）は**1つのオークションにつき1つのワーカー**を占有するロングランニングジョブ。
同時開催オークション数以上の `countdown` ワーカーが必要（Supervisor の `numprocs` で設定）。
世代番号（generation）による排他制御があるため、複数EC2で `countdown` ワーカーを実行しても安全。

```
EC2 #1: numprocs=5 で countdown ワーカーを実行 → 最大5オークション同時開催可能
EC2 #2: 必要に応じて追加の countdown ワーカーを実行
```

#### セッション共有

Redis セッションを使用しているため、ALBでどのEC2にルーティングされても
セッションは共有される。追加設定不要。

### 17.3 将来的な改善案

| 改善 | 効果 | 優先度 |
|------|------|--------|
| CloudFront（CDN） | 静的ファイルの高速配信 | 中 |
| S3 画像ストレージ | EC2のディスク負荷軽減 | 中 |
| Auto Scaling Group | 負荷に応じた自動スケール | 低（1000人超で検討） |
| RDS Read Replica | 読み取りクエリの分散 | 低（1000人超で検討） |
| ECS/Fargate移行 | コンテナ化・運用自動化 | 低（チーム拡大時） |

---

## 18. 本番 .env 設定テンプレート

```env
# === アプリケーション ===
APP_NAME=Auction
APP_ENV=production
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
APP_DEBUG=false
APP_URL=https://auction.your-domain.com
FRONTEND_URL=https://auction.your-domain.com

# === ログ ===
LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning

# === データベース (RDS MySQL) ===
DB_CONNECTION=mysql
DB_HOST=auction-db.xxxxx.ap-northeast-1.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=auction
DB_USERNAME=auction_user
DB_PASSWORD=your-secure-db-password

# === Redis (ElastiCache) ===
REDIS_CLIENT=phpredis
REDIS_HOST=auction-redis.xxxxx.0001.apne1.cache.amazonaws.com
REDIS_PASSWORD=your-redis-auth-token
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1
REDIS_SCHEME=tls

# === Cache / Queue / Session ===
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=true

# === Broadcast (Reverb) ===
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=auction-prod
REVERB_APP_KEY=your-reverb-app-key-here
REVERB_APP_SECRET=your-reverb-app-secret-here
REVERB_HOST=auction.your-domain.com
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

# === メール ===
MAIL_MAILER=ses
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="${APP_NAME}"

# === ファイルシステム ===
FILESYSTEM_DISK=local
```

---

## 19. トラブルシューティング

### 19.1 よくある問題と対処法

| 問題 | 原因 | 対処法 |
|------|------|--------|
| 502 Bad Gateway | PHP-FPM停止 | `sudo systemctl restart php-fpm` |
| WebSocket接続できない | Reverb停止 or ALB設定 | `supervisorctl status`, ALBターゲットグループ確認 |
| セッション切れ | Redis接続エラー | `redis-cli -h <host> ping`, sg確認 |
| キューが処理されない | Worker停止 | `supervisorctl restart auction:*` |
| OPcache古いコード | reload忘れ | `sudo systemctl reload php-fpm` |
| ALBヘルスチェック失敗 | /api/health エラー | DB/Redis接続確認 |
| 高レイテンシ | DB N+1 or Redis未使用 | CloudWatch + スロークエリログ確認 |

### 19.2 ログ確認コマンド

```bash
# Laravel ログ
tail -f /var/www/auction/storage/logs/laravel.log

# Nginx エラーログ
tail -f /var/log/nginx/error.log

# PHP-FPM エラーログ
tail -f /var/log/php-fpm/www-error.log

# Queue Worker ログ
tail -f /var/log/auction/queue-countdown.log

# Reverb ログ
tail -f /var/log/auction/reverb.log

# Supervisor 全プロセス状態
sudo supervisorctl status auction:*

# Redis 接続テスト
redis-cli -h <endpoint> -p 6379 -a <password> --tls ping

# MySQL 接続テスト
mysql -h <endpoint> -u auction_user -p auction
```

### 19.3 パフォーマンス確認

```bash
# EC2 リソース確認
top
free -h
df -h

# Nginx 接続数
ss -s

# PHP-FPM プロセス数
ps aux | grep php-fpm | wc -l

# Redis 情報
redis-cli -h <endpoint> -a <password> --tls info stats
redis-cli -h <endpoint> -a <password> --tls info memory
```

---

## 構築チェックリスト

### 事前準備（VPC・ネットワーク）
- [ ] VPC（auction-vpc）作成
- [ ] パブリックサブネット 2つ作成（public-a, public-c）
- [ ] プライベートサブネット 2つ作成（private-a, private-c）
- [ ] インターネットゲートウェイ作成 → VPCにアタッチ
- [ ] パブリックサブネットのルートテーブルに `0.0.0.0/0 → IGW` を追加
- [ ] セキュリティグループ 4つ作成（sg-alb, sg-ec2, sg-rds, sg-redis）

> **NAT Gateway は不要です**（EC2がパブリックサブネットにあるため）

### データベース・キャッシュ（EC2より先に作成）
- [ ] RDS MySQL 作成 + パラメータグループ設定
- [ ] ElastiCache Redis 作成

### EC2（メインサーバー）
- [ ] EC2 インスタンス起動（パブリックサブネット、パブリックIP有効）
- [ ] EC2 Instance Connect でブラウザから接続できることを確認
- [ ] ユーザーデータの実行完了を確認（`nginx -v`, `php -v` 等）
- [ ] アプリケーションコードをデプロイ
- [ ] .env ファイルを本番値に設定
- [ ] `php artisan migrate --force` 実行
- [ ] Nginx + PHP-FPM + Supervisor 設定

### SSL・ロードバランサー
- [ ] ACM 証明書発行
- [ ] ALB 作成 + ターゲットグループ + リスナー設定
- [ ] Route 53 DNS レコード設定

### 動作確認
- [ ] HTTPS でサイトにアクセスできる
- [ ] WebSocket 接続が正常（ブラウザコンソールで確認）
- [ ] ヘルスチェックが合格している
- [ ] CloudWatch Agent + アラート設定
