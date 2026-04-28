# LINE 連携・通知 仕様書

**文書番号**: FEAT-LINE-2026-001
**版数**: 1.0
**作成日**: 2026年4月28日
**対象システム**: メダカライブオークション

---

## 目次

1. [概要](#1-概要)
2. [構成要素](#2-構成要素)
3. [LINE ログイン (OAuth)](#3-line-ログイン-oauth)
4. [LINE 通知配信](#4-line-通知配信)
5. [API エンドポイント](#5-api-エンドポイント)
6. [環境変数](#6-環境変数)
7. [テスト](#7-テスト)
8. [運用上の注意点](#8-運用上の注意点)

---

## 1. 概要

LINE 連携機能は 2 系統で構成されます。

1. **LINE ログイン (OAuth)**: ユーザーが自分の LINE アカウントを Auction アカウントに紐付け
2. **LINE 通知配信**: 落札 / 入金催促 / 発送など 11 種類のイベントを LINE Messaging API で配信

両系統は LINE Developers コンソール上では別チャネル（Login / Messaging API）として管理し、Laravel 側では `LineService` が両方を統合して扱います。

---

## 2. 構成要素

### 2.1 関連ファイル

| 種別 | パス |
|---|---|
| Service (LINE API 統合) | [app/Services/LineService.php](../../../app/Services/LineService.php) |
| Service (Flex 構築) | [app/Services/LineFlexBuilder.php](../../../app/Services/LineFlexBuilder.php) |
| Service (通知統合) | [app/Services/NotificationService.php](../../../app/Services/NotificationService.php) |
| Controller (OAuth) | [app/Http/Controllers/Auth/LineAuthController.php](../../../app/Http/Controllers/Auth/LineAuthController.php) |
| Controller (設定) | [app/Http/Controllers/Participant/LineSettingsController.php](../../../app/Http/Controllers/Participant/LineSettingsController.php) |
| Action (紐付け) | [app/Actions/Line/LinkLineAccountAction.php](../../../app/Actions/Line/LinkLineAccountAction.php) |
| Job (非同期送信) | [app/Jobs/SendLineNotificationJob.php](../../../app/Jobs/SendLineNotificationJob.php) |
| Model (連携アカウント) | [app/Models/LineAccount.php](../../../app/Models/LineAccount.php) |
| Model (通知設定) | [app/Models/LineNotificationSetting.php](../../../app/Models/LineNotificationSetting.php) |
| Model (送信ログ) | [app/Models/LineNotificationLog.php](../../../app/Models/LineNotificationLog.php) |
| Migration | [database/migrations/2026_02_19_213000_create_line_tables.php](../../../database/migrations/2026_02_19_213000_create_line_tables.php) |

### 2.2 データモデル

#### line_accounts

| カラム | 型 | 説明 |
|---|---|---|
| `user_id` | FK・unique | 紐付けユーザー（1 ユーザー = 1 LINE） |
| `line_user_id` | string(64), unique | LINE 側のユーザー ID |
| `display_name` | string(255) | LINE 表示名 |
| `picture_url` | string(512) | プロフィール画像 URL |
| `is_active` | boolean | 連携有効フラグ（unlink で false） |
| `linked_at` | timestamp | 紐付け日時 |

#### line_notification_settings

| カラム | 型 | 説明 |
|---|---|---|
| `user_id` | FK | ユーザー |
| `notification_type` | string(64) | 通知種別キー |
| `is_enabled` | boolean | ON/OFF（**デフォルト ON**: レコードがなければ enabled 扱い） |

unique: `(user_id, notification_type)`

#### line_notification_logs

| カラム | 型 | 説明 |
|---|---|---|
| `user_id` | FK | 宛先ユーザー |
| `notification_type` | string(64) | 通知種別 |
| `line_user_id` | string(64) | LINE ユーザー ID |
| `message_payload` | json | 送信メッセージ本体 |
| `status` | string(16) | `sent` / `failed` |
| `error_message` | text, nullable | エラー内容 |
| `sent_at` | timestamp | 送信日時 |

---

## 3. LINE ログイン (OAuth)

### 3.1 認証フロー

```
[1] ユーザーが「LINE連携」ボタンをクリック
      ↓
[2] /api/line/settings/redirect → LineAuthController::redirect()
    - state パラメータに user_id を base64 で埋め込み
    - state を Cache に 10 分保存（セッション非依存対応）
    - LINE 認可画面にリダイレクト
      ↓
[3] LINE 認可画面でユーザーが許可
      ↓
[4] /api/auth/line/callback → LineAuthController::callback()
    - state から user_id・return_to を復元
    - キャッシュ取得失敗時は セッション認証にフォールバック
    - code → AccessToken → Profile を 3 段階取得
    - LinkLineAccountAction::execute() で DB 保存
      ↓
[5] return_to にリダイレクト（クエリ ?line=success）
```

### 3.2 紐付けロジック

`LinkLineAccountAction::execute()`:
- `LineAccount::updateOrCreate(['user_id' => $userId], ['line_user_id' => ..., 'is_active' => true, 'linked_at' => now()])`
- 1 ユーザーに対して 1 LINE アカウントのみ（FK unique 制約）
- 既存連携が `is_active=false` でも `updateOrCreate` で再有効化

### 3.3 連携解除 (unlink)

- `is_active = false` に更新（**物理削除しない**）
- 履歴保持により再連携時に過去の通知ログが残る
- `LineService::notify()` は `is_active=true` でないと送信しない

### 3.4 戻り先のホワイトリスト

セキュリティのため、`return_to` パラメータは以下のホワイトリストに限定:
- `/participant/settings`
- `/seller/profile`

---

## 4. LINE 通知配信

### 4.1 通知種別マトリクス

| # | 種別 (notification_type) | 対象 | トリガー | Flex メソッド | 設定キー |
|---|---|---|---|---|---|
| 1 | `won_item` | 落札者 | WonItem 作成時 | `wonItem()` | `line_won_item` |
| 2 | `payment_reminder` | 落札者 | `SendPaymentReminderJob` (24h/1h 前) | `paymentReminder()` | `line_payment_reminder` |
| 3 | `shipping_completed` | 落札者 | WonItem 発送完了時 | `shippingCompleted()` | `line_shipping` |
| 4 | `bid_limit_reached` | 落札者 | 指値到達時 | `bidLimitReached()` | `line_bid_limit` |
| 5 | `auction_start` | 落札者・出品者 | オークション開始時 | `auctionStart()` / `sellerAuctionStart()` | `line_auction_start` |
| 6 | `new_auction` | 落札者・出品者 | 新規オークション登録時 | `newAuction()` | `line_new_auction` |
| 7 | `favorite_approaching` | 落札者 | お気に入り商品の出番接近時 | `favoriteApproaching()` | `line_favorite` |
| 8 | `payment_received` | 出品者 | 入金確認時 | `sellerPaymentReceived()` | （Mail のみ） |
| 9 | `item_sold` | 出品者 | WonItem 作成時 | `itemSold()` | （Mail のみ） |
| 10 | `shipping_fee_finalized` | 落札者 | 送料確定時 | （テキストのみ） | （未設定キー） |
| 11 | `invoice_ready` | 落札者 | オークション終了時 | `invoiceReady()` | `line_invoice` |
| (補) | `auction_preview` | 落札者・出品者 | オークション前日 | `auctionStart()` 流用 | `line_auction_preview` |

### 4.2 送信フロー

```
イベント発火
  ↓
NotificationService::send*Notification()
  ├─→ Mail::to($user)->queue($mailable)         [メール非同期]
  └─→ SendLineNotificationJob::dispatch(...)
        ↓ Redis Queue
        ↓
        SendLineNotificationJob::handle()
        └─→ LineService::notify($userId, $type, $text, $flexContent)
              [1] LineAccount 確認（連携あり + is_active=true）
              [2] LineNotificationSetting::isEnabled($userId, $type)
                  - レコードなし → enabled 扱い (デフォルト ON)
              [3] pushFlex() / pushText() を実行
              [4] LineNotificationLog にステータス記録
```

### 4.3 LineService の主要メソッド

| メソッド | 用途 |
|---|---|
| `getLoginUrl(state)` | LINE OAuth URL を生成 |
| `getAccessToken(code)` | 認可コード → アクセストークン |
| `getProfile(token)` | LINE プロフィール取得 |
| `pushMessage(lineUserId, messages)` | Push API（汎用） |
| `pushText(lineUserId, text)` | テキスト送信 |
| `pushFlex(lineUserId, altText, flexContent)` | Flex Message 送信 |
| `notify(userId, type, text, flexContent)` | 通知設定 + 連携確認 → 送信 → ログ記録 |

### 4.4 Flex Message テンプレート

`LineFlexBuilder` が 12 種類の Flex Bubble を提供 ([app/Services/LineFlexBuilder.php](../../../app/Services/LineFlexBuilder.php)):

| メソッド | 用途 | アクセントカラー |
|---|---|---|
| `wonItem()` | 落札通知 | 緑 (`#10B981`) |
| `paymentConfirmed()` | 入金確認 | 緑 |
| `shippingCompleted()` | 発送完了 | 紺 (`#1E3A5F`) |
| `bidLimitReached()` | 指値到達 | 黄 (`#F59E0B`) |
| `auctionStart()` | オークション開始（落札者向け） | 赤 (`#EF4444`) |
| `newAuction()` | 新規オークション告知 | 紺 |
| `favoriteApproaching()` | お気に入り順番接近 | 黄 |
| `paymentReminder()` | 入金催促 | 赤 |
| `itemSold()` | 出品商品が落札（出品者向け） | 緑 |
| `sellerPaymentReceived()` | 入金完了・発送依頼（出品者向け） | 緑 |
| `sellerAuctionStart()` | オークション開始（出品者向け） | 紺 |
| `invoiceReady()` | 請求書発行（PDFリンク付き） | 紺 |

#### 共通仕様

- 全テンプレートは Bubble 形式 (`size: mega`)
- Hero 画像は HTTPS のみ（http の場合は省略）
- Footer のリンクボタンは HTTPS URI のみ有効
- 色定数は LineFlexBuilder クラス内の定数で管理

### 4.5 SendLineNotificationJob 設定

```php
public int $tries = 3;        // 3 回までリトライ
public int $backoff = 10;     // 失敗時 10 秒待機
$this->onQueue('default');    // デフォルトキュー
```

リトライ後も失敗した場合は `failed_jobs` テーブルに記録される。

### 4.6 LINE 請求書ダウンロード（署名付き URL）

請求書発行通知 (`invoice_ready`) では、Flex メッセージの「請求書ダウンロード」ボタンに **署名付き URL** を埋め込む。

- ルート: `GET /api/line/invoices/{auctionId}/{winnerId}` (middleware: `signed`)
- 有効期限: **30 日**
- 認証なしでも署名検証で正当性を確認

---

## 5. API エンドポイント

### 5.1 LINE 連携（認証フロー）

| メソッド | パス | 責務 |
|---|---|---|
| GET | `/api/line/settings/redirect` | LINE 認可画面へリダイレクト |
| GET | `/api/auth/line/callback` | コールバック受付・紐付け |
| GET | `/api/line/settings/status` | 連携状態確認 (linked / display_name / picture_url / linked_at) |
| DELETE | `/api/line/settings/unlink` | 連携解除（`is_active = false`） |

### 5.2 通知設定

| メソッド | パス | 責務 |
|---|---|---|
| GET | `/api/line/settings/notifications` | 通知種別ごとの ON/OFF 取得 |
| PUT | `/api/line/settings/notifications` | 通知種別ごとの ON/OFF 更新 |
| POST | `/api/line/settings/test` | テスト送信（DB記録なし、LINE 連携必須） |

#### テスト送信のリクエスト例

```http
POST /api/line/settings/test HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{ "type": "won_item" }
```

### 5.3 LINE 経由の請求書

| メソッド | パス | 認証 |
|---|---|---|
| GET | `/api/line/invoices/{auctionId}/{winnerId}` | signed middleware (有効期限 30 日) |

---

## 6. 環境変数

| 変数 | 用途 |
|---|---|
| `LINE_LOGIN_CHANNEL_ID` | LINE Login 用チャネル ID |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login 用チャネルシークレット |
| `LINE_LOGIN_REDIRECT_URI` | コールバック URI（例: `https://auction.beer-o-clock.jp/api/auth/line/callback`） |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Messaging API のアクセストークン（長期） |

設定先: `config/services.php`

---

## 7. テスト

### 7.1 既存カバレッジ

| ファイル | 件数 | 内容 |
|---|---|---|
| [tests/Unit/Services/LineServiceTest.php](../../../tests/Unit/Services/LineServiceTest.php) | 8+件 | Login URL 生成 / トークン交換 / プロフィール取得 / Push / 通知設定ゲート |
| [tests/Unit/Services/LineFlexBuilderTest.php](../../../tests/Unit/Services/LineFlexBuilderTest.php) | 12+件 | 各 Flex テンプレートの構造確認 |

### 7.2 不足しているテスト（優先度順）

| 観点 | 優先度 | 備考 |
|---|---|---|
| `LineAuthController` の OAuth フロー | **高** | state 検証・キャッシュ復元・フォールバック・ホワイトリスト検証 |
| `LinkLineAccountAction` の DB 更新 | **高** | 新規 / 既存 / 再連携の各ケース |
| `SendLineNotificationJob` のリトライ・failed_jobs | **高** | API 障害時の挙動 |
| `LineSettingsController::test()` のテスト送信 | 中 | LINE 未連携時のエラー |
| `NotificationService` から LINE への統合フロー | 中 | Mail と LINE が並行して送信されることの確認 |
| 署名付き URL の有効期限検証 | 中 | 30 日後に 403 になること |
| 通知設定 OFF 時のスキップ | 高 | LineNotificationSetting の `is_enabled=false` で送信されない |

### 7.3 関連 E2E

[テスト仕様書・報告書 §4.3 LINE 通知連携](../../testing/テスト仕様書・報告書.md#line-通知連携) / [§10.11 NTF-09 LINE連携未設定ユーザー](../../testing/テスト仕様書・報告書.md#ntf-09line連携未設定ユーザー)

---

## 8. 運用上の注意点

1. **デフォルト ON**: `LineNotificationSetting` レコードがない場合は通知が送信される。OFF にしたい場合は明示的にレコードを作成
2. **チャネル分離**: LINE Login と Messaging API は LINE Developers 上で別チャネル。両方の設定値が必要
3. **Push API の制限**: LINE Messaging API は無料プランで月間 200 通の Push 制限あり。ピーク時は配信量を監視
4. **連携解除は論理削除**: `unlink` は `is_active=false` のみ。LINE 側で連携解除されてもこちらの DB は変わらないため、配信失敗が連続したら自動で `is_active=false` にする運用も検討
5. **state の Cache 期限**: 10 分以内にコールバックが返らないと state 検証失敗。ユーザーが認可画面で長時間放置するとログインフローが破綻する
6. **Flex Message のサイズ制限**: 1 通の Push に含められる Flex は 12 件まで・サイズ 50KB 以下。商品リスト系は分割送信を検討
7. **テスト送信は冪等**: `/api/line/settings/test` は DB 記録なし。本番 LINE Bot が動いていれば実際にユーザーへ届くため、ステージングと本番でチャネルを分ける必要あり

---

## 関連ドキュメント

- [テスト仕様書・報告書 §4.3 LINE 通知連携](../../testing/テスト仕様書・報告書.md#43-外部-api-連携テスト)
- [テスト仕様書・報告書 §10.11 通知系検証 (NTF-XX)](../../testing/テスト仕様書・報告書.md#1011-通知系検証ntf-xx)
- [APIリファレンス](../../api/APIリファレンス.md)
- [ユーザーマニュアル](../../manuals/ユーザーマニュアル.md)
