# メダカオークション API リファレンス

**文書番号**: API-2026-001  
**版数**: 2.0  
**最終更新**: 2026年4月22日

**Base URL**: `https://medaka-auction.jp/api`  
**認証方式**: Bearer Token (Laravel Sanctum)  
**Content-Type**: `application/json`  
**レート制限**: 認証エンドポイント 10回/分、その他 60回/分

---

## 目次

1. [認証 API](#1-認証-api)
2. [2FA 管理 API](#2-2fa-管理-api)
3. [サブスクリプション API](#3-サブスクリプション-api)
4. [LINE 連携 API](#4-line-連携-api)
5. [お知らせ API](#5-お知らせ-api)
6. [チュートリアル API](#6-チュートリアル-api)
7. [配送料計算 API](#7-配送料計算-api)
8. [参加者 API](#8-参加者-api)
9. [出品者 API](#9-出品者-api)
10. [管理者 API](#10-管理者-api)
11. [WebSocket イベント](#11-websocket-イベント)
12. [共通レスポンス形式](#12-共通レスポンス形式)

> 🔒 = 要認証（Sanctum Bearer Token）  
> 👑 = 管理者ロール必須  
> 🏪 = 出品者ロール必須  
> 🎯 = 参加者ロール必須

---

## 1. 認証 API

### `POST /auth/login`
ログイン。2FA 有効時は `two_factor_required: true` を返す。

**レート制限**: 10回/分

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| email | string | ✓ | メールアドレス |
| password | string | ✓ | パスワード |

**レスポンス（通常）**
```json
{
  "data": {
    "token": "1|abc...",
    "user": { "id": 1, "name": "山田太郎", "email": "...", "roles": ["participant"] }
  }
}
```

**レスポンス（2FA 有効時）**
```json
{ "data": { "two_factor_required": true, "user_id": 1 } }
```

---

### `POST /auth/register`
新規ユーザー登録。管理者承認後にパスワード設定メールが届く。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| name | string | ✓ | 氏名 |
| email | string | ✓ | メールアドレス |
| phone | string | ✓ | 電話番号 |
| postal_code | string | ✓ | 郵便番号 |
| prefecture | string | ✓ | 都道府県 |
| city | string | ✓ | 市区町村 |
| address_line1 | string | ✓ | 番地 |
| address_line2 | string | — | 建物名・部屋番号 |

---

### `POST /auth/forgot-password`
パスワードリセットメール送信。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| email | string | ✓ | 登録済みメールアドレス |

---

### `POST /auth/reset-password`
パスワードリセット実行。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| token | string | ✓ | メール内のリセットトークン |
| email | string | ✓ | メールアドレス |
| password | string | ✓ | 新パスワード（8文字以上） |
| password_confirmation | string | ✓ | 新パスワード確認 |

---

### `POST /auth/verify-token`
招待メールのトークン検証。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| token | string | ✓ | メール内のトークン |

---

### `POST /auth/set-password`
初回パスワード設定（管理者承認後）。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| token | string | ✓ | メール内のトークン |
| password | string | ✓ | パスワード（8文字以上） |
| password_confirmation | string | ✓ | パスワード確認 |

---

### `POST /auth/two-factor/verify`
2FA 認証コード検証。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| user_id | integer | ✓ | ユーザー ID |
| code | string | ✓ | 6桁の TOTP コードまたはリカバリーコード |

---

### `GET /auth/google/redirect`
Google OAuth 認証 URL を取得。レスポンス: `{ "data": { "url": "https://accounts.google.com/..." } }`

### `GET /auth/google/callback`
Google OAuth コールバック（ブラウザリダイレクト）。

### `GET /auth/line/callback`
LINE OAuth コールバック（Webhook 用）。

### `POST /auth/logout` 🔒
ログアウト（トークン無効化）。

### `GET /auth/me` 🔒
認証ユーザー情報取得。

---

## 2. 2FA 管理 API 🔒

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/two-factor/status` | 2FA の有効/無効状態を取得 |
| POST | `/two-factor/setup` | 2FA セットアップ（QR コード・シークレット生成） |
| POST | `/two-factor/confirm` | 2FA 有効化確認（`code`: 6桁コード） |
| DELETE | `/two-factor/disable` | 2FA 無効化（`password`: 現在のパスワード） |
| POST | `/two-factor/recovery-codes` | リカバリーコード再生成 |

---

## 3. サブスクリプション API 🔒

年会費プランの管理（Square 決済連携）。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/me/subscription/` | 自分のサブスクリプション情報取得 |
| POST | `/me/subscription/` | サブスクリプション新規登録 |
| PUT | `/me/subscription/card` | 支払いカード更新 |
| DELETE | `/me/subscription/` | サブスクリプションキャンセル |

### `POST /me/subscription/`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| plan_id | integer | ✓ | プラン ID |
| card_nonce | string | ✓ | Square カードトークン（nonce） |

### `PUT /me/subscription/card`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| card_nonce | string | ✓ | 新カードの Square トークン |

---

## 4. LINE 連携 API 🔒

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/line/settings/redirect` | LINE OAuth 認証 URL 取得 |
| GET | `/line/settings/status` | LINE 連携状態取得 |
| DELETE | `/line/settings/unlink` | LINE 連携解除 |
| GET | `/line/settings/notifications` | LINE 通知設定取得 |
| PUT | `/line/settings/notifications` | LINE 通知設定更新 |
| POST | `/line/settings/test` | テスト通知送信 |

---

## 5. お知らせ API 🔒

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/announcements` | お知らせ一覧（未読数付き） |
| GET | `/announcements/{id}` | お知らせ詳細（既読マーク） |

---

## 6. チュートリアル API 🔒

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/tutorials?role={role}` | チュートリアルステップ一覧（role: participant/seller） |
| POST | `/tutorials/complete` | ステップ完了マーク（`step_key`: ステップキー） |

---

## 7. 配送料計算 API 🔒

### `POST /shipping/calculate`
配送料の見積もり計算。

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| items | array | ✓ | 商品リスト（bag_size, quantity 含む） |
| postal_code | string | ✓ | 配送先郵便番号 |

---

## 8. 参加者 API 🔒 🎯

### 8.1 オークション

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/auctions` | オークション一覧（開催中・予定・終了） |
| GET | `/participant/auctions/{id}` | オークション詳細 |
| GET | `/participant/auctions/{id}/live` | ライブ状態取得（レーン・現在商品・参加者数） |
| GET | `/participant/auctions/{id}/items` | 出品商品一覧（フィルタ・ページネーション対応） |
| GET | `/participant/auctions/{id}/my-won-items` | 自分の落札商品（指定オークション内） |

**`GET /participant/auctions` クエリパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| status | string | `scheduled` / `live` / `finished` |
| page | integer | ページ番号 |
| per_page | integer | 件数（デフォルト 15） |

---

### 8.2 商品検索

### `GET /participant/items/search`
全文検索・フィルタ付き商品検索。

| パラメータ | 型 | 説明 |
|---|---|---|
| auction_id | integer | 対象オークション |
| seller_profile_id | integer | 出品者絞り込み |
| species | string | 品種名（部分一致） |
| price_min | integer | 最低価格 |
| price_max | integer | 最高価格 |
| sex | string | `male` / `female` / `pair` / `unknown` |
| sort | string | `price_asc` / `price_desc` / `popular` |
| page | integer | ページ番号 |

---

### 8.3 入札

> ⚠️ 入札系 API（POST/DELETE）は **bid サブスクリプション**が必要です。

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/participant/bids` | 入札 ON/OFF トグル |
| GET | `/participant/bids/my-active` | 自分のアクティブ入札一覧 |

### `POST /participant/bids`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| item_id | integer | ✓ | 商品 ID |

**レスポンス**
```json
{
  "data": {
    "is_active": true,
    "item_id": 42,
    "bidders_count": 15
  }
}
```

---

### 8.4 指値（上限価格）

> ⚠️ 指値設定（POST/DELETE）は **bid サブスクリプション**が必要です。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/bid-limits` | 指値一覧 |
| GET | `/participant/bid-limits/{itemId}` | 特定商品の指値取得 |
| POST | `/participant/bid-limits` | 指値設定 |
| DELETE | `/participant/bid-limits/{itemId}` | 指値削除 |

### `POST /participant/bid-limits`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| item_id | integer | ✓ | 商品 ID |
| limit_price | integer | ✓ | 上限価格（円） |

---

### 8.5 落札商品

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/won-items` | 落札商品一覧 |
| GET | `/participant/won-items/{id}` | 落札商品詳細 |
| PUT | `/participant/auctions/{auctionId}/address` | 配送先住所更新 |
| POST | `/participant/auctions/{auctionId}/calculate-shipping` | 配送料計算 |
| GET | `/participant/auctions/{auctionId}/invoice` | 請求書 PDF ダウンロード |
| GET | `/participant/auctions/{auctionId}/receipt` | 領収書 PDF ダウンロード |

### `PUT /participant/auctions/{auctionId}/address`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| shipping_name | string | ✓ | 受取人氏名 |
| shipping_phone | string | ✓ | 受取人電話番号 |
| shipping_postal_code | string | ✓ | 郵便番号 |
| shipping_prefecture | string | ✓ | 都道府県 |
| shipping_city | string | ✓ | 市区町村 |
| shipping_address_line1 | string | ✓ | 番地 |
| shipping_address_line2 | string | — | 建物名・部屋番号 |

---

### 8.6 お気に入り

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/favorites` | お気に入り一覧 |
| POST | `/participant/favorites/toggle` | お気に入り切替（`item_id`） |
| POST | `/participant/favorites/check` | 複数商品のお気に入り状態一括確認（`item_ids`: 配列） |

---

### 8.7 評価

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/reviews/received` | 受けた評価一覧 |
| POST | `/participant/reviews` | 評価投稿 |
| GET | `/participant/reviews/user/{userId}` | ユーザー評価サマリー |

### `POST /participant/reviews`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| won_item_id | integer | ✓ | 落札商品 ID |
| role | string | ✓ | `buyer` / `seller` |
| rating | integer | ✓ | 評価 1〜5 |
| comment | string | — | コメント |

---

### 8.8 AIレコメンド

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/recommendations` | AI おすすめ商品一覧（最大 20件） |

---

### 8.9 検索条件保存

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/saved-searches` | 保存済み検索条件一覧 |
| POST | `/participant/saved-searches` | 検索条件保存（`search_criteria`: オブジェクト） |
| DELETE | `/participant/saved-searches/{id}` | 検索条件削除 |

---

### 8.10 配送追跡

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/tracking/{trackingNumber}` | 配送状況取得 |

---

### 8.11 出品者一覧

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/sellers` | 出品中の出品者一覧 |

---

### 8.12 参加者設定

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/participant/settings` | 設定取得 |
| PUT | `/participant/settings/profile` | プロフィール更新 |
| PUT | `/participant/settings/notifications` | 通知設定更新 |
| POST | `/participant/settings/notifications/test` | テスト通知送信 |
| POST | `/participant/settings/profile/image` | プロフィール画像アップロード |
| DELETE | `/participant/settings/profile/image` | プロフィール画像削除 |
| GET | `/participant/settings/line/redirect` | LINE 連携 OAuth URL |
| GET | `/participant/settings/line/status` | LINE 連携状態 |
| DELETE | `/participant/settings/line/unlink` | LINE 連携解除 |
| GET | `/participant/settings/line/notifications` | LINE 通知設定取得 |
| PUT | `/participant/settings/line/notifications` | LINE 通知設定更新 |

---

## 9. 出品者 API 🔒 🏪

### 9.1 ダッシュボード

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/seller/dashboard` | 出品者ダッシュボード（売上サマリー・最近の出品） |

---

### 9.2 プロフィール管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/seller/profile` | プロフィール取得 |
| PUT | `/seller/profile` | プロフィール更新 |
| PUT | `/seller/profile/bank` | 振込口座情報更新 |
| PUT | `/seller/profile/notifications` | 通知設定更新 |
| PUT | `/seller/profile/display` | 表示設定更新 |
| POST | `/seller/profile/notifications/test` | テスト通知送信 |
| POST | `/seller/profile/image` | プロフィール画像アップロード |
| DELETE | `/seller/profile/image` | プロフィール画像削除 |

### `PUT /seller/profile/bank`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| bank_name | string | ✓ | 銀行名 |
| bank_branch | string | ✓ | 支店名 |
| account_type | string | ✓ | `普通` / `当座` |
| account_number | string | ✓ | 口座番号 |
| account_holder | string | ✓ | 口座名義（カタカナ） |

---

### 9.3 商品管理

> ⚠️ 商品登録・更新・削除は **sell サブスクリプション**が必要です。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/seller/items` | 出品商品一覧 |
| GET | `/seller/items/stats` | 出品商品統計 |
| GET | `/seller/items/auctions` | 出品可能なオークション一覧 |
| GET | `/seller/items/{id}` | 商品詳細 |
| POST | `/seller/items` | 商品登録 |
| PUT | `/seller/items/{id}` | 商品更新 |
| DELETE | `/seller/items/{id}` | 商品削除（draft/registered のみ） |

### `POST /seller/items`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| auction_id | integer | ✓ | 出品先オークション ID |
| species_name | string | ✓ | 品種名 |
| quantity | integer | ✓ | 匹数 |
| start_price | integer | ✓ | 開始価格（円） |
| sex | string | — | `male` / `female` / `pair` / `unknown` |
| inspection_info | string | — | 検品情報 |
| individual_info | string | — | 個体情報 |
| notes | string | — | 備考 |
| parent_fish_info | array | — | 親魚情報 |
| breeding_environment | array | — | 飼育環境情報 |

---

### 9.4 発送管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/seller/shipping` | 発送管理一覧（未発送・発送済み） |
| POST | `/seller/shipping/{id}/ship` | 発送処理 |
| PUT | `/seller/shipping/{id}/tracking` | 追跡番号更新 |

### `POST /seller/shipping/{id}/ship`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| shipping_company | string | ✓ | 配送業者（`yamato` / `sagawa`） |
| tracking_number | string | ✓ | 追跡番号 |

---

### 9.5 精算管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/seller/settlements` | 精算一覧 |
| GET | `/seller/settlements/{auctionId}` | オークション別精算詳細 |
| GET | `/seller/settlements/{auctionId}/payment-notice` | 支払通知書 PDF ダウンロード |

---

## 10. 管理者 API 🔒 👑

### 10.1 ダッシュボード・レポート

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/dashboard` | 管理ダッシュボード |
| GET | `/admin/dashboard/sales-summary` | 売上サマリー |
| GET | `/admin/reports/weekly` | 週次レポート取得 |
| GET | `/admin/reports/monthly` | 月次レポート取得 |
| POST | `/admin/reports/generate` | レポート手動生成（`type`: `weekly`/`monthly`） |

---

### 10.2 ユーザー管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/users` | ユーザー一覧（検索・ページネーション） |
| POST | `/admin/users` | ユーザー作成 |
| GET | `/admin/users/{id}` | ユーザー詳細 |
| PUT | `/admin/users/{id}` | ユーザー情報更新（承認/拒否含む） |
| DELETE | `/admin/users/{id}` | ユーザー削除（ソフトデリート） |
| POST | `/admin/users/{id}/restore` | ユーザー復元 |

---

### 10.3 お知らせ管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/announcements` | お知らせ一覧 |
| POST | `/admin/announcements` | お知らせ作成 |
| GET | `/admin/announcements/{id}` | お知らせ詳細 |
| PUT | `/admin/announcements/{id}` | お知らせ更新 |
| DELETE | `/admin/announcements/{id}` | お知らせ削除 |
| PATCH | `/admin/announcements/{id}/toggle-visibility` | 公開/非公開切替 |
| POST | `/admin/announcements/generate-content` | AI によるお知らせ文章生成 |

---

### 10.4 オークション管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/auctions` | オークション一覧 |
| POST | `/admin/auctions` | オークション作成 |
| GET | `/admin/auctions/{id}` | オークション詳細 |
| PUT | `/admin/auctions/{id}` | オークション更新 |
| DELETE | `/admin/auctions/{id}` | オークション削除 |
| PATCH | `/admin/auctions/{id}/status` | ステータス更新 |
| PATCH | `/admin/auctions/{id}/lane-count` | レーン数変更 |
| GET | `/admin/auctions-item-management` | 商品管理用オークション一覧 |

---

### 10.5 商品管理（管理者）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/auctions/{auctionId}/items` | 商品一覧 |
| POST | `/admin/auctions/{auctionId}/items` | 商品作成 |
| GET | `/admin/auctions/{auctionId}/items/{id}` | 商品詳細 |
| PUT | `/admin/auctions/{auctionId}/items/{id}` | 商品更新 |
| DELETE | `/admin/auctions/{auctionId}/items/{id}` | 商品削除 |
| PATCH | `/admin/auctions/{auctionId}/items/{id}/status` | 商品ステータス更新 |
| PATCH | `/admin/auctions/{auctionId}/items/bulk-status` | 商品ステータス一括更新 |
| GET | `/admin/auctions/{auctionId}/items/template` | CSV テンプレートダウンロード |
| POST | `/admin/auctions/{auctionId}/items/import` | CSV インポート |
| GET | `/admin/sellers/list` | 出品者一覧（商品登録用） |

---

### 10.6 メディア管理

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/admin/auctions/{auctionId}/items/media/bulk-upload` | メディア一括アップロード |
| POST | `/admin/auctions/{auctionId}/items/{id}/media` | メディアアップロード |
| DELETE | `/admin/auctions/{auctionId}/items/{id}/media/{mediaId}` | メディア削除 |
| PUT | `/admin/auctions/{auctionId}/items/{id}/media/reorder` | メディア並び替え |
| PATCH | `/admin/auctions/{auctionId}/items/{id}/media/{mediaId}/thumbnail` | サムネイル設定 |

---

### 10.7 レーン管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/auctions/{auctionId}/lanes` | レーン一覧 |
| POST | `/admin/auctions/{auctionId}/lanes/create` | レーン追加 |
| PUT | `/admin/auctions/{auctionId}/lanes/{laneId}` | レーン更新 |
| DELETE | `/admin/auctions/{auctionId}/lanes/{laneId}` | レーン削除 |
| POST | `/admin/auctions/{auctionId}/lanes/{laneId}/items` | レーンに商品割当 |
| DELETE | `/admin/auctions/{auctionId}/lanes/{laneId}/items/{itemId}` | レーンから商品除外 |
| PUT | `/admin/auctions/{auctionId}/lanes/{laneId}/items/reorder` | レーン内商品並び替え |
| POST | `/admin/auctions/{auctionId}/lanes/auto-assign` | 自動レーン割当 |
| POST | `/admin/auctions/{auctionId}/lanes/bulk-unassign` | 一括割当解除 |

---

### 10.8 出品者順序管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/auctions/{auctionId}/seller-order/` | 出品者順序取得 |
| POST | `/admin/auctions/{auctionId}/seller-order/randomize` | 順序ランダム設定 |
| PUT | `/admin/auctions/{auctionId}/seller-order/reorder` | 出品者順序変更 |
| PUT | `/admin/auctions/{auctionId}/seller-order/{sellerProfileId}/items/reorder` | 出品者内商品順序変更 |

---

### 10.9 ライブ管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/live-auctions` | ライブ中オークション一覧 |
| GET | `/admin/auctions/{auctionId}/live` | ライブ詳細（レーン・現在商品） |
| POST | `/admin/auctions/{auctionId}/live/start` | ライブ開始 |
| POST | `/admin/auctions/{auctionId}/live/pause` | 一時停止 |
| POST | `/admin/auctions/{auctionId}/live/resume` | 再開 |
| POST | `/admin/auctions/{auctionId}/live/finish` | 終了 |
| POST | `/admin/lanes/{laneId}/next-item` | 次の商品へ進める |
| PATCH | `/admin/items/{itemId}/price` | 価格手動調整 |
| GET | `/admin/auctions/{auctionId}/countdown-status` | カウントダウン状態確認 |
| GET | `/admin/auctions/{auctionId}/entrance-status` | 入場状態確認 |
| POST | `/admin/auctions/{auctionId}/entrance/open` | 入場開放 |
| POST | `/admin/auctions/{auctionId}/entrance/close` | 入場締め切り |

### `PATCH /admin/items/{itemId}/price`

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| price | integer | ✓ | 新しい価格（円） |
| reason | string | — | 価格変更理由 |

---

### 10.10 落札商品管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/won-items-auctions` | 落札管理用オークション一覧 |
| GET | `/admin/auctions/{auctionId}/won-items` | オークション別落札一覧 |
| GET | `/admin/won-items/{id}` | 落札商品詳細 |
| POST | `/admin/won-items/{id}/confirm-payment` | 入金確認 |
| POST | `/admin/won-items/{id}/ship` | 発送処理 |
| POST | `/admin/won-items/{id}/complete` | 取引完了 |
| PATCH | `/admin/won-items/{id}/notes` | 備考更新 |
| POST | `/admin/auctions/{auctionId}/winners/{winnerId}/calculate-shipping` | 配送料計算 |

---

### 10.11 帳票管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/documents/invoices` | 請求書一覧 |
| GET | `/admin/documents/payment-notices` | 支払通知書一覧 |
| GET | `/admin/documents/delivery-notes` | 納品書一覧 |
| GET | `/admin/auctions/{auctionId}/winners/{winnerId}/invoice` | 請求書 PDF |
| GET | `/admin/auctions/{auctionId}/winners/{winnerId}/delivery-note` | 納品書 PDF |
| GET | `/admin/auctions/{auctionId}/sellers/{sellerId}/payment-notice` | 支払通知書 PDF |

---

### 10.12 配送マスタ管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/shipping-master` | 配送料マスタ一覧 |
| PUT | `/admin/shipping-master/rates` | 配送料更新 |
| PUT | `/admin/shipping-master/packing-materials` | 梱包資材費更新 |

---

### 10.13 精算管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/settlements` | 精算一覧 |
| GET | `/admin/settlements/{id}` | 精算詳細 |
| PATCH | `/admin/settlements/{id}` | 精算情報更新 |
| POST | `/admin/settlements/{id}/mark-paid` | 支払済みマーク |
| POST | `/admin/settlements/{id}/recalculate` | 精算再計算 |

---

### 10.14 AI 機能

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/ai/dashboard` | AI 分析ダッシュボード |
| POST | `/admin/ai/image-analysis/{itemId}` | 商品画像 AI 解析（体型・色彩・模様・品質スコア） |
| POST | `/admin/ai/image-analysis/batch/{auctionId}` | バッチ画像解析 |
| GET | `/admin/ai/image-analysis/{itemId}/results` | 解析結果取得 |
| POST | `/admin/ai/price-prediction/{itemId}` | 価格予測（予測価格・信頼度・根拠） |
| GET | `/admin/ai/market-trends` | 市場動向分析 |
| POST | `/admin/ai/fraud-detection/{auctionId}` | 不正入札検知実行 |
| GET | `/admin/ai/fraud-alerts` | 不正アラート一覧 |
| PATCH | `/admin/ai/fraud-alerts/{id}` | アラート解決処理 |
| POST | `/admin/ai/recommendations/{userId}` | ユーザー向けレコメンド生成 |
| POST | `/admin/ai/nlp/extract` | NLP 商品情報自動抽出（`text`: 入力テキスト） |
| POST | `/admin/ai/nlp/classify` | カテゴリ自動分類（`text`: 商品説明） |

---

### 10.15 血統証明書管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/pedigree/{itemId}` | 血統証明書取得 |
| POST | `/admin/pedigree/` | 血統証明書作成 |
| POST | `/admin/pedigree/{id}/issue` | 証明書発行（証明書番号付与） |
| GET | `/admin/pedigree/{id}/download` | 証明書 PDF ダウンロード |

---

### 10.16 エスクロー管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/escrow/` | エスクロー取引一覧 |
| POST | `/admin/escrow/{id}/confirm-payment` | 入金確認（escrow に移行） |
| POST | `/admin/escrow/{id}/release` | 出品者への資金リリース |
| POST | `/admin/escrow/{id}/refund` | 買受者への返金 |
| POST | `/admin/escrow/{id}/dispute` | 紛争開始（`reason`: 理由） |

---

### 10.17 プラン管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/plans` | プラン一覧 |
| POST | `/admin/plans` | プラン作成 |
| GET | `/admin/plans/{id}` | プラン詳細 |
| PUT | `/admin/plans/{id}` | プラン更新 |
| DELETE | `/admin/plans/{id}` | プラン削除（ソフトデリート） |

---

### 10.18 サブスクリプション管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/subscriptions` | サブスクリプション一覧 |
| GET | `/admin/subscriptions/{id}` | サブスクリプション詳細 |
| POST | `/admin/subscriptions/{id}/cancel` | キャンセル処理 |
| POST | `/admin/subscriptions/{id}/retry` | 支払い再試行 |

---

### 10.19 決済管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/payments` | 決済履歴一覧 |
| GET | `/admin/payments/{id}` | 決済詳細 |
| POST | `/admin/payments/{id}/refund` | 返金処理（`amount`: 返金額） |

---

### 10.20 システム設定

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/settings` | システム設定一覧 |
| GET | `/admin/settings/defaults` | オークションデフォルト設定取得 |
| GET | `/admin/settings/{category}` | カテゴリ別設定取得 |
| PUT | `/admin/settings` | システム設定更新 |
| GET | `/admin/settings/shipping/rates` | 配送料設定取得 |
| PUT | `/admin/settings/shipping/rates` | 配送料設定更新 |

---

### 10.21 インフラスケーリング

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/scaling/status` | Auto Scaling 状態確認 |
| POST | `/admin/scaling/scale-up` | スケールアップ実行 |
| POST | `/admin/scaling/scale-down` | スケールダウン実行 |
| POST | `/admin/scaling/release-lock` | スケーリングロック解除 |

---

## 11. WebSocket イベント

**接続方式**: Laravel Reverb (WebSocket)  
**チャンネル**: `auction.{auctionId}.live`

### ライブオークションイベント

| イベント名 | データ | 説明 |
|---|---|---|
| `.price.updated` | `{ lane_id, price, bidders_count }` | 価格更新（入札者が増加） |
| `.bidder.updated` | `{ lane_id, bidders_count, is_active }` | 入札者数変更 |
| `.lane.changed` | `{ lane_id, item }` | レーンの現在商品変更 |
| `.item.sold` | `{ lane_id, item_id, winner_id, price }` | 落札確定 |
| `.item.unsold` | `{ lane_id, item_id }` | 流札 |
| `.countdown.tick` | `{ lane_id, seconds, phase }` | カウントダウン（`phase`: `normal`/`warning`/`final`） |
| `.bid.limit.reached` | `{ lane_id, user_id, item_id }` | 指値到達（該当ユーザーのみ受信） |
| `.auction.status` | `{ status }` | オークションステータス変更 |
| `.entrance.opened` | `{ auction_id }` | 入場開放 |
| `.entrance.closed` | `{ auction_id }` | 入場締め切り |

**プライベートチャンネル**: `private-user.{userId}`  

| イベント名 | 説明 |
|---|---|
| `.won.item` | 自分の落札通知 |
| `.bid.limit.triggered` | 自分の指値トリガー通知 |

---

## 12. 共通レスポンス形式

### 成功レスポンス

```json
{
  "data": { ... },
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 73
  }
}
```

### エラーレスポンス

| HTTP ステータス | 意味 |
|---|---|
| 400 | リクエスト不正 |
| 401 | 未認証（トークンなし・期限切れ） |
| 403 | 権限不足（ロール不一致・サブスクリプション未加入） |
| 404 | リソース不存在 |
| 422 | バリデーションエラー |
| 429 | レート制限超過 |
| 500 | サーバーエラー |

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["メールアドレスは必須です。"],
    "price": ["価格は整数で入力してください。"]
  }
}
```

### ページネーション

`page` / `per_page` クエリパラメータでページを指定。  
レスポンスの `meta` にページ情報が含まれます。

### 認証ヘッダー

```http
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
```
