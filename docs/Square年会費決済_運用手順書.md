# Square 年会費決済 実装・運用手順書

## 概要
- 3種のプラン（落札専用 / 出品専用 / どちらも）を管理画面で登録。
- 新規ユーザーは管理者承認後、初回ログイン時に決済登録モーダルで加入。
- Square の Card on File + 自前スケジューラ方式で年1回課金。
- 決済失敗 → Webhook 受信 → ユーザーを即時 suspended。

## 1. 環境変数（`.env`）

```
SQUARE_ENVIRONMENT=sandbox          # sandbox / production
SQUARE_ACCESS_TOKEN=...
SQUARE_APPLICATION_ID=sandbox-sq0idb-xxxx
SQUARE_LOCATION_ID=L..............
SQUARE_WEBHOOK_SIGNATURE_KEY=...
SQUARE_WEBHOOK_URL=https://auction.example.com/api/webhooks/square
SQUARE_CURRENCY=JPY
SQUARE_API_VERSION=2024-10-17

# フロント用
VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-xxxx
VITE_SQUARE_LOCATION_ID=L..............
VITE_SQUARE_ENVIRONMENT=sandbox
```

> 本番切り替え時は `SQUARE_ENVIRONMENT=production` と本番の access_token / location_id / webhook_signature_key / webhook_url に差し替える。

## 2. DB マイグレーション

```
php artisan migrate
```

追加されるテーブル:
- `plans` — プラン定義
- `subscriptions` — ユーザーごとの加入状態
- `payments` — 決済履歴
- `square_webhook_events` — Webhook 冪等管理

## 3. Square 管理画面での設定

1. Developer Dashboard で Webhook Subscription を作成
   - Notification URL: `https://auction.example.com/api/webhooks/square`
   - Events: `payment.created`, `payment.updated`, `refund.created`, `refund.updated`
   - 発行された **Signature Key** を `SQUARE_WEBHOOK_SIGNATURE_KEY` にセット
2. Location ID と Application ID を `.env` / フロント `.env` に設定
3. Sandbox の Application でテスト後、本番に切り替え

## 4. プラン登録（管理画面）

`/admin/plans` にアクセスして「プラン追加」。例:

| コード      | プラン名        | 年会費 | allows_bid | allows_sell |
|-------------|----------------|-------:|:----------:|:-----------:|
| bid_only    | 落札専用        | 5,000 | ✔          |             |
| sell_only   | 出品専用        |10,000 |            | ✔           |
| both        | 落札・出品セット|12,000 | ✔          | ✔           |

※ 金額・名称は任意。`is_active=false` にすると新規加入を締め切れる。

## 5. ユーザーフロー

1. 新規登録 → `status=pending`
2. 管理者が承認 → `status=approved` になる
3. ユーザー初回ログイン時、`SubscriptionGate` がサブスク未加入を検知してモーダル表示
4. プラン選択 + カード入力 → Square Web Payments SDK で `source_id` 取得 → `POST /api/me/subscription`
5. サーバーが Square Customer 作成 → Card on File 登録 → 即時課金 → `subscriptions` / `payments` 登録
6. 以後 1 年間有効、`current_period_end` を迎えると翌日 3:00 のバッチで自動課金

## 6. スケジューラ

`bootstrap/app.php` に登録済み:

```
$schedule->command('subscriptions:renew')->dailyAt('03:00')->withoutOverlapping();
```

本番 EC2 で cron に `php artisan schedule:run` が 1分ごとに回っていることを確認。

手動実行:
```
php artisan subscriptions:renew --dry-run   # 対象確認のみ
php artisan subscriptions:renew             # 実際に課金
```

## 7. 決済失敗時の挙動

- Webhook `payment.updated` で `FAILED` / `CANCELED` を受けると：
  - `payments.status = failed`
  - `subscriptions.status = suspended`
  - `users.is_active = false` / `users.status = suspended`
- ユーザーは再ログイン時にモーダルが再表示される（カード更新 → 自動で再課金を試みる）
- 管理画面 `/admin/subscriptions` で「再課金」ボタンからも復旧可能

## 8. 機能制限（allows_bid / allows_sell）

以下エンドポイントに `check.subscription` middleware を適用済み:

| エンドポイント                       | 要件                |
|--------------------------------------|---------------------|
| POST `/api/participant/bids`         | `allows_bid`        |
| POST `/api/participant/bid-limits`   | `allows_bid`        |
| DELETE `/api/participant/bid-limits/{itemId}` | `allows_bid` |
| POST `/api/seller/items`             | `allows_sell`       |
| PUT `/api/seller/items/{id}`         | `allows_sell`       |
| DELETE `/api/seller/items/{id}`      | `allows_sell`       |

- admin ロール保持者は常にスルー
- 未加入 → 402 Payment Required（`code: SUBSCRIPTION_REQUIRED`）
- プラン不足 → 403（`code: PLAN_CAPABILITY_MISSING`）

## 9. 動作確認手順（Sandbox）

### 9.1 ローカル/ステージングでの疎通確認
1. `.env` に sandbox のキーをセット
2. `php artisan migrate` → `php artisan serve` + `npm run dev`
3. 管理者で `/admin/plans` にプラン1件作成
4. 一般ユーザーを作成・承認
5. そのユーザーでログイン → モーダルが出ること
6. テストカード `4111 1111 1111 1111` / 任意の有効期限・CVV を入力 → 加入成功
7. 管理画面 `/admin/subscriptions` と `/admin/payments` でレコードが見えること

### 9.2 Webhook 疎通
ローカルなら ngrok 等で公開URL を Square に登録。サーバーログで受信ログ＆署名検証 OK を確認。

### 9.3 年次更新
```
# テスト用: current_period_end を今日に書き換えて
php artisan tinker
>>> \App\Models\Subscription::first()->update(['current_period_end' => now()->subDay()])

# 更新バッチ
php artisan subscriptions:renew
```
→ `payments` に新規レコード、`current_period_end` が 1 年後にずれていること。

### 9.4 失敗シナリオ
sandbox テストカード `4000 0000 0000 0002`（カード拒否）で加入 → 402 返却 → DB にレコードなし。

## 10. 返金
管理画面 `/admin/payments` → 「返金」ボタン。理由と金額（全額/一部）を指定して実行。Square へ RefundPayment API がコールされ、DB の `payments.status=refunded` に更新される。

## 11. 注意事項

- Square PHP SDK は導入せず Laravel の Http ファサードで直接 REST API をコール。依存削減とテスト容易性のため（`Http::fake()` でモック可）。
- JPY の amount は **円単位の整数**（USD 等のように「セント」への乗算は不要）。
- カード情報はフロント→Square直送のため、サーバーでカード番号を受け取らない（PCI DSS スコープ低減）。
- `idempotency_key` は user_id + uuid で生成、再送時の二重課金を防止。
- Webhook は `event_id` をユニーク制約にすることで冪等処理。

## 12. 関連ファイル一覧

- 設定: `config/services.php`, `.env.example`
- マイグレーション: `database/migrations/2026_04_20_1000*.php`
- モデル: `app/Models/{Plan,Subscription,Payment}.php`
- サービス: `app/Services/Payment/{SquareClient,SubscriptionService,SquareApiException}.php`
- ミドルウェア: `app/Http/Middleware/CheckSubscription.php`
- コントローラ（管理）: `app/Http/Controllers/Admin/{Plan,Subscription,Payment}Controller.php`
- コントローラ（ユーザー）: `app/Http/Controllers/User/SubscriptionController.php`
- コントローラ（Webhook）: `app/Http/Controllers/Webhook/SquareWebhookController.php`
- コンソール: `app/Console/Commands/RenewSubscriptions.php`
- フロント: `resources/ts/pages/admin/{Plan,Subscription,Payment}Management.tsx`, `resources/ts/components/{SubscriptionRegisterModal,SubscriptionGate,SubscriptionStatusCard}.tsx`
- ルート: `routes/api.php`, `bootstrap/app.php`
- テスト: `tests/Feature/Billing/*.php`, `tests/Unit/Services/SubscriptionRenewalTest.php`
