# AWS インフラ構築 作業指示書

> 作成日: 2026-04-13
> 対象: MEDAKA AUCTION PORT 本番環境
> 前提: 同時接続500人対応（開催スケジュール連動2モード運用）

---

## 目次

1. [作業概要](#1-作業概要)
2. [前提条件・準備物](#2-前提条件準備物)
3. [ドメイン移行計画](#3-ドメイン移行計画)
4. [STEP 1: VPC・ネットワーク構築](#step-1-vpcネットワーク構築)
5. [STEP 2: セキュリティグループ作成](#step-2-セキュリティグループ作成)
6. [STEP 3: RDS (MySQL) 構築](#step-3-rds-mysql-構築)
7. [STEP 4: ElastiCache (Valkey) 構築](#step-4-elasticache-valkey-構築)
8. [STEP 5: S3 バケット作成](#step-5-s3-バケット作成)
9. [STEP 6: EC2 構築・アプリデプロイ](#step-6-ec2-構築アプリデプロイ)
10. [STEP 7: ALB 構築](#step-7-alb-構築)
11. [STEP 8: ドメイン取得・Route 53・ACM 設定](#step-8-ドメイン取得route-53acm-設定)
12. [STEP 9: ALB に SSL 設定・最終ルーティング](#step-9-alb-に-ssl-設定最終ルーティング)
13. [STEP 10: 環境変数・アプリ設定](#step-10-環境変数アプリ設定)
14. [STEP 11: Supervisor・プロセス管理](#step-11-supervisorプロセス管理)
15. [STEP 12: 動作確認チェックリスト](#step-12-動作確認チェックリスト)
16. [STEP 13: 旧ドメインを開発環境に切り替え](#step-13-旧ドメインを開発環境に切り替え)
17. [STEP 14: 監視・アラート設定](#step-14-監視アラート設定)
18. [STEP 15: オークションモード切り替え（手動）](#step-15-オークションモード切り替え手動)
19. [STEP 16: オークションモード切り替え（自動化）](#step-16-オークションモード切り替え自動化)
20. [STEP 17: 管理画面からのスケーリング実行](#step-17-管理画面からのスケーリング実行)
21. [参考: 構成図](#参考-構成図)
22. [月額コスト見積もり](#月額コスト見積もり)

---

## 1. 作業概要

### やること

| # | 作業内容 | 所要時間目安 |
|---|---------|------------|
| 1 | VPC・サブネット・IGW・ルートテーブル構築 | 30分 |
| 2 | セキュリティグループ作成 | 15分 |
| 3 | RDS MySQL 8.0 作成 | 20分（起動待ち15分） |
| 4 | ElastiCache Valkey 8.0 作成 | 15分（起動待ち10分） |
| 5 | S3 バケット作成 | 10分 |
| 6 | EC2 起動・ソフトウェアインストール・デプロイ | 60分 |
| 7 | ALB 構築・ターゲットグループ設定 | 20分 |
| 8 | ドメイン取得・Route 53・ACM 証明書 | 30分（検証待ち最大30分） |
| 9 | ALB に HTTPS リスナー設定 | 10分 |
| 10 | 環境変数設定・マイグレーション | 20分 |
| 11 | Supervisor 設定 | 15分 |
| 12 | 動作確認 | 30分 |
| 13 | 旧ドメインを開発環境に切り替え | 15分 |
| 14 | CloudWatch 監視設定 | 20分 |

**合計: 約5〜6時間**（待ち時間含む）

### ターゲット構成（通常モード / 初期構築時）

| コンポーネント | スペック | 備考 |
|--------------|---------|------|
| EC2 | t3.small (2vCPU / 2GB) | オークション時 → t3.large |
| RDS | db.t3.micro Single-AZ | オークション時 → db.t3.medium Multi-AZ |
| ElastiCache | cache.t3.micro | オークション時 → cache.t3.medium + Replica |
| ALB | 標準 | 常時稼働 |
| S3 | 標準 | 画像・メディアストレージ |

---

## 2. 前提条件・準備物

### 必要なもの

- [ ] AWS アカウント（ルートではなく IAM ユーザー推奨）
- [ ] AWS CLI v2 インストール済み & `aws configure` 設定済み
- [ ] 取得予定の新ドメイン名を決定済み
- [ ] 旧環境の DB ダンプ（本番データ移行が必要な場合）
- [ ] SSH キーペア（EC2 Instance Connect を使う場合は不要）
- [ ] GitHub リポジトリへのアクセス権（デプロイ用）

### AWS リージョン

```
ap-northeast-1 (東京)
```

全リソースを東京リージョンに統一する。

---

## 3. ドメイン移行計画

### 方針

| 項目 | 旧ドメイン | 新ドメイン |
|------|-----------|-----------|
| 用途 | 本番 → **開発環境に切り替え** | **新規本番環境** |
| DNS | Route 53（既存 or 外部） | Route 53（新規ホストゾーン） |
| SSL | ACM 証明書を再発行 | ACM 証明書を新規発行 |

### 手順概要

1. 新ドメインを Route 53 で取得（または外部レジストラで取得後 Route 53 に委譲）
2. 新ドメインで ACM 証明書を発行
3. 新本番環境を新ドメインで公開
4. 動作確認完了後、旧ドメインの DNS レコードを開発環境の IP/ALB に向ける
5. 旧ドメインの ACM 証明書を開発環境用に再設定

---

## STEP 1: VPC・ネットワーク構築

### 1-1. VPC 作成

| 項目 | 値 |
|------|-----|
| 名前 | `auction-vpc` |
| IPv4 CIDR | `10.0.0.0/16` |
| IPv6 | なし |
| テナンシー | デフォルト |

**手順:**
1. VPC コンソール → 「VPC を作成」
2. 「VPC のみ」を選択
3. 上記の値を入力して作成

### 1-2. サブネット作成

| サブネット名 | CIDR | AZ | 用途 |
|-------------|------|-----|------|
| `auction-public-a` | `10.0.1.0/24` | ap-northeast-1a | ALB, EC2 |
| `auction-public-c` | `10.0.2.0/24` | ap-northeast-1c | ALB (Multi-AZ) |
| `auction-private-a` | `10.0.10.0/24` | ap-northeast-1a | RDS Primary, Redis Primary |
| `auction-private-c` | `10.0.20.0/24` | ap-northeast-1c | RDS Standby, Redis Replica |

**手順:**
1. VPC コンソール → サブネット → 「サブネットを作成」
2. VPC に `auction-vpc` を選択
3. 4つのサブネットをそれぞれ作成
4. **Public サブネット** は「パブリック IPv4 アドレスの自動割り当て」を**有効化**

### 1-3. インターネットゲートウェイ (IGW)

| 項目 | 値 |
|------|-----|
| 名前 | `auction-igw` |
| アタッチ先 | `auction-vpc` |

**手順:**
1. VPC コンソール → インターネットゲートウェイ → 「作成」
2. `auction-vpc` にアタッチ

### 1-4. ルートテーブル

**パブリック用ルートテーブル:**

| 名前 | ルート |
|------|-------|
| `auction-rt-public` | `0.0.0.0/0` → `auction-igw` |

**手順:**
1. ルートテーブル作成 → `auction-rt-public`
2. ルート編集 → `0.0.0.0/0` のターゲットに `auction-igw` を追加
3. サブネットの関連付け → `auction-public-a`, `auction-public-c` を関連付け

**プライベート用ルートテーブル:**

| 名前 | ルート |
|------|-------|
| `auction-rt-private` | ローカルルートのみ（デフォルト） |

**手順:**
1. ルートテーブル作成 → `auction-rt-private`
2. サブネットの関連付け → `auction-private-a`, `auction-private-c` を関連付け

> **NAT Gateway は不要**: プライベートサブネットの RDS/Redis は外部通信不要のため。

---

## STEP 2: セキュリティグループ作成

VPC `auction-vpc` 内に以下の4つを作成する。

### 2-1. ALB 用: `auction-sg-alb`

| タイプ | プロトコル | ポート | ソース |
|--------|---------|-------|--------|
| インバウンド | TCP | 443 | `0.0.0.0/0` |
| インバウンド | TCP | 80 | `0.0.0.0/0` |
| アウトバウンド | すべて | すべて | `0.0.0.0/0` |

### 2-2. EC2 用: `auction-sg-ec2`

| タイプ | プロトコル | ポート | ソース | 備考 |
|--------|---------|-------|--------|------|
| インバウンド | TCP | 80 | `auction-sg-alb` | HTTP |
| インバウンド | TCP | 8080 | `auction-sg-alb` | WebSocket (Reverb) |
| インバウンド | TCP | 22 | `3.112.23.0/29` | EC2 Instance Connect (東京) |
| アウトバウンド | すべて | すべて | `0.0.0.0/0` | |

### 2-3. RDS 用: `auction-sg-rds`

| タイプ | プロトコル | ポート | ソース |
|--------|---------|-------|--------|
| インバウンド | TCP | 3306 | `auction-sg-ec2` |
| アウトバウンド | すべて | すべて | `0.0.0.0/0` |

### 2-4. Redis 用: `auction-sg-redis`

| タイプ | プロトコル | ポート | ソース |
|--------|---------|-------|--------|
| インバウンド | TCP | 6379 | `auction-sg-ec2` |
| アウトバウンド | すべて | すべて | `0.0.0.0/0` |

---

## STEP 3: RDS (MySQL) 構築

### 3-1. DB サブネットグループ作成

| 項目 | 値 |
|------|-----|
| 名前 | `auction-db-subnet-group` |
| VPC | `auction-vpc` |
| サブネット | `auction-private-a`, `auction-private-c` |

### 3-2. パラメータグループ作成

2つのパラメータグループを作成する（通常モード用・オークションモード用）。

#### パラメータグループの作成手順（共通）

1. RDS コンソール → 左メニュー「パラメータグループ」→ 「パラメータグループの作成」
2. 以下を入力:

| 入力項目 | 値 |
|---------|-----|
| パラメータグループファミリー | `mysql8.0` |
| タイプ | `DB Parameter Group` |
| パラメータグループ名 | 下記参照 |
| 説明 | 下記参照 |

3. 「作成」ボタンをクリック

#### (A) 通常モード用: `auction-prod-db-params-micro`

**作成画面の入力:**

| 項目 | 値 |
|------|-----|
| パラメータグループ名 | `auction-prod-db-params-micro` |
| 説明 | `PRODUCTION RDS MICRO` |
| エンジンのタイプ | `MySQL Community` |
| パラメータグループファミリー | `mysql8.0` |
| タイプ | `DB Parameter Group` |

**作成後、パラメータを編集:**

1. 作成したパラメータグループ名をクリック
2. 右上の「パラメータの編集」ボタンをクリック
3. 検索ボックスで各パラメータ名を検索し、値を変更:

| パラメータ名 | 値 | 検索キーワード | 備考 |
|-------------|-----|--------------|------|
| `max_connections` | `30` | `max_connections` | db.t3.micro 向け |
| `innodb_buffer_pool_size` | `268435456` | `innodb_buffer_pool` | 256MB（バイト指定） |
| `innodb_log_file_size` | `67108864` | `innodb_log_file` | 64MB（バイト指定） |
| `slow_query_log` | `1` | `slow_query` | スロークエリ記録ON |
| `long_query_time` | `1` | `long_query` | 1秒以上をスロー判定 |
| `character_set_server` | `utf8mb4` | `character_set_server` | 日本語対応 |
| `collation_server` | `utf8mb4_unicode_ci` | `collation_server` | 照合順序 |
| `time_zone` | `Asia/Tokyo` | `time_zone` | 日本時間 |

4. 右上の「変更の保存」をクリック

> **注意**: パラメータの検索は部分一致。`innodb_buffer` と入力すれば `innodb_buffer_pool_size` が見つかる。
> 値の入力欄が空の場合はデフォルト値が使われている。変更したい項目のみ値を入力する。

#### (B) オークションモード用: `auction-prod-db-params-large`

**作成画面の入力:**

| 項目 | 値 |
|------|-----|
| パラメータグループ名 | `auction-prod-db-params-large` |
| 説明 | `PRODUCTION RDS LARGE - AUCTION MODE` |
| エンジンのタイプ | `MySQL Community` |
| パラメータグループファミリー | `mysql8.0` |
| タイプ | `DB Parameter Group` |

**作成後、パラメータを編集（手順は上記と同じ）:**

| パラメータ名 | 値 | 備考 |
|-------------|-----|------|
| `max_connections` | `150` | 500人同時接続対応 |
| `innodb_buffer_pool_size` | `2147483648` | 2GB（バイト指定） |
| `innodb_log_file_size` | `268435456` | 256MB（バイト指定） |
| `slow_query_log` | `1` | スロークエリ記録ON |
| `long_query_time` | `1` | 1秒以上をスロー判定 |
| `character_set_server` | `utf8mb4` | 日本語対応 |
| `collation_server` | `utf8mb4_unicode_ci` | 照合順序 |
| `time_zone` | `Asia/Tokyo` | 日本時間 |

#### パラメータグループ切り替え時の注意

```
⚠️ 重要:
  innodb_buffer_pool_size = 2GB は db.t3.micro (RAM 1GB) では起動不能。
  スケールアップ/ダウン時は必ずインスタンスクラスとパラメータグループをセットで変更すること。

  スケールアップ時:
    db.t3.micro → db.t3.medium に変更
    auction-prod-db-params-micro → auction-prod-db-params-large に変更
    → 再起動が発生する（数分間のダウンタイム）

  スケールダウン時:
    db.t3.medium → db.t3.micro に変更
    auction-prod-db-params-large → auction-prod-db-params-micro に変更
    → 再起動が発生する（数分間のダウンタイム）

  切り替え手順:
    1. RDS コンソール → データベース → auction-db → 「変更」
    2. 「DB インスタンスクラス」を変更
    3. 「DB パラメータグループ」を変更
    4. 「すぐに適用」を選択 → 「DB インスタンスを変更」
    5. ステータスが「利用可能」に戻るまで待つ（5〜10分）
```

### 3-3. RDS インスタンス作成

| 項目 | 値 |
|------|-----|
| エンジン | MySQL 8.0 |
| テンプレート | 本番稼働用 |
| インスタンスクラス | `db.t3.micro`（初期） |
| Multi-AZ | **無効**（初期。オークション時に有効化） |
| DB インスタンス識別子 | `auction-db` |
| マスターユーザー名 | `admin` |
| マスターパスワード | **強力なパスワードを設定**（控えておく） |
| VPC | `auction-vpc` |
| サブネットグループ | `auction-db-subnet-group` |
| パブリックアクセス | **いいえ** |
| セキュリティグループ | `auction-sg-rds` |
| データベース名 | `auction` |
| パラメータグループ | `auction-db-params-micro` |
| ストレージ | gp3 / 20GB / 自動拡張有効（上限100GB） |
| バックアップ保持期間 | 7日 |
| パフォーマンスインサイト | 有効 |
| 暗号化 | 有効 |
| ログのエクスポート | スロークエリログ、エラーログ |

**手順:**
1. RDS コンソール → 「データベースを作成」
2. 上記設定で作成
3. 作成完了後、**エンドポイント**を控える（例: `auction-db.xxxxx.ap-northeast-1.rds.amazonaws.com`）

---

## STEP 4: ElastiCache (Valkey) 構築

> **Valkey について**: AWS ElastiCache は 2024年以降、Redis 7.2 フォークの **Valkey** を推奨エンジンとして提供。
> Redis と完全互換のため、Laravel の `phpredis` クライアント・Reverb・Queue すべてそのまま動作する。

### 4-1. サブネットグループ作成

| 項目 | 値 |
|------|-----|
| 名前 | `auction-redis-subnet-group` |
| VPC | `auction-vpc` |
| サブネット | `auction-private-a`, `auction-private-c` |

### 4-2. Valkey クラスター作成

| 項目 | 値 |
|------|-----|
| クラスターエンジン | **Valkey** |
| 名前 | `auction-redis` |
| ノードタイプ | `cache.t3.micro`（初期） |
| レプリカ数 | 0（初期。オークション時に追加） |
| エンジンバージョン | **8.0**（最新） |
| ポート | 6379 |
| サブネットグループ | `auction-redis-subnet-group` |
| セキュリティグループ | `auction-sg-redis` |
| 保存時の暗号化 | 有効 |
| 転送中の暗号化 | 有効 |
| AUTH トークン | **設定する**（控えておく） |

> **補足**: ElastiCache コンソールで「Redis」を選んでも動作するが、
> Valkey の方がコスト効率が良く（同等性能で最大33%安価）、AWS のサポート・アップデートも Valkey が優先される。
> Laravel 側の `.env` 設定（`REDIS_CLIENT=phpredis`）は変更不要。

**手順:**
1. ElastiCache コンソール → 「キャッシュを作成」
2. 「Valkey キャッシュ」を選択
3. 上記設定で作成
4. 作成完了後、**プライマリエンドポイント**を控える（例: `auction-redis.xxxxx.0001.apne1.cache.amazonaws.com`）

---

## STEP 5: S3 バケット作成

### 5-1. メディア用バケット

| 項目 | 値 |
|------|-----|
| バケット名 | `auction-media-prod`（グローバルユニーク） |
| リージョン | ap-northeast-1 |
| ブロックパブリックアクセス | **すべてブロック** |
| バージョニング | 無効 |
| 暗号化 | SSE-S3 |

### 5-2. IAM ポリシー作成（EC2 → S3 アクセス用）

> **注意**: これは S3 バケットポリシーではなく、**IAM ポリシー**として作成する。
> バケットポリシーには `Principal` が必要だが、IAM ポリシーでは不要。
> S3 バケット側のポリシーは変更しない（ブロックパブリックアクセスのまま）。

**作成手順:**

1. IAM コンソール → 左メニュー「ポリシー」→ 「ポリシーを作成」
2. 「JSON」タブを選択し、以下を貼り付け:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::auction-media-prod",
        "arn:aws:s3:::auction-media-prod/*"
      ]
    }
  ]
}
```

3. ポリシー名: `auction-s3-media-access`
4. 「ポリシーを作成」をクリック
5. このポリシーを STEP 6 の IAM ロール (`auction-ec2-role`) にアタッチする

### 5-3. CloudFront（推奨・オプション）

画像配信の高速化のため、CloudFront を S3 オリジンで設定することを推奨。

| 項目 | 値 |
|------|-----|
| オリジン | `auction-media-prod.s3.ap-northeast-1.amazonaws.com` |
| OAC | 有効（Origin Access Control） |
| キャッシュポリシー | CachingOptimized |
| 代替ドメイン | `cdn.{新ドメイン}` |

---

## STEP 6: EC2 構築・アプリデプロイ

### 6-1. IAM ロール作成

| 項目 | 値 |
|------|-----|
| ロール名 | `auction-ec2-role` |
| 信頼されたエンティティ | EC2 |
| ポリシー | `AmazonSSMManagedInstanceCore`（Session Manager用）|
| ポリシー | `auction-s3-media-access`（STEP 5-2 で作成済み）|
| ポリシー | `CloudWatchAgentServerPolicy`（監視用） |

### 6-2. EC2 インスタンス作成

| 項目 | 値 |
|------|-----|
| AMI | Amazon Linux 2023 (AL2023) |
| インスタンスタイプ | `t3.small`（初期） |
| VPC | `auction-vpc` |
| サブネット | `auction-public-a` |
| パブリック IP の自動割り当て | 有効 |
| セキュリティグループ | `auction-sg-ec2` |
| IAM ロール | `auction-ec2-role` |
| ストレージ | gp3 / 30GB / 3000 IOPS |
| キーペア | EC2 Instance Connect 使用なら不要 |
| タグ | `Name: auction-app-01` |

### 6-3. EC2 への接続

#### 接続方法: EC2 Instance Connect

1. EC2 コンソール → インスタンス → `auction-app-01` を選択
2. 「接続」ボタンをクリック
3. 「EC2 Instance Connect」タブを選択
4. ユーザー名: `ec2-user`
5. 「接続」をクリック

#### 「Failed to connect to your instance」エラーが出る場合

以下を順番に確認する:

**1. パブリック IP が割り当てられているか**
- EC2 コンソール → インスタンス詳細 → 「パブリック IPv4 アドレス」が表示されているか
- 空の場合 → サブネットの「パブリック IPv4 アドレスの自動割り当て」が無効になっている
- 修正: サブネット `auction-public-a` を選択 → 「アクション」→「サブネットの設定を編集」→「パブリック IPv4 アドレスの自動割り当てを有効化」にチェック → 保存
- その後、インスタンスを停止 → 起動し直す（再起動ではなく停止→起動）

**2. セキュリティグループで SSH が許可されているか**
- `auction-sg-ec2` のインバウンドルールに以下があるか確認:

| ポート | ソース | 備考 |
|-------|--------|------|
| 22 | `3.112.23.0/29` | EC2 Instance Connect (ap-northeast-1) |

- **EC2 Instance Connect Endpoint を使う場合**（VPC 内接続）は上記 IP 制限は不要で、代わりにセキュリティグループ自身からの 22 を許可

**3. インターネットゲートウェイがアタッチされているか**
- VPC コンソール → インターネットゲートウェイ → `auction-igw` が `auction-vpc` に「Attached」になっているか
- ルートテーブル `auction-rt-public` に `0.0.0.0/0 → auction-igw` のルートがあるか
- サブネット `auction-public-a` がこのルートテーブルに関連付けられているか

**4. インスタンスの起動が完了しているか**
- ステータスチェック: 「2/2 のチェックに合格」になるまで待つ（起動後 2〜3 分）

**5. 代替手段: Session Manager で接続**
- IAM ロール `auction-ec2-role` に `AmazonSSMManagedInstanceCore` がアタッチされていれば使用可能
- EC2 コンソール → 「接続」→「Session Manager」タブ → 「接続」
- セキュリティグループの SSH ルール不要で接続できるため、**こちらを推奨**

```
⚠️ Session Manager を推奨する理由:
  - SSH ポート (22) を開ける必要がない → セキュリティ向上
  - パブリック IP がなくても接続可能（NAT Gateway or VPC Endpoint 経由）
  - IAM で接続制御できる
  - 接続ログが CloudTrail に記録される
```

**6. それでも接続できない場合: EC2 Instance Connect Endpoint を作成**

EC2 Instance Connect Endpoint (EIC Endpoint) を使うと、パブリック IP やインターネットゲートウェイなしで接続可能:

1. VPC コンソール → 「エンドポイント」→「エンドポイントを作成」
2. サービスカテゴリ: `EC2 Instance Connect Endpoint`
3. VPC: `auction-vpc`
4. セキュリティグループ: `auction-sg-ec2`
5. サブネット: `auction-public-a`
6. 作成後、EC2 コンソール → 「接続」→「EC2 Instance Connect」→ エンドポントを選択して接続

### 6-4. ソフトウェアインストール

EC2 に接続後、以下を実行:

```bash
# ---- システム更新 ----
sudo dnf update -y

# ---- Git ----
sudo dnf install -y git

# ---- Nginx ----
sudo dnf install -y nginx

# ---- PHP 8.2 (Amazon Linux 2023 用パッケージ名) ----
# ※ AL2023 では redis 拡張は php8.2-pecl-redis6
# ※ curl 拡張は php8.2-common に含まれる
sudo dnf install -y php8.2 php8.2-fpm php8.2-mysqlnd \
  php8.2-mbstring php8.2-xml php8.2-zip php8.2-gd \
  php8.2-intl php8.2-bcmath php8.2-opcache \
  php8.2-pecl-redis6 php8.2-common php8.2-pdo php8.2-sodium

# ---- Composer ----
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# ---- Node.js 20.x (ビルド用) ----
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# ---- Supervisor (AL2023 では dnf にないため pip でインストール) ----
sudo dnf install -y python3-pip
sudo pip3 install supervisor
sudo mkdir -p /etc/supervisord.d /var/log/supervisor /var/run/supervisor

# Supervisor メイン設定ファイル
sudo tee /etc/supervisord.conf > /dev/null << 'CONF'
[unix_http_server]
file=/var/run/supervisor/supervisor.sock

[supervisord]
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisor/supervisord.pid

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///var/run/supervisor/supervisor.sock

[include]
files = /etc/supervisord.d/*.ini
CONF

# systemd サービスとして登録
sudo tee /etc/systemd/system/supervisord.service > /dev/null << 'SERVICE'
[Unit]
Description=Supervisor process control system
After=network.target

[Service]
ExecStart=/usr/local/bin/supervisord -n -c /etc/supervisord.conf
ExecStop=/usr/local/bin/supervisorctl shutdown
ExecReload=/usr/local/bin/supervisorctl reread && /usr/local/bin/supervisorctl update
Restart=on-failure
RuntimeDirectory=supervisor

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable supervisord
sudo systemctl start supervisord
```

**インストール確認:**

```bash
php -v              # PHP 8.2.x
composer --version   # Composer 2.x
node -v              # v20.x
nginx -v             # nginx/1.28.x
supervisorctl version # 4.x
git --version        # git 2.x
```

### 6-5. PHP-FPM 設定

ファイル: `/etc/php-fpm.d/www.conf`

```ini
; 通常モード（t3.small）
[www]
user = nginx
group = nginx
listen = /run/php-fpm/www.sock
listen.owner = nginx
listen.group = nginx

pm = dynamic
pm.max_children = 30
pm.start_servers = 5
pm.min_spare_servers = 3
pm.max_spare_servers = 10
pm.max_requests = 500

; OPcache (php.ini で設定)
; opcache.enable=1
; opcache.memory_consumption=128
; opcache.max_accelerated_files=10000
; opcache.jit=1255
; opcache.jit_buffer_size=64M
```

### 6-6. Nginx 設定

ファイル: `/etc/nginx/conf.d/auction.conf`

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/auction/public;
    index index.php;

    client_max_body_size 100M;

    # 静的ファイル
    location /build/ {
        alias /var/www/auction/public/build/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /img/ {
        alias /var/www/auction/public/img/;
        expires 30d;
        access_log off;
    }

    # PHP (Laravel)
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php-fpm/www.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 300;
    }

    # ヘルスチェック
    location /api/health {
        access_log off;
        try_files $uri /index.php?$query_string;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}

# WebSocket 用（ALB からの転送先）
server {
    listen 8080;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

### 6-7. アプリケーションデプロイ

```bash
# ---- アプリディレクトリ作成 ----
sudo mkdir -p /var/www/auction
sudo chown -R ec2-user:nginx /var/www/auction

# ---- リポジトリクローン ----
cd /var/www/auction
git clone <リポジトリURL> .

# ---- バックエンド ----
composer install --no-dev --optimize-autoloader
cp .env.example .env
# → .env を編集（STEP 10 参照）

php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link

# ---- フロントエンド ----
npm ci
npm run build

# ---- パーミッション ----
sudo chown -R ec2-user:nginx /var/www/auction
sudo chmod -R 775 /var/www/auction/storage
sudo chmod -R 775 /var/www/auction/bootstrap/cache

# ---- サービス起動 ----
sudo systemctl enable nginx php-fpm
sudo systemctl start nginx php-fpm
```

---

## STEP 7: ALB 構築

### 7-1. ターゲットグループ作成

**HTTP 用:**

| 項目 | 値 |
|------|-----|
| 名前 | `auction-tg-http` |
| ターゲットタイプ | インスタンス |
| プロトコル/ポート | HTTP / 80 |
| VPC | `auction-vpc` |
| ヘルスチェックパス | `/api/health` |
| ヘルスチェック間隔 | 30秒 |
| 正常しきい値 | 3回 |
| 異常しきい値 | 2回 |

→ ターゲットに EC2 (`auction-app-01`) を登録

**WebSocket 用:**

| 項目 | 値 |
|------|-----|
| 名前 | `auction-tg-ws` |
| ターゲットタイプ | インスタンス |
| プロトコル/ポート | HTTP / 8080 |
| VPC | `auction-vpc` |
| ヘルスチェックパス | `/` |
| スティッキーセッション | **有効**（アプリケーション Cookie） |

→ ターゲットに EC2 (`auction-app-01`) を登録

### 7-2. ALB 作成

| 項目 | 値 |
|------|-----|
| 名前 | `auction-alb` |
| スキーム | インターネット向け |
| VPC | `auction-vpc` |
| サブネット | `auction-public-a`, `auction-public-c` |
| セキュリティグループ | `auction-sg-alb` |
| アイドルタイムアウト | **3600秒**（WebSocket 用に延長） |

**リスナー（暫定 - SSL 証明書取得前）:**

| プロトコル | ポート | デフォルトアクション |
|-----------|-------|-------------------|
| HTTP | 80 | `auction-tg-http` に転送 |

> HTTPS リスナーは ACM 証明書取得後に追加（STEP 9）

---

## STEP 8: ドメイン取得・Route 53・ACM 設定

### 8-1. 新ドメイン取得

**Route 53 で取得する場合:**
1. Route 53 コンソール → 「ドメインの登録」
2. 希望のドメイン名を検索・購入
3. 自動でホストゾーンが作成される

**外部レジストラで取得済みの場合:**
1. Route 53 → ホストゾーン → 「ホストゾーンの作成」
2. ドメイン名を入力 → タイプ「パブリック」
3. 表示された NS レコード（4つ）をレジストラのネームサーバーに設定

### 8-2. ACM 証明書の発行

| 項目 | 値 |
|------|-----|
| ドメイン名 | `{新ドメイン}` |
| 追加ドメイン | `*.{新ドメイン}`（ワイルドカード） |
| 検証方法 | **DNS 検証** |
| リージョン | **ap-northeast-1**（ALB 用） |

**手順:**
1. ACM コンソール → 「証明書をリクエスト」
2. パブリック証明書を選択
3. ドメイン名とワイルドカードを入力
4. DNS 検証を選択
5. 「Route 53 でレコードを作成」ボタンで CNAME レコードを自動追加
6. ステータスが「発行済み」になるまで待つ（通常5〜30分）

### 8-3. Route 53 レコード設定

| レコード名 | タイプ | ルーティング先 |
|-----------|-------|--------------|
| `{新ドメイン}` | A (エイリアス) | ALB (`auction-alb`) |
| `www.{新ドメイン}` | A (エイリアス) | ALB (`auction-alb`) |

---

## STEP 9: ALB に SSL 設定・最終ルーティング

ACM 証明書が「発行済み」になったら:

### 9-1. HTTPS リスナー追加

| プロトコル | ポート | SSL 証明書 | デフォルトアクション |
|-----------|-------|-----------|-------------------|
| HTTPS | 443 | ACM 証明書を選択 | `auction-tg-http` に転送 |

### 9-2. ルーティングルール追加（HTTPS リスナー）

| 優先度 | 条件 | アクション |
|--------|------|----------|
| 1 | パスパターン: `/app/*` | `auction-tg-ws` に転送 |
| デフォルト | その他すべて | `auction-tg-http` に転送 |

### 9-3. HTTP → HTTPS リダイレクト

HTTP:80 リスナーのデフォルトアクションを変更:

| アクション | ステータス |
|----------|----------|
| HTTPS:443 にリダイレクト | 301 |

---

## STEP 10: 環境変数・アプリ設定

EC2 上の `/var/www/auction/.env` を以下のように設定:

```env
APP_NAME="MEDAKA AUCTION PORT"
APP_ENV=production
APP_KEY=  # php artisan key:generate で生成済み
APP_DEBUG=false
APP_URL=https://{新ドメイン}
FRONTEND_URL=https://{新ドメイン}

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=error

# ---- Database ----
DB_CONNECTION=mysql
DB_HOST={RDS エンドポイント}
DB_PORT=3306
DB_DATABASE=auction
DB_USERNAME=admin
DB_PASSWORD={RDS マスターパスワード}

# ---- Redis (ElastiCache) ----
REDIS_CLIENT=phpredis
REDIS_SCHEME=tls  # ElastiCache「転送中の暗号化=有効」の場合は必須。平文なら tcp
REDIS_HOST={ElastiCache プライマリエンドポイント}
REDIS_PASSWORD={ElastiCache AUTH トークン}  # AUTH 未設定なら空のまま（=null は NG、文字列"null"として扱われる）
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1

# ⚠️ TLS 有効な ElastiCache を使う場合、config/database.php の
#   redis.default / redis.cache 両方に下記行を追加する必要がある:
#     'scheme' => env('REDIS_SCHEME', 'tcp'),
#   追加しないと REDIS_SCHEME=tls が無視され、TCP 接続は通るが
#   TLS ハンドシェイクされず、SELECT コマンド時点で
#   「RedisException: read error on connection to ...」が発生する。

# ---- Session ----
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_DOMAIN=.{新ドメイン}
SESSION_SECURE_COOKIE=true

# ---- Cache / Queue ----
CACHE_STORE=redis
QUEUE_CONNECTION=redis
BROADCAST_CONNECTION=reverb

# ---- Reverb (WebSocket) ----
REVERB_APP_ID=auction-prod
REVERB_APP_KEY={ランダムな英数字32文字}
REVERB_APP_SECRET={ランダムな英数字32文字}
REVERB_HOST=0.0.0.0
REVERB_PORT=6001
REVERB_SCHEME=https

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST={新ドメイン}
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https

# ---- AWS S3 ----
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=  # IAMロール使用時は空でOK
AWS_SECRET_ACCESS_KEY=  # IAMロール使用時は空でOK
AWS_DEFAULT_REGION=ap-northeast-1
AWS_BUCKET=auction-media-prod
AWS_USE_PATH_STYLE_ENDPOINT=false

# ---- Mail (SES 推奨) ----
MAIL_MAILER=ses
MAIL_FROM_ADDRESS=noreply@{新ドメイン}
MAIL_FROM_NAME="${APP_NAME}"

# ---- OpenAI ----
OPENAI_API_KEY={APIキー}
OPENAI_MODEL=gpt-4o-mini
```

### 設定反映

```bash
cd /var/www/auction

# フロントエンドの再ビルド（VITE_ 変数変更時）
npm run build

# キャッシュクリア・再生成
php artisan config:cache
php artisan route:cache
php artisan view:cache

# マイグレーション
php artisan migrate --force
```

---

## STEP 11: Supervisor・プロセス管理

### 11-1. Supervisor 設定ファイル作成

ファイル: `/etc/supervisord.d/auction.ini`

```ini
; ---- Queue Worker: countdown ----
[program:auction-queue-countdown]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/auction/artisan queue:work redis --queue=countdown --sleep=1 --tries=3 --timeout=7200 --memory=256
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=ec2-user
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/supervisor/queue-countdown.log
stopwaitsecs=7200

; ---- Queue Worker: default ----
[program:auction-queue-default]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/auction/artisan queue:work redis --queue=default --sleep=3 --tries=3 --timeout=300 --memory=128
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=ec2-user
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/supervisor/queue-default.log

; ---- Laravel Reverb (WebSocket) ----
[program:auction-reverb]
command=php /var/www/auction/artisan reverb:start --host=0.0.0.0 --port=6001
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=ec2-user
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/supervisor/reverb.log
```

> **注意**: 通常モード（t3.small）では countdown×1, default×1 で運用。
> オークションモード（t3.large）にスケールアップ時は `numprocs` を countdown×5, default×2 に変更。

### 11-2. Supervisor 反映

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

全プロセスが `RUNNING` であることを確認。

---

## STEP 12: 動作確認チェックリスト

### 基本確認

- [ ] `https://{新ドメイン}` にアクセスしてトップページが表示される
- [ ] SSL 証明書が有効（ブラウザの鍵マーク）
- [ ] `http://{新ドメイン}` が `https://` にリダイレクトされる

### API 確認

- [ ] `https://{新ドメイン}/api/health` が 200 を返す
- [ ] ユーザー登録ができる
- [ ] ログインができる
- [ ] ログイン後のページが正常表示される

### WebSocket 確認

- [ ] ブラウザの開発者ツール → Network → WS で WebSocket 接続が確立されている
- [ ] オークション画面でリアルタイム更新が動作する
- [ ] カウントダウンが正常に動作する

### 機能確認

- [ ] 画像アップロードが S3 に保存される
- [ ] メール送信が動作する（SES 設定済みの場合）
- [ ] 入札処理が正常に動作する
- [ ] 管理者画面にアクセスできる
- [ ] デモモードが動作する

### インフラ確認

- [ ] `sudo supervisorctl status` で全プロセスが RUNNING
- [ ] RDS への接続: `php artisan tinker` → `DB::connection()->getPdo()`
- [ ] Redis への接続: `php artisan tinker` → `Cache::put('test', 'ok', 60)` → `Cache::get('test')`
- [ ] ALB ヘルスチェックが Healthy

---

## STEP 13: 旧ドメインを開発環境に切り替え

### 13-1. 旧環境の DNS 変更

旧ドメインの Route 53 ホストゾーン（または外部 DNS）で:

| レコード | 変更前 | 変更後 |
|---------|--------|--------|
| `{旧ドメイン}` A レコード | 旧本番 ALB | **開発環境の IP/ALB** |
| `www.{旧ドメイン}` | 旧本番 ALB | **開発環境の IP/ALB** |

### 13-2. 旧環境のアプリ設定変更

```env
APP_ENV=development
APP_DEBUG=true
APP_URL=https://{旧ドメイン}
```

### 13-3. 旧本番環境の扱い

- 新本番が安定稼働（1〜2週間）するまで旧環境は停止せず保持
- 安定確認後、旧本番の EC2/RDS を停止してコスト削減
- 旧本番のデータバックアップを S3 に保存

---

## STEP 14: 監視・アラート設定

### CloudWatch アラーム

| メトリクス | 対象 | 閾値 | アクション |
|-----------|------|------|----------|
| CPUUtilization | EC2 | > 80% (5分) | SNS 通知 |
| FreeableMemory | RDS | < 200MB (5分) | SNS 通知 |
| DatabaseConnections | RDS | > 120 (5分) | SNS 通知 |
| EngineCPUUtilization | ElastiCache | > 80% (5分) | SNS 通知 |
| CurrConnections | ElastiCache | > 400 (5分) | SNS 通知 |
| HealthyHostCount | ALB TG | < 1 (1分) | SNS 通知 |
| HTTPCode_Target_5XX_Count | ALB | > 10 (5分) | SNS 通知 |

### SNS トピック作成

| 項目 | 値 |
|------|-----|
| トピック名 | `auction-alerts` |
| プロトコル | Email |
| エンドポイント | 通知先メールアドレス |

### ログ設定

```bash
# CloudWatch Logs Agent（EC2 にインストール済みの場合）
# 以下のログを CloudWatch Logs に送信:
# - /var/log/nginx/access.log
# - /var/log/nginx/error.log
# - /var/www/auction/storage/logs/laravel.log
# - /var/log/supervisor/*.log
```

---

## STEP 15: オークションモード切り替え（手動）

オークション開催の **2日前** にスケールアップ、**2日後** にスケールダウンを行う。

### 15-1. スケールアップ手順（通常 → オークションモード）

所要時間: 約20〜30分（ダウンタイム: 5〜10分）

#### 手順1: EC2 インスタンスタイプ変更

```
⚠️ EC2 の停止が必要（ダウンタイム発生）
  スケールアップ作業は深夜〜早朝の実施を推奨
```

1. EC2 コンソール → `auction-app-01` を選択
2. 「インスタンスの状態」→「インスタンスを停止」
3. 停止確認後 →「アクション」→「インスタンスの設定」→「インスタンスタイプを変更」
4. `t3.small` → **`t3.large`** に変更 → 「適用」
5. 「インスタンスの状態」→「インスタンスを開始」
6. ステータスチェックが 2/2 合格になるまで待つ

#### 手順2: PHP-FPM 設定変更

EC2 に接続して実行:

```bash
# PHP-FPM の max_children を変更
sudo sed -i 's/pm.max_children = 30/pm.max_children = 80/' /etc/php-fpm.d/www.conf
sudo sed -i 's/pm.start_servers = 5/pm.start_servers = 20/' /etc/php-fpm.d/www.conf
sudo sed -i 's/pm.min_spare_servers = 3/pm.min_spare_servers = 10/' /etc/php-fpm.d/www.conf
sudo sed -i 's/pm.max_spare_servers = 10/pm.max_spare_servers = 40/' /etc/php-fpm.d/www.conf

# 反映
sudo systemctl restart php8.2-fpm
```

#### 手順3: Supervisor ワーカー数変更

```bash
# countdown ワーカーを 1 → 5 に変更
sudo sed -i 's/numprocs=1/numprocs=5/' /etc/supervisord.d/auction.ini

# ※ default ワーカーも変更する場合は個別に編集
sudo vi /etc/supervisord.d/auction.ini
# auction-queue-default の numprocs を 1 → 2 に変更
# auction-queue-countdown の numprocs を 1 → 5 に変更（上の sed で変更済み）

# 反映
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

> **注意**: `sed` で一括変更すると countdown と default 両方の `numprocs` が変わる。
> default は 2、countdown は 5 にしたい場合は `vi` で個別編集する。

#### 手順4: RDS スケールアップ

1. RDS コンソール → `auction-db` → 「変更」
2. 以下を変更:

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| DB インスタンスクラス | db.t3.micro | **db.t3.medium** |
| DB パラメータグループ | auction-prod-db-params-micro | **auction-prod-db-params-large** |
| Multi-AZ 配置 | いいえ | **はい** |

3. 「すぐに適用」を選択 → 「DB インスタンスを変更」
4. ステータスが「利用可能」に戻るまで待つ（**10〜20分**、Multi-AZ 有効化で時間がかかる）

```
⚠️ RDS の変更中はデータベース接続が一時的に切断される
  Multi-AZ 有効化は特に時間がかかる（初回は15〜20分）
```

#### 手順5: ElastiCache スケールアップ

1. ElastiCache コンソール → `auction-redis` → 「変更」
2. ノードタイプ: `cache.t3.micro` → **`cache.t3.medium`**
3. 「すぐに適用」→ 保存
4. 完了後、レプリカを追加:
   - 「レプリカを追加」→ AZ: `ap-northeast-1c` → 作成

```
⚠️ ElastiCache のノードタイプ変更中は一時的に接続が切れる
  レプリカ追加は無停止で可能
```

#### 手順6: 動作確認

```bash
# EC2 で確認
sudo supervisorctl status          # 全プロセスが RUNNING
php artisan tinker                 # DB/Redis 接続確認
# > DB::connection()->getPdo()
# > Cache::put('test','ok',60); Cache::get('test')
```

- [ ] `https://{ドメイン}` にアクセスして正常表示
- [ ] ALB ヘルスチェックが Healthy
- [ ] WebSocket 接続が確立される

### 15-2. スケールダウン手順（オークション → 通常モード）

オークション終了 **2日後** に実施。手順はスケールアップの逆。

#### 手順1: ElastiCache スケールダウン

1. レプリカを削除（レプリカノードを選択 →「削除」）
2. ノードタイプ: `cache.t3.medium` → **`cache.t3.micro`**

#### 手順2: RDS スケールダウン

1. RDS コンソール → `auction-db` → 「変更」

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| DB インスタンスクラス | db.t3.medium | **db.t3.micro** |
| DB パラメータグループ | auction-prod-db-params-large | **auction-prod-db-params-micro** |
| Multi-AZ 配置 | はい | **いいえ** |

2. 「すぐに適用」→ 「DB インスタンスを変更」

#### 手順3: Supervisor・PHP-FPM を戻す

```bash
# PHP-FPM を通常モードに戻す
sudo sed -i 's/pm.max_children = 80/pm.max_children = 30/' /etc/php-fpm.d/www.conf
sudo sed -i 's/pm.start_servers = 20/pm.start_servers = 5/' /etc/php-fpm.d/www.conf
sudo sed -i 's/pm.min_spare_servers = 10/pm.min_spare_servers = 3/' /etc/php-fpm.d/www.conf
sudo sed -i 's/pm.max_spare_servers = 40/pm.max_spare_servers = 10/' /etc/php-fpm.d/www.conf
sudo systemctl restart php8.2-fpm

# Supervisor ワーカー数を戻す（vi で個別編集推奨）
sudo vi /etc/supervisord.d/auction.ini
# countdown: numprocs=5 → numprocs=1
# default:   numprocs=2 → numprocs=1
sudo supervisorctl reread
sudo supervisorctl update
```

#### 手順4: EC2 インスタンスタイプ変更

1. EC2 → `auction-app-01` →「インスタンスを停止」
2. インスタンスタイプ: `t3.large` → **`t3.small`**
3. 「インスタンスを開始」

#### 手順5: 動作確認（スケールアップ時と同じ）

### 15-3. スケーリングチェックリスト

オークション前後に使用:

**スケールアップ（開催2日前）:**

- [ ] EC2: t3.small → t3.large
- [ ] PHP-FPM: max_children 30 → 80
- [ ] Supervisor: countdown×5, default×2
- [ ] RDS: db.t3.micro → db.t3.medium + Multi-AZ + パラメータグループ変更
- [ ] ElastiCache: cache.t3.micro → cache.t3.medium + レプリカ追加
- [ ] 動作確認完了

**スケールダウン（開催2日後）:**

- [ ] ElastiCache: レプリカ削除 + cache.t3.medium → cache.t3.micro
- [ ] RDS: db.t3.medium → db.t3.micro + Multi-AZ 無効 + パラメータグループ変更
- [ ] Supervisor: countdown×1, default×1
- [ ] PHP-FPM: max_children 80 → 30
- [ ] EC2: t3.large → t3.small
- [ ] 動作確認完了

---

## STEP 16: オークションモード切り替え（自動化）

手動切り替えの忘れリスクをゼロにするため、**EventBridge + Lambda** で自動化する。
オークション作成時に自動でスケジュールが登録され、開催2日前にスケールアップ、2日後にスケールダウンが実行される。

### 16-1. アーキテクチャ

```
[管理者] → オークション作成（Laravel）
              │
              ▼
    AuctionObserver（created イベント）
              │
              ▼
    EventBridge Scheduler に2つのスケジュール登録:
      ├── 開催2日前 AM3:00 → Lambda (scale-up)
      └── 開催2日後 AM3:00 → Lambda (scale-down)
              │
              ▼
    Lambda が AWS API で各リソースを変更
      ├── EC2: インスタンスタイプ変更
      ├── RDS: インスタンスクラス + パラメータグループ変更
      ├── ElastiCache: ノードタイプ変更
      └── SSM Run Command: PHP-FPM / Supervisor 設定変更
```

### 16-2. IAM ロール作成（Lambda 用）

| 項目 | 値 |
|------|-----|
| ロール名 | `auction-scaling-lambda-role` |
| 信頼されたエンティティ | Lambda |

**インラインポリシー: `auction-scaling-policy`**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2Scaling",
      "Effect": "Allow",
      "Action": [
        "ec2:StopInstances",
        "ec2:StartInstances",
        "ec2:ModifyInstanceAttribute",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:ResourceTag/Name": "auction-app-01"
        }
      }
    },
    {
      "Sid": "RDSScaling",
      "Effect": "Allow",
      "Action": [
        "rds:ModifyDBInstance",
        "rds:DescribeDBInstances"
      ],
      "Resource": "arn:aws:rds:ap-northeast-1:*:db:auction-db"
    },
    {
      "Sid": "ElastiCacheScaling",
      "Effect": "Allow",
      "Action": [
        "elasticache:ModifyReplicationGroup",
        "elasticache:DescribeReplicationGroups",
        "elasticache:IncreaseReplicaCount",
        "elasticache:DecreaseReplicaCount"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSMRunCommand",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SNSNotify",
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:ap-northeast-1:*:auction-alerts"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### 16-3. Lambda 関数作成（スケールアップ）

| 項目 | 値 |
|------|-----|
| 関数名 | `auction-scale-up` |
| ランタイム | Python 3.12 |
| IAM ロール | `auction-scaling-lambda-role` |
| タイムアウト | 900秒（15分） |
| メモリ | 256MB |

**コード:**

```python
import boto3
import time
import json

ec2 = boto3.client('ec2', region_name='ap-northeast-1')
rds = boto3.client('rds', region_name='ap-northeast-1')
elasticache = boto3.client('elasticache', region_name='ap-northeast-1')
ssm = boto3.client('ssm', region_name='ap-northeast-1')
sns = boto3.client('sns', region_name='ap-northeast-1')

# ---- 設定 ----
EC2_INSTANCE_ID = 'i-xxxxxxxxxxxxxxxxx'  # auction-app-01 のインスタンス ID
RDS_INSTANCE_ID = 'auction-db'
ELASTICACHE_REPL_GROUP = 'auction-redis'
SNS_TOPIC_ARN = 'arn:aws:sns:ap-northeast-1:xxxxxxxxxxxx:auction-alerts'

def notify(subject, message):
    """SNS で通知"""
    try:
        sns.publish(TopicArn=SNS_TOPIC_ARN, Subject=subject, Message=message)
    except Exception as e:
        print(f"SNS notification failed: {e}")

def wait_ec2_stopped(instance_id, timeout=300):
    """EC2 が stopped になるまで待機"""
    waiter = ec2.get_waiter('instance_stopped')
    waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': timeout // 15})

def wait_ec2_running(instance_id, timeout=300):
    """EC2 が running になるまで待機"""
    waiter = ec2.get_waiter('instance_status_ok')
    waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': timeout // 15})

def scale_up_ec2():
    """EC2: t3.small → t3.large"""
    print("EC2: Stopping instance...")
    ec2.stop_instances(InstanceIds=[EC2_INSTANCE_ID])
    wait_ec2_stopped(EC2_INSTANCE_ID)

    print("EC2: Changing instance type to t3.large...")
    ec2.modify_instance_attribute(
        InstanceId=EC2_INSTANCE_ID,
        InstanceType={'Value': 't3.large'}
    )

    print("EC2: Starting instance...")
    ec2.start_instances(InstanceIds=[EC2_INSTANCE_ID])
    wait_ec2_running(EC2_INSTANCE_ID)
    print("EC2: Scale-up complete")

def scale_up_rds():
    """RDS: db.t3.micro → db.t3.medium + Multi-AZ + パラメータグループ変更"""
    print("RDS: Scaling up...")
    rds.modify_db_instance(
        DBInstanceIdentifier=RDS_INSTANCE_ID,
        DBInstanceClass='db.t3.medium',
        DBParameterGroupName='auction-prod-db-params-large',
        MultiAZ=True,
        ApplyImmediately=True
    )
    # RDS の変更完了を待機
    waiter = rds.get_waiter('db_instance_available')
    waiter.wait(
        DBInstanceIdentifier=RDS_INSTANCE_ID,
        WaiterConfig={'Delay': 30, 'MaxAttempts': 40}  # 最大20分
    )
    print("RDS: Scale-up complete")

def scale_up_elasticache():
    """ElastiCache: cache.t3.micro → cache.t3.medium"""
    print("ElastiCache: Scaling up...")
    elasticache.modify_replication_group(
        ReplicationGroupId=ELASTICACHE_REPL_GROUP,
        CacheNodeType='cache.t3.medium',
        ApplyImmediately=True
    )
    # 完了待機（ポーリング）
    for _ in range(40):
        resp = elasticache.describe_replication_groups(
            ReplicationGroupId=ELASTICACHE_REPL_GROUP
        )
        status = resp['ReplicationGroups'][0]['Status']
        if status == 'available':
            break
        time.sleep(30)
    print("ElastiCache: Scale-up complete")

def update_app_config():
    """SSM Run Command で PHP-FPM / Supervisor 設定を変更"""
    print("App: Updating PHP-FPM and Supervisor config...")
    commands = [
        # PHP-FPM
        "sed -i 's/pm.max_children = 30/pm.max_children = 80/' /etc/php-fpm.d/www.conf",
        "sed -i 's/pm.start_servers = 5/pm.start_servers = 20/' /etc/php-fpm.d/www.conf",
        "sed -i 's/pm.min_spare_servers = 3/pm.min_spare_servers = 10/' /etc/php-fpm.d/www.conf",
        "sed -i 's/pm.max_spare_servers = 10/pm.max_spare_servers = 40/' /etc/php-fpm.d/www.conf",
        "systemctl restart php8.2-fpm",
        # Supervisor - countdown を 5 に変更
        "sed -i '/auction-queue-countdown/,/numprocs/{s/numprocs=1/numprocs=5/}' /etc/supervisord.d/auction.ini",
        # Supervisor - default を 2 に変更
        "sed -i '/auction-queue-default/,/numprocs/{s/numprocs=1/numprocs=2/}' /etc/supervisord.d/auction.ini",
        "supervisorctl reread",
        "supervisorctl update",
    ]

    response = ssm.send_command(
        InstanceIds=[EC2_INSTANCE_ID],
        DocumentName='AWS-RunShellScript',
        Parameters={'commands': commands},
        TimeoutSeconds=120
    )

    command_id = response['Command']['CommandId']

    # コマンド完了待機
    for _ in range(12):
        time.sleep(10)
        result = ssm.get_command_invocation(
            CommandId=command_id,
            InstanceId=EC2_INSTANCE_ID
        )
        if result['Status'] in ['Success', 'Failed', 'Cancelled']:
            break

    if result['Status'] == 'Success':
        print("App: Config update complete")
    else:
        print(f"App: Config update FAILED - {result.get('StandardErrorContent', '')}")
        raise Exception("SSM command failed")

def lambda_handler(event, context):
    results = []
    try:
        # 1. RDS と ElastiCache は並行して変更開始（時間がかかるため先に）
        scale_up_rds()
        results.append("RDS: OK")

        scale_up_elasticache()
        results.append("ElastiCache: OK")

        # 2. EC2 スケールアップ
        scale_up_ec2()
        results.append("EC2: OK")

        # 3. アプリ設定変更（EC2 起動後）
        update_app_config()
        results.append("App Config: OK")

        message = "オークションモードへのスケールアップが完了しました。\n\n" + "\n".join(results)
        notify("✅ スケールアップ完了", message)

        return {'statusCode': 200, 'body': json.dumps(results)}

    except Exception as e:
        error_msg = f"スケールアップ中にエラーが発生しました。\n\n完了分: {results}\nエラー: {str(e)}"
        notify("❌ スケールアップ失敗", error_msg)
        raise
```

### 16-4. Lambda 関数作成（スケールダウン）

| 項目 | 値 |
|------|-----|
| 関数名 | `auction-scale-down` |
| ランタイム | Python 3.12 |
| IAM ロール | `auction-scaling-lambda-role` |
| タイムアウト | 900秒（15分） |
| メモリ | 256MB |

**コード:**

```python
import boto3
import time
import json

ec2 = boto3.client('ec2', region_name='ap-northeast-1')
rds = boto3.client('rds', region_name='ap-northeast-1')
elasticache = boto3.client('elasticache', region_name='ap-northeast-1')
ssm = boto3.client('ssm', region_name='ap-northeast-1')
sns = boto3.client('sns', region_name='ap-northeast-1')

EC2_INSTANCE_ID = 'i-xxxxxxxxxxxxxxxxx'  # auction-app-01
RDS_INSTANCE_ID = 'auction-db'
ELASTICACHE_REPL_GROUP = 'auction-redis'
SNS_TOPIC_ARN = 'arn:aws:sns:ap-northeast-1:xxxxxxxxxxxx:auction-alerts'

def notify(subject, message):
    try:
        sns.publish(TopicArn=SNS_TOPIC_ARN, Subject=subject, Message=message)
    except Exception as e:
        print(f"SNS notification failed: {e}")

def wait_ec2_stopped(instance_id, timeout=300):
    waiter = ec2.get_waiter('instance_stopped')
    waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': timeout // 15})

def wait_ec2_running(instance_id, timeout=300):
    waiter = ec2.get_waiter('instance_status_ok')
    waiter.wait(InstanceIds=[instance_id], WaiterConfig={'Delay': 15, 'MaxAttempts': timeout // 15})

def scale_down_ec2():
    """EC2: t3.large → t3.small"""
    print("EC2: Stopping instance...")
    ec2.stop_instances(InstanceIds=[EC2_INSTANCE_ID])
    wait_ec2_stopped(EC2_INSTANCE_ID)

    print("EC2: Changing instance type to t3.small...")
    ec2.modify_instance_attribute(
        InstanceId=EC2_INSTANCE_ID,
        InstanceType={'Value': 't3.small'}
    )

    print("EC2: Starting instance...")
    ec2.start_instances(InstanceIds=[EC2_INSTANCE_ID])
    wait_ec2_running(EC2_INSTANCE_ID)
    print("EC2: Scale-down complete")

def scale_down_rds():
    """RDS: db.t3.medium → db.t3.micro + Multi-AZ 無効 + パラメータグループ変更"""
    print("RDS: Scaling down...")
    rds.modify_db_instance(
        DBInstanceIdentifier=RDS_INSTANCE_ID,
        DBInstanceClass='db.t3.micro',
        DBParameterGroupName='auction-prod-db-params-micro',
        MultiAZ=False,
        ApplyImmediately=True
    )
    waiter = rds.get_waiter('db_instance_available')
    waiter.wait(
        DBInstanceIdentifier=RDS_INSTANCE_ID,
        WaiterConfig={'Delay': 30, 'MaxAttempts': 40}
    )
    print("RDS: Scale-down complete")

def scale_down_elasticache():
    """ElastiCache: cache.t3.medium → cache.t3.micro"""
    print("ElastiCache: Scaling down...")
    # レプリカがある場合は先に削除
    try:
        resp = elasticache.describe_replication_groups(
            ReplicationGroupId=ELASTICACHE_REPL_GROUP
        )
        node_groups = resp['ReplicationGroups'][0]['NodeGroups']
        if len(node_groups[0].get('NodeGroupMembers', [])) > 1:
            print("ElastiCache: Removing replica...")
            elasticache.decrease_replica_count(
                ReplicationGroupId=ELASTICACHE_REPL_GROUP,
                NewReplicaCount=0,
                ApplyImmediately=True
            )
            # 完了待機
            for _ in range(40):
                resp = elasticache.describe_replication_groups(
                    ReplicationGroupId=ELASTICACHE_REPL_GROUP
                )
                if resp['ReplicationGroups'][0]['Status'] == 'available':
                    break
                time.sleep(30)
    except Exception as e:
        print(f"Replica removal note: {e}")

    # ノードタイプ変更
    elasticache.modify_replication_group(
        ReplicationGroupId=ELASTICACHE_REPL_GROUP,
        CacheNodeType='cache.t3.micro',
        ApplyImmediately=True
    )
    for _ in range(40):
        resp = elasticache.describe_replication_groups(
            ReplicationGroupId=ELASTICACHE_REPL_GROUP
        )
        if resp['ReplicationGroups'][0]['Status'] == 'available':
            break
        time.sleep(30)
    print("ElastiCache: Scale-down complete")

def update_app_config():
    """SSM Run Command で PHP-FPM / Supervisor を通常モードに戻す"""
    print("App: Reverting PHP-FPM and Supervisor config...")
    commands = [
        # PHP-FPM
        "sed -i 's/pm.max_children = 80/pm.max_children = 30/' /etc/php-fpm.d/www.conf",
        "sed -i 's/pm.start_servers = 20/pm.start_servers = 5/' /etc/php-fpm.d/www.conf",
        "sed -i 's/pm.min_spare_servers = 10/pm.min_spare_servers = 3/' /etc/php-fpm.d/www.conf",
        "sed -i 's/pm.max_spare_servers = 40/pm.max_spare_servers = 10/' /etc/php-fpm.d/www.conf",
        "systemctl restart php8.2-fpm",
        # Supervisor
        "sed -i '/auction-queue-countdown/,/numprocs/{s/numprocs=5/numprocs=1/}' /etc/supervisord.d/auction.ini",
        "sed -i '/auction-queue-default/,/numprocs/{s/numprocs=2/numprocs=1/}' /etc/supervisord.d/auction.ini",
        "supervisorctl reread",
        "supervisorctl update",
    ]

    response = ssm.send_command(
        InstanceIds=[EC2_INSTANCE_ID],
        DocumentName='AWS-RunShellScript',
        Parameters={'commands': commands},
        TimeoutSeconds=120
    )

    command_id = response['Command']['CommandId']
    for _ in range(12):
        time.sleep(10)
        result = ssm.get_command_invocation(
            CommandId=command_id,
            InstanceId=EC2_INSTANCE_ID
        )
        if result['Status'] in ['Success', 'Failed', 'Cancelled']:
            break

    if result['Status'] == 'Success':
        print("App: Config revert complete")
    else:
        raise Exception(f"SSM command failed: {result.get('StandardErrorContent', '')}")

def lambda_handler(event, context):
    results = []
    try:
        # 1. アプリ設定を先に戻す（EC2 停止前に）
        update_app_config()
        results.append("App Config: OK")

        # 2. ElastiCache（レプリカ削除 + ノード縮小）
        scale_down_elasticache()
        results.append("ElastiCache: OK")

        # 3. RDS
        scale_down_rds()
        results.append("RDS: OK")

        # 4. EC2（最後に停止→縮小→起動）
        scale_down_ec2()
        results.append("EC2: OK")

        message = "通常モードへのスケールダウンが完了しました。\n\n" + "\n".join(results)
        notify("✅ スケールダウン完了", message)

        return {'statusCode': 200, 'body': json.dumps(results)}

    except Exception as e:
        error_msg = f"スケールダウン中にエラーが発生しました。\n\n完了分: {results}\nエラー: {str(e)}"
        notify("❌ スケールダウン失敗", error_msg)
        raise
```

### 16-5. EventBridge Scheduler でスケジュール登録

Lambda をテスト実行して正常動作を確認した後、EventBridge Scheduler で定期実行を設定する。

#### 方法 A: 手動でスケジュール登録（AWS コンソール）

オークションの開催日が決まったら、その都度 EventBridge でスケジュールを作成:

1. EventBridge コンソール → 「スケジュール」→「スケジュールを作成」

**スケールアップ用:**

| 項目 | 値 |
|------|-----|
| 名前 | `auction-scale-up-2026-05-01`（開催日を含める） |
| スケジュールタイプ | 1回限りのスケジュール |
| 日時 | 開催2日前の `AM 03:00 JST` |
| ターゲット | Lambda: `auction-scale-up` |

**スケールダウン用:**

| 項目 | 値 |
|------|-----|
| 名前 | `auction-scale-down-2026-05-01` |
| スケジュールタイプ | 1回限りのスケジュール |
| 日時 | 開催2日後の `AM 03:00 JST` |
| ターゲット | Lambda: `auction-scale-down` |

#### 方法 B: Laravel から自動登録（AuctionObserver）

オークション作成時に EventBridge スケジュールを自動登録する。

**必要な追加 IAM ポリシー（EC2 ロールに追加）:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

**Laravel 側の実装（参考）:**

ファイル: `app/Observers/AuctionObserver.php`

```php
use Aws\Scheduler\SchedulerClient;
use Carbon\Carbon;

class AuctionObserver
{
    public function created(Auction $auction): void
    {
        if (app()->environment('production')) {
            $this->registerScalingSchedules($auction);
        }
    }

    public function deleted(Auction $auction): void
    {
        if (app()->environment('production')) {
            $this->removeScalingSchedules($auction);
        }
    }

    private function registerScalingSchedules(Auction $auction): void
    {
        $client = new SchedulerClient([
            'region'  => 'ap-northeast-1',
            'version' => 'latest',
        ]);

        // 実際のモデルフィールドは event_date + start_time
        $auctionDate = Carbon::parse(
            $auction->event_date->format('Y-m-d') . ' ' . $auction->start_time,
            'Asia/Tokyo'
        );

        // スケールアップ: 開催2日前 AM3:00 JST
        $scaleUpAt = $auctionDate->copy()->subDays(2)->setTime(3, 0);
        // スケールダウン: 開催2日後 AM3:00 JST
        $scaleDownAt = $auctionDate->copy()->addDays(2)->setTime(3, 0);

        // スケールアップ
        $client->createSchedule([
            'Name' => "auction-scale-up-{$auction->id}",
            'ScheduleExpression' => "at({$scaleUpAt->format('Y-m-d\TH:i:s')})",
            'ScheduleExpressionTimezone' => 'Asia/Tokyo',
            'FlexibleTimeWindow' => ['Mode' => 'OFF'],
            'Target' => [
                'Arn'     => env('LAMBDA_SCALE_UP_ARN'),
                'RoleArn' => env('EVENTBRIDGE_ROLE_ARN'),
                'Input'   => json_encode(['auction_id' => $auction->id]),
            ],
            'ActionAfterCompletion' => 'DELETE', // 実行後に自動削除
        ]);

        // スケールダウン
        $client->createSchedule([
            'Name' => "auction-scale-down-{$auction->id}",
            'ScheduleExpression' => "at({$scaleDownAt->format('Y-m-d\TH:i:s')})",
            'ScheduleExpressionTimezone' => 'Asia/Tokyo',
            'FlexibleTimeWindow' => ['Mode' => 'OFF'],
            'Target' => [
                'Arn'     => env('LAMBDA_SCALE_DOWN_ARN'),
                'RoleArn' => env('EVENTBRIDGE_ROLE_ARN'),
                'Input'   => json_encode(['auction_id' => $auction->id]),
            ],
            'ActionAfterCompletion' => 'DELETE',
        ]);
    }

    private function removeScalingSchedules(Auction $auction): void
    {
        $client = new SchedulerClient([
            'region'  => 'ap-northeast-1',
            'version' => 'latest',
        ]);

        try {
            $client->deleteSchedule(['Name' => "auction-scale-up-{$auction->id}"]);
            $client->deleteSchedule(['Name' => "auction-scale-down-{$auction->id}"]);
        } catch (\Exception $e) {
            // スケジュールが存在しない場合は無視
        }
    }
}
```

**.env に追加:**

```env
LAMBDA_SCALE_UP_ARN=arn:aws:lambda:ap-northeast-1:xxxxxxxxxxxx:function:auction-scale-up
LAMBDA_SCALE_DOWN_ARN=arn:aws:lambda:ap-northeast-1:xxxxxxxxxxxx:function:auction-scale-down
EVENTBRIDGE_ROLE_ARN=arn:aws:iam::xxxxxxxxxxxx:role/auction-eventbridge-scheduler-role
```

### 16-6. 自動化の導入推奨順序

```
Phase 1（初回〜3回目のオークション）:
  → 手動切り替え（STEP 15）で運用しながら手順を習熟

Phase 2（4回目以降）:
  → Lambda を作成・テスト → EventBridge で手動スケジュール登録（方法 A）

Phase 3（安定運用後）:
  → AuctionObserver で自動登録（方法 B）を実装
  → スケールダウン忘れリスクがゼロに
```

---

## STEP 17: 管理画面からのスケーリング実行

STEP 16 の Lambda を管理画面から手動で呼び出せる機能を実装済み。
スケジュール登録なしでワンボタンでのスケーリングが可能。

### 17-1. 機能概要

管理画面 `/admin/scaling` にアクセスすると以下が可能:

- **現在のモード表示**: EC2 インスタンスタイプから `通常モード` / `オークションモード` / `カスタム構成` を判定
- **スケールアップ実行**: ボタン + テキスト確認 (`SCALE_UP` と入力)
- **スケールダウン実行**: ボタン + テキスト確認 (`SCALE_DOWN` と入力)
- **実行中ロック**: 重複実行防止（30分 TTL）
- **最終実行ログ**: 直近のスケーリング履歴表示
- **自動更新**: 15秒ごとにステータス再取得

### 17-2. 実装済みファイル

| 層 | ファイル |
|---|---|
| バックエンド | `app/Services/AwsScalingService.php` |
| バックエンド | `app/Http/Controllers/Admin/ScalingController.php` |
| バックエンド | `config/aws.php` |
| ルート | `routes/api.php`（`admin/scaling/*`） |
| フロントエンド | `resources/ts/pages/admin/Scaling.tsx` |
| ナビゲーション | `resources/ts/layouts/AdminLayout.tsx` |
| ルーティング | `resources/ts/App.tsx` |

### 17-3. API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/admin/scaling/status` | 現在のモードと最終実行を取得 |
| POST | `/api/admin/scaling/scale-up` | Lambda `auction-scale-up` を非同期実行 |
| POST | `/api/admin/scaling/scale-down` | Lambda `auction-scale-down` を非同期実行 |
| POST | `/api/admin/scaling/release-lock` | 実行中ロックの強制解除（トラブル時用） |

すべて `auth:sanctum` + `check.role:admin` ミドルウェアで保護。

### 17-4. 必要な .env 追加

```env
# === AWS インフラスケーリング ===
AWS_EC2_INSTANCE_ID=i-xxxxxxxxxxxxxxxxx
AWS_NORMAL_INSTANCE_TYPE=t3.small
AWS_AUCTION_INSTANCE_TYPE=t3.large
AWS_LAMBDA_SCALE_UP=auction-scale-up
AWS_LAMBDA_SCALE_DOWN=auction-scale-down
```

### 17-5. EC2 IAM ロールへの追加ポリシー

管理画面から Lambda を呼び出すため、`auction-ec2-role` に以下を追加:

**ポリシー名: `auction-ec2-scaling-invoke`**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeScalingLambdas",
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": [
        "arn:aws:lambda:ap-northeast-1:xxxxxxxxxxxx:function:auction-scale-up",
        "arn:aws:lambda:ap-northeast-1:xxxxxxxxxxxx:function:auction-scale-down"
      ]
    },
    {
      "Sid": "DescribeEC2ForStatus",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

**適用手順:**

1. IAM コンソール → ポリシー → 「ポリシーを作成」
2. 上記 JSON を貼り付け → 名前 `auction-ec2-scaling-invoke` で作成
3. ロール `auction-ec2-role` → 「許可を追加」→「ポリシーをアタッチ」→ 上記ポリシーを選択

### 17-6. セキュリティ設計

| 項目 | 実装 |
|------|------|
| 認証 | Laravel Sanctum（`auth:sanctum`） |
| 認可 | `check.role:admin` ミドルウェアで管理者のみ許可 |
| 二段階確認 | ダイアログで `SCALE_UP` / `SCALE_DOWN` 文字列入力を要求 |
| 重複実行防止 | `Cache::lock()` で排他制御（TTL 30分） |
| モード判定 | 現在のモードと逆の操作のみボタン活性化 |
| 監査ログ | Laravel ログ + SNS 通知（Lambda 側） |

### 17-7. 運用フロー

```
管理者が /admin/scaling にアクセス
  │
  ▼
現在のモード確認（例: 通常モード = t3.small）
  │
  ▼
「スケールアップ実行」ボタンクリック
  │
  ▼
確認ダイアログ → "SCALE_UP" を入力 → 実行
  │
  ▼
Laravel: Cache ロック取得 → Lambda を非同期 Invoke
  │
  ▼
Lambda: EC2/RDS/ElastiCache/SSM を順次変更（15分程度）
  │
  ▼
Lambda: SNS にメール通知（成功/失敗）
  │
  ▼
管理画面: 15秒ごとに状態更新 → 新モードに切り替わったことを確認
```

### 17-8. トラブルシューティング

**ロックが解除されない場合:**
- 30分経過で自動解除されるが、手動解除も可能
- 画面の「ロック解除」ボタンをクリック
- または `POST /api/admin/scaling/release-lock`

**Lambda が起動しない場合:**
- IAM ポリシー `auction-ec2-scaling-invoke` がアタッチされているか確認
- Lambda 関数名が `.env` の値と一致しているか確認
- CloudWatch Logs で Lambda の実行ログを確認

**モードが `custom` と表示される場合:**
- EC2 のインスタンスタイプが `t3.small` / `t3.large` 以外になっている
- AWS コンソールで手動変更されたか、.env の `AWS_NORMAL_INSTANCE_TYPE` / `AWS_AUCTION_INSTANCE_TYPE` と実際の値が違う

---

## 参考: 構成図

```
                 ┌──────────────────────────────────────────┐
                 │              Internet                     │
                 └────────────────────┬─────────────────────┘
                                      │
                             ┌────────▼────────┐
                             │   Route 53      │
                             │  {新ドメイン}     │
                             └────────┬────────┘
                                      │
                             ┌────────▼────────┐
                             │      ACM        │
                             │  (SSL証明書)     │
                             └────────┬────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │    ALB (auction-alb)                │
                    │    :443 HTTPS                       │
                    │    ├── /app/* → WS (port 8080)     │
                    │    └── /*     → HTTP (port 80)     │
                    │    idle_timeout: 3600s              │
                    └──────────┬─────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   EC2 (t3.small)    │
                    │   auction-app-01    │
                    │                     │
                    │   Nginx → PHP-FPM   │
                    │   Reverb :6001      │
                    │   Queue Workers     │
                    │   Supervisor        │
                    └──┬──────────┬───────┘
                       │          │
          ┌────────────▼──┐  ┌───▼──────────────┐
          │  RDS MySQL    │  │  ElastiCache     │
          │  db.t3.micro  │  │  cache.t3.micro  │
          │  Private-a    │  │  Private-a       │
          └───────────────┘  └──────────────────┘

                    ┌───────────────┐
                    │  S3           │
                    │  メディア保存  │
                    └───────────────┘
```

---

## 月額コスト見積もり

### 通常モード（~20日/月）

| リソース | スペック | 月額 (USD) |
|---------|---------|-----------|
| EC2 | t3.small | ~$15 |
| RDS | db.t3.micro | ~$13 |
| ElastiCache | cache.t3.micro | ~$12 |
| ALB | 固定 + LCU | ~$20 |
| S3 | 10GB想定 | ~$1 |
| Route 53 | ホストゾーン + クエリ | ~$1 |
| データ転送 | 50GB想定 | ~$5 |
| **合計** | | **~$67/月 (~¥10,000)** |

### オークションモード（~10日/月）

| リソース | スペック | 追加コスト (USD) |
|---------|---------|---------------|
| EC2 | t3.large (差分) | ~$20 |
| RDS | db.t3.medium Multi-AZ (差分) | ~$40 |
| ElastiCache | cache.t3.medium + Replica (差分) | ~$30 |
| **追加分** | | **~$90 (10日分按分で~$30)** |

### 月額合計（2モード運用）

| パターン | 月額 (USD) | 月額 (JPY) |
|---------|-----------|-----------|
| **通常 + オークション連動** | **~$97** | **~¥14,500** |
| 常時500人対応（参考） | ~$376 | ~¥56,400 |

> ドメイン取得費: 年間 $10〜$15 程度（.com の場合）

---

## 作業完了後のメモ

以下の情報を安全に保管すること:

```
□ RDS エンドポイント:
□ RDS マスターパスワード:
□ ElastiCache エンドポイント:
□ ElastiCache AUTH トークン:
□ ACM 証明書 ARN:
□ ALB DNS 名:
□ S3 バケット名:
□ Reverb App Key:
□ Reverb App Secret:
□ 新ドメイン名:
□ EC2 インスタンス ID:
```
