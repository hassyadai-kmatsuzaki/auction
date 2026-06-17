# AWS WAF / DDoS対策 設定手順書

**文書番号**: WAF-2026-001  
**事業者**: 株式会社BeerO'Clock  
**作成者**: 代表取締役 松崎 航平  
**承認者**: 代表取締役 松崎 航平  
**版数**: 1.1  
**最終更新**: 2026年6月10日  
**対象システム**: 日本メダカオンライン市場 本番環境

---

## 1. AWS WAF 設定

### 1.1 Web ACL の作成

```bash
# Web ACL を作成
aws wafv2 create-web-acl \
  --name "medaka-auction-waf" \
  --scope REGIONAL \
  --default-action '{"Allow":{}}' \
  --visibility-config '{
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "MedakaAuctionWAF"
  }' \
  --region ap-northeast-1
```

### 1.2 マネージドルールの追加

以下のAWSマネージドルールを適用する:

| ルールグループ | 目的 |
|---|---|
| AWSManagedRulesCommonRuleSet | SQLi, XSS, OS command injection 等の一般的な攻撃防御 |
| AWSManagedRulesSQLiRuleSet | SQLインジェクション特化防御 |
| AWSManagedRulesKnownBadInputsRuleSet | 既知の不正入力パターン防御 |
| AWSManagedRulesAmazonIpReputationList | 悪質なIPアドレスからのアクセスブロック |
| AWSManagedRulesBotControlRuleSet | Bot制御 |

### 1.3 カスタムルール

#### レート制限ルール（DDoS軽減）
```json
{
  "Name": "RateLimitPerIP",
  "Priority": 1,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 2000,
      "AggregateKeyType": "IP"
    }
  },
  "Action": { "Block": {} },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "RateLimitPerIP"
  }
}
```

#### 地理的ブロック（必要に応じて）
```json
{
  "Name": "GeoBlockRule",
  "Priority": 2,
  "Statement": {
    "NotStatement": {
      "Statement": {
        "GeoMatchStatement": {
          "CountryCodes": ["JP"]
        }
      }
    }
  },
  "Action": { "Block": {} }
}
```

### 1.4 ALBとの関連付け

```bash
aws wafv2 associate-web-acl \
  --web-acl-arn "arn:aws:wafv2:ap-northeast-1:ACCOUNT_ID:regional/webacl/medaka-auction-waf/ID" \
  --resource-arn "arn:aws:elasticloadbalancing:ap-northeast-1:ACCOUNT_ID:loadbalancer/app/medaka-alb/ID"
```

---

## 2. AWS Shield（DDoS対策）

### 2.1 Shield Standard（無料・自動適用）
- AWS Shield Standard は全てのAWSリソースに自動適用済み
- L3/L4レベルのDDoS攻撃を自動検知・緩和

### 2.2 Shield Advanced（推奨：本番運用時）

```bash
# Shield Advanced のサブスクリプション有効化
aws shield create-subscription

# ALB を保護リソースに追加
aws shield create-protection \
  --name "medaka-alb-protection" \
  --resource-arn "arn:aws:elasticloadbalancing:ap-northeast-1:ACCOUNT_ID:loadbalancer/app/medaka-alb/ID"
```

Shield Advanced の利点:
- L7 DDoS攻撃の自動検知・緩和
- AWS DDoS Response Team (DRT) による24/7サポート
- 攻撃時のコスト保護（スケーリングコストの返金）
- リアルタイム攻撃可視化

---

## 3. CloudWatch アラーム設定

### WAF ブロック数監視
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "WAF-HighBlockRate" \
  --metric-name BlockedRequests \
  --namespace AWS/WAFV2 \
  --statistic Sum \
  --period 300 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:medaka-alerts"
```

---

## 4. アプリケーションレベルの防御（実装済み）

| 対策 | 実装場所 | 説明 |
|---|---|---|
| レート制限 | `RateLimitByIp` ミドルウェア | 認証API: 10req/min, 一般API: 60req/min |
| 監査ログ | `AuditLog` ミドルウェア | 全書き込み操作をログ記録 |
| CSRF保護 | Laravel標準 | APIはBearer Token認証で代替 |
| SQLインジェクション防御 | Eloquent ORM | パラメータバインディング |
| XSS防御 | React (JSX自動エスケープ) | フロントエンド側で自動対処 |
| 入力バリデーション | FormRequest クラス | 全APIで入力値を検証 |

---

## 5. 定期メンテナンス

| 項目 | 頻度 | 担当 |
|---|---|---|
| WAFログレビュー | 週1回 | 運用担当 |
| ルール更新確認 | 月1回 | セキュリティ担当 |
| 脆弱性診断 | 年2回 | 外部ベンダー |
| Shield攻撃レポート確認 | 月1回 | 運用担当 |

---

## 改訂履歴

| 版数 | 日付 | 改訂内容 | 作成・承認 |
|---|---|---|---|
| 1.0 | 2026-04-22 | 初版作成 | 株式会社BeerO'Clock 松崎 航平 |
| 1.1 | 2026-06-10 | システム名称統一 | 株式会社BeerO'Clock 松崎 航平 |
