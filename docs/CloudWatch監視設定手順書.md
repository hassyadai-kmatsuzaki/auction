# CloudWatch 監視設定手順書

**対象**: めだかライブオークション 本番環境
**前提**: EC2 上で稼働、`storage/logs/alerts.log` がアプリから出力される
**方式**: EMF (Embedded Metric Format) により、ログ転送するだけでメトリクスが抽出される
**最終更新**: 2026-04-14

---

## 目次

1. [全体構成](#1-全体構成)
2. [EC2 に CloudWatch Logs Agent を導入](#2-ec2-に-cloudwatch-logs-agent-を導入)
3. [SNSトピックとEmail通知](#3-snsトピックとemail通知)
4. [CloudWatch アラーム設定](#4-cloudwatch-アラーム設定)
5. [ダッシュボード作成](#5-ダッシュボード作成)
6. [動作確認](#6-動作確認)
7. [運用時の対処早見表](#7-運用時の対処早見表)

---

## 1. 全体構成

```
Laravel App (MetricRecorder)
        ↓  1行=1JSON
storage/logs/alerts.log
        ↓  CloudWatch Logs Agent
CloudWatch Logs: /auction/app/alerts
        ↓  EMF 自動抽出
CloudWatch Metrics: Auction/App ネームスペース
        ↓  Alarm
SNS Topic: auction-alerts
        ↓
Email 通知
```

### 取得されるメトリクス一覧

すべて `Auction/App` ネームスペース、ディメンション `EventType` 付き。

| EventType | Metric名 | 単位 | 意味 |
|-----------|---------|------|------|
| `countdown_tick` | `CountdownTick` | Count | カウントダウン1ティック（ハートビート） |
| `countdown_tick` | `CountdownRemaining` | Seconds | 残り秒数 |
| `price_increment` | `PriceIncrement` | Count | 価格上昇イベント |
| `price_increment` | `PriceJump` | None | 上昇幅（円） |
| `price_increment` | `PriceJumpRatio` | None | 上昇率（0.0〜1.0） |
| `price_increment_failed` | `PriceIncrementFailure` | Count | 価格上昇失敗 |
| `bid_failure` | `BidFailure` | Count | 入札API例外 |
| `broadcast_failure` | `BroadcastFailure` | Count | ブロードキャスト失敗 |
| `job_failure` | `JobFailure` | Count | ジョブ失敗（ProcessAuctionCountdownJob等） |
| `item_sold` | `ItemSold` | Count | 落札成立 |
| `item_sold` | `WinningPrice` | None | 落札価格 |
| `item_unsold` | `ItemUnsold` | Count | 流札 |

---

## 2. EC2 に CloudWatch Logs Agent を導入

### 2-1. IAMロールにポリシー追加

EC2 にアタッチ済みのロール（例: `auction-ec2-role`）に `CloudWatchAgentServerPolicy` をアタッチ。

### 2-2. CloudWatch Agent インストール

```bash
sudo yum install -y amazon-cloudwatch-agent
# または Ubuntu の場合:
# wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
# sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
```

### 2-3. 設定ファイル `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`

```json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/www/auction/storage/logs/alerts.log",
            "log_group_name": "/auction/app/alerts",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 30,
            "timestamp_format": "%Y-%m-%dT%H:%M:%S"
          },
          {
            "file_path": "/var/www/auction/storage/logs/laravel.log",
            "log_group_name": "/auction/app/laravel",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 14
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/auction/nginx/access",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 14
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/auction/nginx/error",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 14
          }
        ]
      }
    }
  }
}
```

### 2-4. 起動

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# 状態確認
sudo systemctl status amazon-cloudwatch-agent
```

### 2-5. EMF の自動抽出を確認

`/auction/app/alerts` ロググループに対して特別な設定は不要です。
CloudWatch は `_aws.CloudWatchMetrics` ブロックを含む JSON ログを自動検出し、
`Auction/App` ネームスペースに数分以内にメトリクスが出現します。

**確認**: CloudWatch コンソール → メトリクス → カスタムネームスペース → `Auction/App`

---

## 3. SNSトピックとEmail通知（マネジメントコンソール）

> **作業前提**: AWS マネジメントコンソールにログイン済み、リージョンは右上で **東京 (ap-northeast-1)** を選択

### 3-1. トピック作成

1. AWSコンソール上部の検索バーで **「SNS」** を検索 → **Simple Notification Service** を開く
2. 左メニューから **「トピック」** をクリック
3. 右上の **「トピックの作成」** ボタン
4. **タイプ**: `スタンダード` を選択
5. **名前**: `auction-alerts`
6. **表示名（任意）**: `オークション監視アラート`
7. それ以外はデフォルトのまま、画面下部の **「トピックの作成」** をクリック
8. 作成完了画面で表示される **ARN**（`arn:aws:sns:ap-northeast-1:XXXX:auction-alerts`）をメモ

### 3-2. Email サブスクリプション

1. 作成したトピックの詳細画面で **「サブスクリプションの作成」** をクリック
2. **プロトコル**: `Eメール` を選択
3. **エンドポイント**: 通知先メールアドレス（例: `ops@example.com`）
4. **「サブスクリプションの作成」** をクリック
5. 該当メールアドレスに **「AWS Notification - Subscription Confirmation」** が届く
6. メール本文の **「Confirm subscription」** リンクをクリックして購読確定
7. SNSコンソールに戻り、サブスクリプションのステータスが **「確認済み」** になっていることを確認

> 📌 **複数人に通知したい場合**: ステップ1〜6を人数分繰り返す。本番運用は最低2人推奨。

---

## 4. CloudWatch アラーム設定（マネジメントコンソール）

### 共通手順

すべてのアラームは以下の流れで作成します:

```
CloudWatch コンソール
  → 左メニュー「アラーム」→「すべてのアラーム」
    → 右上「アラームの作成」
      → ①メトリクスの選択
      → ②条件の指定
      → ③アクションの設定
      → ④名前と説明の追加
      → プレビューと作成
```

> 📌 **メトリクスが見つからない場合**: 「Auction/App」ネームスペースは、**1度メトリクスが発火された後** にコンソールに出現します。
> §6-1 のテストを先に実行して `priceIncrement` 等を1回発火させてからアラームを作成してください。

---

### 4-1. 🔴 カウントダウン停止検知（最重要）

**ロジック**: 通常時は毎秒2ティック発火される。1分間で `CountdownTick < 1` ならレーン停止と判定。

#### 設定手順

1. CloudWatch → 左メニュー **「アラーム」→「すべてのアラーム」**
2. 右上 **「アラームの作成」**
3. **「メトリクスの選択」** をクリック
4. 検索バーで **「Auction/App」** と入力 → ネームスペースをクリック
5. **「EventType」** ディメンションをクリック
6. 一覧から **`CountdownTick`** + **EventType=`countdown_tick`** にチェック
7. **「メトリクスの選択」** をクリック

8. **メトリクスと条件の指定** 画面:
   | 項目 | 値 |
   |------|-----|
   | 統計 | **合計 (Sum)** |
   | 期間 | **1分** |
   | しきい値の種類 | **静的** |
   | アラーム条件 | **以下** (`Lower`) |
   | しきい値 | **1** |
   | 不足データの処理 | **不正 (breaching)** ← 重要 |
9. **「次へ」**

10. **アクションの設定**:
    | 項目 | 値 |
    |------|-----|
    | アラーム状態トリガー | **アラーム状態 (In alarm)** |
    | SNSトピック | **既存のSNSトピックを選択** → `auction-alerts` |
11. **「次へ」**

12. **名前と説明**:
    | 項目 | 値 |
    |------|-----|
    | アラーム名 | `auction-countdown-stalled` |
    | アラームの説明 | `カウントダウンが停止している（tickが1分間0件）` |
13. **「次へ」** → プレビュー確認 → **「アラームの作成」**

---

### 4-2. 🔴 価格上昇処理失敗

| 項目 | 値 |
|------|-----|
| メトリクス | `PriceIncrementFailure` (EventType=`price_increment_failed`) |
| 統計 | **合計** |
| 期間 | **5分** |
| アラーム条件 | **以上** (`Greater/Equal`) |
| しきい値 | **3** |
| 不足データの処理 | **適正 (notBreaching)** |
| SNSトピック | `auction-alerts` |
| アラーム名 | `auction-price-increment-failed` |
| 説明 | `価格上昇処理で例外発生（5分で3件以上）` |

---

### 4-3. 🔴 価格急騰異常（1回で大ジャンプ）

**ロジック**: 1回の `PriceJump` 最大値が閾値超え。デフォルト ¥50,000（業務上の上限想定値に合わせて調整）。

| 項目 | 値 |
|------|-----|
| メトリクス | `PriceJump` (EventType=`price_increment`) |
| 統計 | **最大 (Maximum)** ← 注意 |
| 期間 | **1分** |
| アラーム条件 | **より大きい** (`Greater`) |
| しきい値 | **50000** |
| 不足データの処理 | **適正** |
| SNSトピック | `auction-alerts` |
| アラーム名 | `auction-price-anomaly-jump` |
| 説明 | `1回の価格上昇が¥50,000を超えた` |

---

### 4-4. 🔴 Job 失敗

| 項目 | 値 |
|------|-----|
| メトリクス | `JobFailure` (EventType=`job_failure`) |
| 統計 | **合計** |
| 期間 | **5分** |
| アラーム条件 | **以上** |
| しきい値 | **1** |
| 不足データの処理 | **適正** |
| SNSトピック | `auction-alerts` |
| アラーム名 | `auction-job-failed` |
| 説明 | `ProcessAuctionCountdownJob など重要ジョブが失敗` |

---

### 4-5. 🔴 Broadcast 失敗率

| 項目 | 値 |
|------|-----|
| メトリクス | `BroadcastFailure` (EventType=`broadcast_failure`) |
| 統計 | **合計** |
| 期間 | **1分** |
| アラーム条件 | **以上** |
| しきい値 | **30** |
| 不足データの処理 | **適正** |
| SNSトピック | `auction-alerts` |
| アラーム名 | `auction-broadcast-failure-spike` |
| 説明 | `配信失敗が1分で30件以上（Reverb/Pusher異常）` |

---

### 4-6. 🟡 入札失敗率スパイク

| 項目 | 値 |
|------|-----|
| メトリクス | `BidFailure` (EventType=`bid_failure`) |
| 統計 | **合計** |
| 期間 | **5分** |
| アラーム条件 | **以上** |
| しきい値 | **20** |
| 不足データの処理 | **適正** |
| SNSトピック | `auction-alerts` |
| アラーム名 | `auction-bid-failure-spike` |
| 説明 | `入札例外が5分で20件以上` |

---

### 4-7. インフラ系（既存の `AWS_インフラ構築作業指示書.md` §STEP 14 を参照）

下記はネームスペースが異なるので、メトリクス選択時にそれぞれのサービスを選びます。

| アラーム名 | ネームスペース | メトリクス | 条件 |
|----------|--------------|----------|------|
| `auction-ec2-cpu-high` | `AWS/EC2` | `CPUUtilization` | > 80%（5分）|
| `auction-rds-memory-low` | `AWS/RDS` | `FreeableMemory` | < 200MB（5分）|
| `auction-rds-conn-high` | `AWS/RDS` | `DatabaseConnections` | > 120（5分）|
| `auction-redis-cpu-high` | `AWS/ElastiCache` | `EngineCPUUtilization` | > 80%（5分）|
| `auction-redis-conn-high` | `AWS/ElastiCache` | `CurrConnections` | > 400（5分）|
| `auction-alb-healthy-low` | `AWS/ApplicationELB` | `HealthyHostCount` | < 1（1分）|
| `auction-alb-5xx-spike` | `AWS/ApplicationELB` | `HTTPCode_Target_5XX_Count` | > 10（5分）|

すべて SNSトピック `auction-alerts` を通知先に設定。

---

## 5. ダッシュボード作成（マネジメントコンソール）

オークション開催中に一元的に状況を見るためのダッシュボード。**負荷テスト中もこの画面を見続けます**。

### 5-1. ダッシュボード作成

1. CloudWatch → 左メニュー **「ダッシュボード」**
2. **「ダッシュボードの作成」** をクリック
3. **ダッシュボード名**: `auction-live`
4. **「ダッシュボードの作成」** をクリック

### 5-2. ウィジェットの追加（4つ作成）

新規ダッシュボードの空画面で **「+」 ウィジェットの追加** をクリックして以下4つを作成します。

#### ウィジェット① カウントダウン Tick

1. **「+」→「ウィジェットを追加」→「線」グラフを選択 → 「メトリクス」**
2. メトリクス選択: `Auction/App` → `EventType` → `CountdownTick` (countdown_tick)
3. 下部タブ **「グラフ化されたメトリクス」**:
   | 項目 | 値 |
   |------|-----|
   | 統計 | **合計** |
   | 期間 | **1分** |
4. ウィジェットタイトル: **「Countdown Tick (1分合計)」**
5. **「ウィジェットの作成」**

#### ウィジェット② 入札進行（落札・流札・価格上昇）

1. **「+」→「線」→「メトリクス」**
2. 3つのメトリクスを順に追加:
   - `PriceIncrement` (price_increment)
   - `ItemSold` (item_sold)
   - `ItemUnsold` (item_unsold)
3. 統計: **合計** / 期間: **1分**
4. タイトル: **「入札進行」**

#### ウィジェット③ 価格ジャンプ幅（最大）

1. **「+」→「線」→「メトリクス」**
2. メトリクス: `PriceJump` (price_increment)
3. 統計: **最大** ← 注意 / 期間: **1分**
4. タイトル: **「価格ジャンプ幅（最大）」**

#### ウィジェット④ エラー系（4種まとめて）

1. **「+」→「線」→「メトリクス」**
2. 4つのメトリクスを順に追加:
   - `BidFailure` (bid_failure)
   - `BroadcastFailure` (broadcast_failure)
   - `JobFailure` (job_failure)
   - `PriceIncrementFailure` (price_increment_failed)
3. 統計: **合計** / 期間: **5分**
4. タイトル: **「エラー系（各5分合計）」**

### 5-3. レイアウト調整と保存

1. ウィジェットをドラッグして **2×2 のグリッド** に配置
2. ダッシュボード右上の **「ダッシュボードの保存」** をクリック

### 5-4. アラームウィジェットの追加（任意・推奨）

1. ダッシュボード上部 **「+」→「アラームステータス」**
2. §4 で作成した6つのアラームをすべて選択
3. タイトル: **「アラーム状態」** → 保存

これでダッシュボード1画面で「ライブ状況」と「アラート状態」が一目で見えます。

### 5-5. 自動更新の設定

ダッシュボード右上の **更新間隔ドロップダウン** で **「10秒」** を選択。
負荷テスト中は常時表示しておきます。

---

## 6. 動作確認

### 6-1. ローカル/ステージングでのメトリクス発火テスト

```bash
php artisan tinker
>>> app(\App\Services\Monitoring\MetricRecorder::class)->priceIncrement(1, 1, 100.0, 200.0, 'test')
```

`storage/logs/alerts.log` に1行JSONが追記されるか確認:
```bash
tail -n1 storage/logs/alerts.log | jq .
```

### 6-2. 本番でメトリクス到着を確認

#### サーバー側
```bash
tail -f /var/www/auction/storage/logs/alerts.log
```
→ 何かオークション操作するとログが出ること

#### コンソール側
1. **CloudWatch → ロググループ** → `/auction/app/alerts` を開く
2. **ログストリーム** で最新を選択 → JSONログが流れていること（数十秒遅延あり）
3. **CloudWatch → メトリクス → カスタムネームスペース** → **`Auction/App`** が出現していること（数分遅延あり）
4. クリックして **`EventType`** を選び、各メトリクスがグラフ化できること

### 6-3. アラームの手動テスト（マネジメントコンソール）

実際にアラームを発火させて、Email通知が届くことを確認します。

1. CloudWatch → **「アラーム」→「すべてのアラーム」**
2. テスト対象（例: `auction-countdown-stalled`）をクリック
3. 右上 **「アクション」→「アラーム状態の設定」**
4. **状態**: `アラーム`
5. **理由**: `test`
6. **「設定」** をクリック
7. 数秒〜数十秒で SNS 購読メールアドレスに通知メールが届くことを確認

> 📌 確認後、同じ手順で **状態を「OK」に戻す** ことを忘れずに。

---

## 7. 運用時の対処早見表

| アラート | 一次対応 | エスカレ |
|---------|---------|---------|
| countdown-stalled | `php artisan queue:work countdown` ワーカー死活確認 → supervisor 再起動 → `MonitorAuctionJobs` コマンドで再ディスパッチ | Redis接続、DBの `items.status='live'` 確認 |
| price-increment-failed | `laravel.log` で詳細確認、該当オークションの status を確認。価格整合性は `price_events` 末尾と `items.current_price` を照合 | 必要なら `adjustPriceByBidLimits` 手動実行 or 管理者UIで価格調整 |
| price-anomaly-jump | 指値複数による急騰は仕様、通常入札で発生してたら要調査。`bid_limit_prices` テーブル確認 | 意図的な操作でなければ管理者UIで価格ロールバック |
| job-failed | `failed_jobs` テーブル確認、`php artisan queue:retry all` で再試行 | 設計上の問題であれば Job のロジック修正 |
| broadcast-failure-spike | Reverb/Pusher のステータスページ確認。接続URL・キー切り替え等 | UIが見えなくても入札処理は動作する（クライアントに案内） |
| bid-failure-spike | 特定ユーザー起因か全体か切り分け（`alerts.log` で `user_id` 絞込み）。指値 or 通常入札かで別 | DB接続、`items` テーブルのロック状況確認 |

---

## 付録A: 費用感

- **CloudWatch Logs**: 最初の5GB無料、以降 $0.50/GB（東京）
- **CloudWatch Custom Metrics**: $0.30/metric/月（ディメンション別にカウント）
  - 本設定では 12 EventType × 各メトリクス = 約30前後 → **約$10/月**
- **SNS Email**: 無料枠内（月1,000通まで）
- **合計**: おそらく **月$15〜20** 程度

---

## 付録B: AWS CLI で一括設定したい場合（参考）

複数環境（ステージング・本番）に同じアラーム構成を投入したい場合や、
インフラをコード管理したい場合は、以下のCLIコマンドが利用できます。

### 事前準備
```bash
SNS_ARN="arn:aws:sns:ap-northeast-1:XXXX:auction-alerts"
REGION="ap-northeast-1"
```

### SNSトピック・購読
```bash
aws sns create-topic --name auction-alerts --region $REGION
aws sns subscribe --topic-arn $SNS_ARN --protocol email \
    --notification-endpoint ops@example.com --region $REGION
```

### アラーム6種を一括作成
```bash
# 4-1 カウントダウン停止
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-countdown-stalled" \
  --alarm-description "カウントダウンが停止している（tickが1分間0件）" \
  --namespace "Auction/App" --metric-name "CountdownTick" \
  --dimensions "Name=EventType,Value=countdown_tick" \
  --statistic Sum --period 60 --evaluation-periods 1 \
  --threshold 1 --comparison-operator LessThanThreshold \
  --treat-missing-data breaching \
  --alarm-actions "$SNS_ARN" --region $REGION

# 4-2 価格上昇失敗
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-price-increment-failed" \
  --alarm-description "価格上昇処理で例外発生（5分で3件以上）" \
  --namespace "Auction/App" --metric-name "PriceIncrementFailure" \
  --dimensions "Name=EventType,Value=price_increment_failed" \
  --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 3 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" --region $REGION

# 4-3 価格急騰
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-price-anomaly-jump" \
  --alarm-description "1回の価格上昇が¥50,000を超えた" \
  --namespace "Auction/App" --metric-name "PriceJump" \
  --dimensions "Name=EventType,Value=price_increment" \
  --statistic Maximum --period 60 --evaluation-periods 1 \
  --threshold 50000 --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" --region $REGION

# 4-4 Job失敗
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-job-failed" \
  --alarm-description "重要ジョブが失敗" \
  --namespace "Auction/App" --metric-name "JobFailure" \
  --dimensions "Name=EventType,Value=job_failure" \
  --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" --region $REGION

# 4-5 Broadcast失敗
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-broadcast-failure-spike" \
  --alarm-description "配信失敗が1分で30件以上" \
  --namespace "Auction/App" --metric-name "BroadcastFailure" \
  --dimensions "Name=EventType,Value=broadcast_failure" \
  --statistic Sum --period 60 --evaluation-periods 1 \
  --threshold 30 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" --region $REGION

# 4-6 入札失敗スパイク
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-bid-failure-spike" \
  --alarm-description "入札例外が5分で20件以上" \
  --namespace "Auction/App" --metric-name "BidFailure" \
  --dimensions "Name=EventType,Value=bid_failure" \
  --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 20 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" --region $REGION
```

### ダッシュボード一括作成
```bash
cat > /tmp/auction-dashboard.json <<'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [["Auction/App", "CountdownTick", "EventType", "countdown_tick"]],
        "title": "Countdown Tick (1分合計)",
        "stat": "Sum", "period": 60, "region": "ap-northeast-1"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["Auction/App", "PriceIncrement", "EventType", "price_increment"],
          ["Auction/App", "ItemSold", "EventType", "item_sold"],
          ["Auction/App", "ItemUnsold", "EventType", "item_unsold"]
        ],
        "title": "入札進行",
        "stat": "Sum", "period": 60
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [["Auction/App", "PriceJump", "EventType", "price_increment"]],
        "title": "価格ジャンプ幅（最大）",
        "stat": "Maximum", "period": 60
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["Auction/App", "BidFailure", "EventType", "bid_failure"],
          ["Auction/App", "BroadcastFailure", "EventType", "broadcast_failure"],
          ["Auction/App", "JobFailure", "EventType", "job_failure"],
          ["Auction/App", "PriceIncrementFailure", "EventType", "price_increment_failed"]
        ],
        "title": "エラー系（各5分合計）",
        "stat": "Sum", "period": 300
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name "auction-live" \
  --dashboard-body file:///tmp/auction-dashboard.json \
  --region $REGION
```

### アラーム手動テスト
```bash
aws cloudwatch set-alarm-state \
  --alarm-name "auction-countdown-stalled" \
  --state-value ALARM --state-reason "test" \
  --region $REGION
```
