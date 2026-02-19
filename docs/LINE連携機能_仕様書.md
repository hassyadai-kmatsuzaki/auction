# LINE連携機能 仕様書

> 作成日: 2026-02-19  
> 対象ユーザー: 出品者（seller）・参加者（participant）

---

## 目次

1. [機能概要](#1-機能概要)
2. [通知の種類](#2-通知の種類)
3. [LINE連携フロー](#3-line連携フロー)
4. [LINE Messaging API の設計](#4-line-messaging-api-の設計)
5. [データベース設計](#5-データベース設計)
6. [API設計](#6-api設計)
7. [画面設計](#7-画面設計)
8. [バックエンド実装方針](#8-バックエンド実装方針)
9. [フロントエンド実装方針](#9-フロントエンド実装方針)
10. [セキュリティ・注意事項](#10-セキュリティ注意事項)
11. [実装ロードマップ](#11-実装ロードマップ)

---

## 1. 機能概要

ユーザー（出品者・参加者）が自分のLINEアカウントと連携すると、オークションに関する重要な通知をLINEで受け取れるようになる機能。

### 主なメリット

| ユーザー | メリット |
|---------|---------|
| **参加者** | 落札通知・オークション開始通知・入金催促をLINEで受け取れる |
| **出品者** | 出品生体の落札通知・発送催促・入金確認通知をLINEで受け取れる |
| **管理者** | メール未読率の問題を解消。LINEの開封率は約90% |

---

## 2. 通知の種類

### 参加者（buyer）向け通知

| # | 通知名 | タイミング | 内容例 |
|---|-------|-----------|-------|
| 1 | **オークション開始通知** | オークションが live になった時 | 「第17回 大感謝祭オークションが開始されました！今すぐ参加する→」 |
| 2 | **落札通知** | 商品を落札した時 | 「🎉 幹之メダカ（5匹）を ¥3,500/匹 で落札しました！合計: ¥19,250」 |
| 3 | **入金催促** | 入金期限の24時間前/1時間前 | 「⚠️ 入金期限が近づいています。期限: 2/20 14:00」 |
| 4 | **発送完了通知** | 出品者が発送した時 | 「📦 幹之メダカの発送が完了しました。追跡番号: XXXX」 |
| 5 | **オークション予告** | 開催日の前日 | 「明日2/19 14:00〜 第17回オークションが開催されます」 |
| 6 | **指値発動通知** | 上限価格に達して自動入札OFFになった時 | 「幹之メダカの上限 ¥50,000 に達したため自動的に入札オフになりました」 |
| 7 | **新規オークション通知** | 新しいオークションが scheduled になった時 | 「新しいオークションが追加されました: 第18回 春の特別オークション」 |
| 8 | **お気に入り順番接近通知** | お気に入り登録した生体の出番が5個前になった時 | 「⏰ お気に入りの幹之メダカの出番まであと5つです！準備してください」 |

### 出品者（seller）向け通知

| # | 通知名 | タイミング | 内容例 |
|---|-------|-----------|-------|
| 1 | **落札通知** | 出品した商品が落札された時 | 「🎉 幹之メダカ（5匹）が ¥3,500/匹 で落札されました！」 |
| 2 | **入金確認通知** | 落札者の入金が確認された時 | 「💰 幹之メダカの入金が確認されました。発送をお願いします。」 |
| 3 | **発送催促** | 発送期限の24時間前/1時間前 | 「⚠️ 発送期限が近づいています。期限: 2/22 14:00」 |
| 4 | **売上精算通知** | 精算が完了した時 | 「💰 第17回オークションの精算が完了しました。振込額: ¥XXX,XXX」 |
| 5 | **出品承認通知** | 出品した生体が管理者に承認された時 | 「✅ 幹之メダカの出品が承認されました」 |
| 6 | **オークション開始通知** | 出品した生体のオークションが始まった時 | 「出品した幹之メダカのオークションが開始されました」 |

---

## 3. LINE連携フロー

### 3-1. 連携の流れ

```
ユーザー
  │
  ├── 設定画面で「LINEと連携する」ボタンをクリック
  │
  ├── LINE公式アカウントの友だち追加画面にリダイレクト
  │     （LINE Login または QRコード）
  │
  ├── LINEで友だち追加 + 認証許可
  │
  ├── コールバックURLでアプリに戻る
  │     （LINE user ID を取得して DB に保存）
  │
  └── 連携完了！通知がLINEに届くようになる
```

### 3-2. 連携方式の選択肢

| 方式 | メリット | デメリット | 推奨 |
|------|---------|----------|------|
| **A: LINE Login（OAuth）** | ユーザーIDを安全に取得。プロフィール情報も取得可能 | LINE Developersの設定が必要 | ✅ 推奨 |
| **B: LINE公式アカウント + Webhook** | 友だち追加で自動連携 | ユーザーの紐付けが必要（連携コード方式） | △ |
| **C: LINE Notify** | 実装が簡単 | 2025年3月末でサービス終了 | ❌ 不可 |

**推奨: 方式A（LINE Login）**

---

## 4. LINE Messaging API の設計

### 4-1. 必要なLINE API

| API | 用途 |
|-----|------|
| **LINE Login** | ユーザー認証・LINE user ID 取得 |
| **Messaging API（Push Message）** | 通知メッセージの送信 |

### 4-2. LINE Developersでの設定

```
LINE Developers Console
├── Provider: メダカオークション
├── Channel 1: LINE Login
│   ├── Channel ID: XXXX
│   ├── Channel Secret: XXXX
│   └── Callback URL: https://medaka-auction.com/api/auth/line/callback
└── Channel 2: Messaging API
    ├── Channel Access Token: XXXX
    └── Bot Basic ID: @medaka-auction
```

### 4-3. メッセージテンプレート例

```json
{
  "to": "U1234567890abcdef...",
  "messages": [
    {
      "type": "flex",
      "altText": "🎉 落札おめでとうございます！",
      "contents": {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "🎉 落札通知",
              "weight": "bold",
              "size": "lg"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "幹之メダカ（フルボディ）", "weight": "bold" },
            { "type": "text", "text": "5匹セット × ¥3,500/匹" },
            { "type": "text", "text": "合計: ¥19,250（税込）", "weight": "bold", "color": "#059669" }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "落札管理を見る",
                "uri": "https://medaka-auction.com/participant/won-items"
              },
              "style": "primary"
            }
          ]
        }
      }
    }
  ]
}
```

---

## 5. データベース設計

### 5-1. 新規テーブル: `line_accounts`

```sql
CREATE TABLE line_accounts (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT UNSIGNED NOT NULL,
    line_user_id  VARCHAR(64) NOT NULL COMMENT 'LINE user ID（U始まりの33文字）',
    display_name  VARCHAR(255) NULL COMMENT 'LINEの表示名',
    picture_url   VARCHAR(512) NULL COMMENT 'LINEのプロフィール画像URL',
    status_message VARCHAR(255) NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE COMMENT '通知を受け取るかどうか',
    linked_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at    TIMESTAMP NULL,
    updated_at    TIMESTAMP NULL,

    UNIQUE KEY uq_user_id (user_id),
    UNIQUE KEY uq_line_user_id (line_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_line_user_id (line_user_id)
);
```

### 5-2. 新規テーブル: `line_notification_settings`

```sql
CREATE TABLE line_notification_settings (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT UNSIGNED NOT NULL,
    notification_type VARCHAR(64) NOT NULL COMMENT '通知タイプ（auction_start, won_item, etc）',
    is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP NULL,
    updated_at        TIMESTAMP NULL,

    UNIQUE KEY uq_user_notification (user_id, notification_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 5-3. 新規テーブル: `line_notification_logs`

```sql
CREATE TABLE line_notification_logs (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT UNSIGNED NOT NULL,
    notification_type VARCHAR(64) NOT NULL,
    line_user_id      VARCHAR(64) NOT NULL,
    message_payload   JSON NULL COMMENT '送信したメッセージのJSON',
    status            ENUM('sent', 'failed', 'skipped') NOT NULL DEFAULT 'sent',
    error_message     TEXT NULL,
    sent_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at        TIMESTAMP NULL,

    INDEX idx_user_id (user_id),
    INDEX idx_sent_at (sent_at)
);
```

---

## 6. API設計

### 6-1. LINE連携

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/auth/line/redirect` | LINE Login 画面にリダイレクト |
| `GET` | `/api/auth/line/callback` | LINE Login コールバック（認証後） |
| `DELETE` | `/api/{role}/settings/line/unlink` | LINE連携解除 |
| `GET` | `/api/{role}/settings/line/status` | 連携状態確認 |

### 6-2. 通知設定

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/{role}/settings/line/notifications` | 通知設定一覧取得 |
| `PUT` | `/api/{role}/settings/line/notifications` | 通知設定の一括更新 |

---

## 7. 画面設計

### 7-1. 設定画面（参加者/出品者共通）

```
┌─────────────────────────────────────┐
│  LINE連携                            │
│  ─────────────────────────────────── │
│                                       │
│  📱 LINEアカウント: 未連携            │
│  [LINEと連携する]                     │
│                                       │
│  連携後:                              │
│  ─────────────────────────────────── │
│  📱 LINEアカウント: 松崎 光平        │
│  連携日: 2026/02/19                   │
│  [連携解除]                           │
│                                       │
│  📩 LINE通知設定                      │
│  ─────────────────────────────────── │
│  オークション開始通知    [ON/OFF]     │
│  落札通知                [ON/OFF]     │
│  入金催促                [ON/OFF]     │
│  発送完了通知            [ON/OFF]     │
│  オークション予告        [ON/OFF]     │
│  指値発動通知            [ON/OFF]     │
│  新規オークション通知    [ON/OFF]     │
└─────────────────────────────────────┘
```

---

## 8. バックエンド実装方針

### ディレクトリ構造

```
app/
├── Services/
│   └── LineService.php               ← LINE API 呼び出し（Push Message等）
│
├── Actions/Line/
│   ├── LinkLineAccountAction.php     ← LINE連携処理
│   ├── UnlinkLineAccountAction.php   ← 連携解除
│   └── SendLineNotificationAction.php ← 通知送信（共通）
│
├── Http/Controllers/
│   ├── Auth/
│   │   └── LineAuthController.php    ← LINE Login OAuth
│   ├── Participant/
│   │   └── LineSettingsController.php ← 通知設定API
│   └── Seller/
│       └── LineSettingsController.php
│
├── Models/
│   ├── LineAccount.php
│   ├── LineNotificationSetting.php
│   └── LineNotificationLog.php
│
├── Jobs/
│   └── SendLineNotificationJob.php   ← 非同期送信
│
└── Notifications/                     ← Laravel Notification 連携
    ├── LineChannel.php               ← カスタム通知チャネル
    └── Messages/
        ├── LineWonItemMessage.php
        ├── LineAuctionStartMessage.php
        ├── LinePaymentReminderMessage.php
        └── LineShippingNotificationMessage.php
```

### LineService.php の設計

```php
class LineService
{
    private string $channelAccessToken;

    public function pushMessage(string $lineUserId, array $messages): bool
    {
        $response = Http::withToken($this->channelAccessToken)
            ->post('https://api.line.me/v2/bot/message/push', [
                'to'       => $lineUserId,
                'messages' => $messages,
            ]);
        return $response->successful();
    }

    public function pushFlexMessage(string $lineUserId, string $altText, array $flexContent): bool
    {
        return $this->pushMessage($lineUserId, [[
            'type'     => 'flex',
            'altText'  => $altText,
            'contents' => $flexContent,
        ]]);
    }

    public function getProfile(string $accessToken): ?array
    {
        $response = Http::withToken($accessToken)
            ->get('https://api.line.me/v2/profile');
        return $response->successful() ? $response->json() : null;
    }
}
```

### 既存 NotificationService との統合

```php
// 既存の NotificationService::sendWonItemNotification() に LINE送信を追加
public function sendWonItemNotification(WonItem $wonItem): void
{
    // メール送信（既存）
    $this->sendMail(...);

    // LINE送信（新規）
    $lineAccount = LineAccount::where('user_id', $wonItem->winner_id)
        ->where('is_active', true)
        ->first();

    if ($lineAccount && $this->isNotificationEnabled($wonItem->winner_id, 'won_item')) {
        SendLineNotificationJob::dispatch(
            $lineAccount->line_user_id,
            'won_item',
            $this->buildWonItemLineMessage($wonItem)
        );
    }
}
```

---

## 9. フロントエンド実装方針

### 追加ファイル

```
resources/ts/
├── api/
│   └── lineApi.ts                    ← LINE API呼び出し
├── features/line-settings/
│   ├── components/
│   │   ├── LineConnectionCard.tsx    ← 連携状態カード
│   │   └── LineNotificationList.tsx  ← 通知ON/OFF一覧
│   └── hooks/
│       └── useLineSettings.ts       ← TanStack Query
```

---

## 10. セキュリティ・注意事項

| 項目 | 対策 |
|------|------|
| **LINE user ID の秘匿** | DBに保存し、APIレスポンスには含めない |
| **CSRF対策** | LINE Login のコールバックで `state` パラメータを検証 |
| **Rate Limit** | LINE Messaging API は月200通まで（無料プラン）。超過時はメールにフォールバック |
| **連携解除** | ユーザーが解除したら `line_accounts.is_active = false` に。LINE上のブロックとは独立 |
| **個人情報** | LINEの表示名・プロフィール画像は任意取得。保存はユーザー同意の上 |

---

## 11. 実装ロードマップ

### Phase 1: 基盤構築（LINE Login + DB）

- [ ] LINE Developers Console でチャネル作成
- [ ] `.env` に LINE の認証情報を追加
- [ ] マイグレーション（3テーブル）
- [ ] Model（LineAccount, LineNotificationSetting, LineNotificationLog）
- [ ] LineAuthController（OAuth リダイレクト + コールバック）
- [ ] LinkLineAccountAction / UnlinkLineAccountAction
- [ ] 設定画面の LINE連携 UI

### Phase 2: 通知送信

- [ ] LineService（Push Message API 呼び出し）
- [ ] SendLineNotificationJob（非同期キュー）
- [ ] 落札通知の LINE 送信
- [ ] オークション開始通知の LINE 送信

### Phase 3: 通知設定 + 全通知種別

- [ ] LineSettingsController（通知ON/OFF API）
- [ ] 設定画面の通知設定 UI
- [ ] 残りの通知種別（入金催促・発送完了・指値発動 等）

### Phase 4: Flex Message テンプレート

- [ ] 落札通知の Flex Message 化（リッチ表示）
- [ ] オークション開始の Flex Message 化
- [ ] 各通知のリンクボタン追加

---

## 補足: 環境変数

```env
# .env に追加
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LINE_LOGIN_REDIRECT_URI=https://medaka-auction.com/api/auth/line/callback

LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=
LINE_MESSAGING_CHANNEL_SECRET=
```

## 補足: Composer パッケージ

```bash
# LINE SDK は公式パッケージを使用
composer require linecorp/line-bot-sdk
```
