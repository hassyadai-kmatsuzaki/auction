# E2E (staging) 環境セットアップ手順

E2E テスト用 staging 環境の初期データを揃えるための運用手順書。
シーダー本体は `database/seeders/E2EStagingSeeder.php`。

## 1. 前提

| 項目 | 値 |
|---|---|
| 対象環境 | staging のみ (`APP_ENV=staging` または `local`) |
| 本番実行 | 不可 (シーダー冒頭で `app()->environment('production')` を確認し、`RuntimeException` を投げる) |
| 管理 | DatabaseSeeder.php からは呼ばない (本番で誤実行するリスクを避けるため) |
| 共通パスワード | `password` (全テストアカウント共通) |

## 2. 実行手順

### 初回投入

```bash
# 1. マイグレーション (shipping_rates / packing_materials / species_types は本マイグレーションで投入される)
php artisan migrate

# 2. 既定のロール (admin / seller / participant) を投入
php artisan db:seed --class=RoleSeeder

# 3. E2E 用シーダーを実行
php artisan db:seed --class=E2EStagingSeeder
```

### 再投入 (冪等)

`E2EStagingSeeder` は同じ状態に揃え直す設計なので、何度でも安全に再実行できる。

```bash
php artisan db:seed --class=E2EStagingSeeder
```

実行時、以下の操作が走る:

- ユーザー: `email` をキーに `updateOrCreate` でアップサート
- SellerProfile: `user_id` をキーに `updateOrCreate`
- Plan / Subscription: `code` / `user_id` をキーに `updateOrCreate`
- Auction: タイトル先頭 `[E2E-STAGING]` のレコード一式 (Lane / Item / WonItem / lane_items / auction_seller_orders / item_media を含む) を **物理削除** してから再生成
- Role: 不足分のみ `firstOrCreate`

## 3. テストアカウント一覧

| 役割 | email | パスワード | 備考 |
|---|---|---|---|
| Admin | `e2e-admin@auction.test` | `password` | 全ロール (admin/seller/participant) 付与 |
| Seller A | `e2e-seller-a@auction.test` | `password` | seller + participant / SellerProfile (銀行口座あり) 付き |
| Seller B | `e2e-seller-b@auction.test` | `password` | seller + participant / SellerProfile (銀行口座あり) 付き |
| Participant X | `e2e-participant-x@auction.test` | `password` | 落札あり・入金前 (PAST-1 #1, PAST-2 #1, PAST-3 #1/#2) |
| Participant Y | `e2e-participant-y@auction.test` | `password` | 入金済み・発送前 (PAST-1 #2) |
| Participant Z | `e2e-participant-z@auction.test` | `password` | 配達完了済み (PAST-1 #3, #4) |

すべてのアカウントは `is_active=true` / `status='approved'` / `email_verified_at=now` で作成。

> **LINE 連携**: E2E Participant は LineAccount に紐付けない。実 LINE 連携テストとデータが衝突するため、検証は別途 LINE 検証用アカウントで行うこと。

## 4. オークション一覧

| Auction | event_date | 状態 | 用途 |
|---|---|---|---|
| `[E2E-STAGING] #PAST-1 3日前 終了済み` | 3 日前 | `finished` | 入金前/入金済発送前/配達完了 の 3 状態を網羅。Lane × 2, Item × 4, WonItem × 4 |
| `[E2E-STAGING] #PAST-2 1日前 終了済み 送料未計算` | 1 日前 | `finished` | `shipping_fee=0` / `shipping_calculated_at=null` の送料未計算ケース |
| `[E2E-STAGING] #PAST-3 12時間前 終了 催促対象` | 12 時間前 | `finished` | `payment_deadline = now()+2h` で催促ジョブの対象になるケース |

## 5. Plan / Subscription

- Plan code: `e2e_staging_full` (allows_bid=true, allows_sell=true, amount=0)
- すべてのテストユーザーに `Subscription::STATUS_ACTIVE` を付与 (current_period_end は 1 年後)

## 6. 冪等性の方針

| 対象 | 戦略 |
|---|---|
| User | `email` で `updateOrCreate` / 万一 `deleted_at` が立っていれば raw update で解除 |
| SellerProfile | `user_id` で `updateOrCreate` |
| Plan | `code` で `updateOrCreate` |
| Subscription | `user_id` (UNIQUE) で `updateOrCreate` |
| Role | `name` で `firstOrCreate` (不足分のみ補完) |
| user_roles | `User::roles()->sync()` で正規化 |
| Auction / Lane / Item / WonItem / lane_items / item_media / auction_seller_orders | タイトル先頭 `[E2E-STAGING]` のレコード一式を `forceDelete` してから再生成 (Auction は SoftDeletes 利用のため `withTrashed()` 経由) |
| ShippingRate / PackingMaterial / SpeciesType | マイグレーションで投入済み想定。空テーブルなら警告のみ出して継続 |

> **注**: `payment_deadline` などの相対時刻は実行ごとに `now()` 基準で再計算されるため、再実行のたびに「12 時間前終了」「2 時間後期限」が滑らかにスライドする (catch-up シーダー)。

## 7. staging 復旧時の手順

データが破損した、または期限が古くなって催促テストにならなくなった場合:

```bash
# 推奨: シーダー再実行のみでよい
php artisan db:seed --class=E2EStagingSeeder

# 状況が悪化していて全テーブルを作り直したい場合
php artisan migrate:fresh
php artisan db:seed --class=RoleSeeder
php artisan db:seed --class=E2EStagingSeeder
```

`migrate:fresh` を使う場合は staging 環境であることを必ず確認すること。
本番で実行すると全データが消失する。

## 8. トラブルシュート

| 症状 | 原因 / 対処 |
|---|---|
| `RuntimeException: E2EStagingSeeder cannot run in production` | `APP_ENV=production` で実行している。staging 用 `.env` を読み込んで再実行。 |
| `species_types` が無いエラー | マイグレーション `2026_04_23_100000_create_species_types_and_extend_shipping_masters.php` が未適用。`php artisan migrate` を先に。 |
| 警告: `shipping_rates テーブルが空です` | マイグレーション `2026_04_01_000001_create_shipping_calculation_tables.php` が未適用、または手動 truncate されている。再投入する。 |
| 落札後ステータスが意図通りにならない | テスト直前に `php artisan db:seed --class=E2EStagingSeeder` を再実行して時刻を最新化する (`payment_deadline` などは `now()` 基準で再計算される)。 |
