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

## 3. SNSトピックとEmail通知

### 3-1. トピック作成

```bash
aws sns create-topic --name auction-alerts --region ap-northeast-1
# → ARN をメモ: arn:aws:sns:ap-northeast-1:XXXX:auction-alerts
```

### 3-2. Email サブスクリプション

```bash
aws sns subscribe \
    --topic-arn arn:aws:sns:ap-northeast-1:XXXX:auction-alerts \
    --protocol email \
    --notification-endpoint ops@example.com \
    --region ap-northeast-1
```

受信したメールの "Confirm subscription" リンクをクリックして購読確定。

---

## 4. CloudWatch アラーム設定

以下の表は AWS CLI で一括設定できる形で提示します。
`$SNS_ARN` に 3-1 のARNを差し替えてから実行してください。

```bash
SNS_ARN="arn:aws:sns:ap-northeast-1:XXXX:auction-alerts"
REGION="ap-northeast-1"
```

### 4-1. 🔴 カウントダウン停止検知（最重要）

**ロジック**: 通常時は毎秒 2ティック発火される。1分以下のデータポイントで `CountdownTick < 1` が続けばレーン停止。

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-countdown-stalled" \
  --alarm-description "カウントダウンが停止している（tickが1分間0件）" \
  --namespace "Auction/App" \
  --metric-name "CountdownTick" \
  --dimensions "Name=EventType,Value=countdown_tick" \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --treat-missing-data breaching \
  --alarm-actions "$SNS_ARN" \
  --region $REGION
```

### 4-2. 🔴 価格上昇処理失敗

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-price-increment-failed" \
  --alarm-description "価格上昇処理で例外発生（5分で3件以上）" \
  --namespace "Auction/App" \
  --metric-name "PriceIncrementFailure" \
  --dimensions "Name=EventType,Value=price_increment_failed" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" \
  --region $REGION
```

### 4-3. 🔴 価格急騰異常（1回で大ジャンプ）

**ロジック**: `PriceJump` の最大値が閾値を超えたらアラート。
デフォルト ¥50,000（業務上の上限想定値に合わせて調整）。

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-price-anomaly-jump" \
  --alarm-description "1回の価格上昇が¥50,000を超えた" \
  --namespace "Auction/App" \
  --metric-name "PriceJump" \
  --dimensions "Name=EventType,Value=price_increment" \
  --statistic Maximum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 50000 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" \
  --region $REGION
```

### 4-4. 🔴 Job 失敗

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-job-failed" \
  --alarm-description "ProcessAuctionCountdownJob など重要ジョブが失敗" \
  --namespace "Auction/App" \
  --metric-name "JobFailure" \
  --dimensions "Name=EventType,Value=job_failure" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" \
  --region $REGION
```

### 4-5. 🔴 Broadcast 失敗率

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-broadcast-failure-spike" \
  --alarm-description "配信失敗が1分で30件以上（Reverb/Pusher異常）" \
  --namespace "Auction/App" \
  --metric-name "BroadcastFailure" \
  --dimensions "Name=EventType,Value=broadcast_failure" \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 30 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" \
  --region $REGION
```

### 4-6. 🟡 入札失敗率スパイク

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "auction-bid-failure-spike" \
  --alarm-description "入札例外が5分で20件以上" \
  --namespace "Auction/App" \
  --metric-name "BidFailure" \
  --dimensions "Name=EventType,Value=bid_failure" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_ARN" \
  --region $REGION
```

### 4-7. インフラ系（既存の `AWS_インフラ構築作業指示書.md` §STEP 14 と併存）

- EC2 CPU > 80%
- RDS FreeableMemory < 200MB / DatabaseConnections > 120
- ElastiCache EngineCPUUtilization > 80% / CurrConnections > 400
- ALB HealthyHostCount < 1 / HTTPCode_Target_5XX_Count > 10

---

## 5. ダッシュボード作成

オークション開催中に一元的に状況を見るための CloudWatch ダッシュボード例。

```bash
aws cloudwatch put-dashboard \
  --dashboard-name "auction-live" \
  --dashboard-body file://dashboard.json \
  --region $REGION
```

`dashboard.json` の例は下記。手動でコンソールから同等のウィジェットを作ってもOK。

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [["Auction/App", "CountdownTick", "EventType", "countdown_tick"]],
        "title": "Countdown Tick (1分合計)",
        "stat": "Sum",
        "period": 60,
        "region": "ap-northeast-1"
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
        "stat": "Sum",
        "period": 60
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [["Auction/App", "PriceJump", "EventType", "price_increment"]],
        "title": "価格ジャンプ幅（最大）",
        "stat": "Maximum",
        "period": 60
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
        "stat": "Sum",
        "period": 300
      }
    }
  ]
}
```

---

## 6. 動作確認

### 6-1. ローカルでのメトリクス発火テスト

```bash
php artisan tinker
>>> app(\App\Services\Monitoring\MetricRecorder::class)->priceIncrement(1, 1, 100.0, 200.0, 'test')
```

`storage/logs/alerts.log` に1行JSONが追記されるか確認:
```bash
tail -n1 storage/logs/alerts.log | jq .
```

### 6-2. 本番でメトリクス到着を確認

1. EC2 で `tail -f storage/logs/alerts.log` → ログが出ていること
2. CloudWatch Logs の `/auction/app/alerts` に取り込まれていること（数十秒以内）
3. CloudWatch Metrics → `Auction/App` にメトリクスが出現すること（数分以内）

### 6-3. アラームの手動テスト

```bash
aws cloudwatch set-alarm-state \
  --alarm-name "auction-countdown-stalled" \
  --state-value ALARM \
  --state-reason "test" \
  --region ap-northeast-1
```
→ 設定したEmailに通知が届くこと

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

## 付録: 費用感

- **CloudWatch Logs**: 最初の5GB無料、以降 $0.50/GB（東京）
- **CloudWatch Custom Metrics**: $0.30/metric/月（ディメンション別にカウント）
  - 本設定では 12 EventType × 各メトリクス = 約30前後 → **約$10/月**
- **SNS Email**: 無料枠内（月1,000通まで）
- **合計**: おそらく **月$15〜20** 程度
