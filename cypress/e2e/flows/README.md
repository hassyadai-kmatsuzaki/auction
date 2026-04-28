# フロー E2E テスト

PHPUnit Feature テストではカバーできない、**ブラウザ往復が必要なクリティカルパス** の E2E。

| # | spec | 主な検証 |
|---|---|---|
| 1 | `01-shipping-approval-and-invoice.cy.ts` | 送料計算→承認→請求書 PDF DL（auto / manual 両方） |
| 2 | `02-live-auction-cycle.cy.ts` | scheduled → live → finished の状態遷移 |
| 3 | `03-subscription-gate.cy.ts` | サブスク無効ユーザーの 401/402/403 |
| 4 | `04-seller-submit-with-media.cy.ts` | 出品 API + 画像アップロード + 履歴反映 |
| 5 | `05-manual-shipping-fee.cy.ts` | 送料手動入力ダイアログ + 落札者/出品者画面への反映 |

## 実行手順

### 前提

1. **バックエンド**

   ```bash
   cd /var/www/auction/src   # or ローカルなら src/
   php artisan migrate:fresh --seed   # E2E 用 admin/seller/participant をシード
   php artisan serve --host 0.0.0.0 --port 8430
   ```

2. **フロントエンド**

   ```bash
   npm run dev
   ```

3. **テストユーザー**

   `cypress.config.ts` の env が以下を期待します（必要に応じ書き換え）：

   - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` （`admin@example.com` / `password`）
   - `E2E_SELLER_EMAIL` / `E2E_SELLER_PASSWORD` （`seller1@example.com` / `password`）
   - `E2E_PARTICIPANT_EMAIL` / `E2E_PARTICIPANT_PASSWORD` （`participant1@example.com` / `password`）

   - **seller / participant にはアクティブなサブスクリプションが必要**（`allows_sell` / `allows_bid`）

### 実行

```bash
# 全フロー
npm run cy:run -- --spec 'cypress/e2e/flows/*.cy.ts'

# 単発
npm run cy:run -- --spec 'cypress/e2e/flows/01-shipping-approval-and-invoice.cy.ts'

# GUI で
npm run cy:open
```

## 設計方針

- **API 直接呼び出しを多用**：UI で seed データを準備するのは時間がかかり flaky になるので、`cy.apiAs('admin', { ... })` で前提データを作成し、UI は本来見たい瞬間だけ叩く。
- **defensive skip**：seed データが無いケース（既存 E2E と整合）では `cy.log('スキップ')` で止め、テストランナーを赤くしない。
- **状態遷移の検証は API**：カウントダウン (0.5秒tick) などタイミング依存の挙動は本テストでは扱わない（PHPUnit Unit でカバー済み）。

## カバーしていないこと

- Square 決済の実トランザクション（外部 API なので staging でのみ）
- LINE 通知の実送信（同上）
- WebSocket Broadcasting の実購読（broadcaster の起動が前提）
- ffmpeg を介した動画変換（VideoProcessing 系は PHPUnit でカバー）
