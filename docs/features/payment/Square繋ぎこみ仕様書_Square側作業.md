# Square 繋ぎこみ仕様書 ― Square 側で行う作業

| 項目 | 内容 |
|---|---|
| 文書番号 | SQ-2026-001 |
| 文書バージョン | v1.0 |
| 作成日 | 2026年4月20日 |
| 最終更新 | 2026年4月22日 |
| 対象システム | メダカオークション |
| 対象環境 | 本番（EC2 AL2023 / `/var/www/auction` / supervisor + redis 3 本） |
| 対象機能 | 年会費サブスクリプション決済（Card on File + 自前スケジューラ年次課金） |
| 対象サービス | Square Developer Dashboard / Square Seller Dashboard |
| 参照実装 | [SquareClient.php](src/app/Services/Payment/SquareClient.php) / [SquareWebhookController.php](src/app/Http/Controllers/Webhook/SquareWebhookController.php) / [SubscriptionService.php](src/app/Services/Payment/SubscriptionService.php) |
| 対象ロール | インテグレーター（開発担当） / ビジネスオーナー（代表・経理） |

> **本書のスコープ**: コード側の実装は完了済み。本書は **Square 管理画面（Developer Dashboard / Seller Dashboard）上で実施すべき作業** を、サンドボックス検証から本番カットオーバーまで工程順に網羅する。`.env` 反映のキーと、アプリ側が必要とする値の対応も併記する。

---

## 0. 本仕様書の構成

1. [前提・アプリ側で必要な値の一覧](#1-前提アプリ側で必要な値の一覧)
2. [Square アカウント種別と選定方針](#2-square-アカウント種別と選定方針)
3. [工程マップ（サンドボックス → 本番）](#3-工程マップサンドボックス--本番)
4. [SQ-01: Square アカウント作成](#4-sq-01-square-アカウント作成)
5. [SQ-02: Developer Dashboard / Application 作成](#5-sq-02-developer-dashboard--application-作成)
6. [SQ-03: サンドボックス環境の整備](#6-sq-03-サンドボックス環境の整備)
7. [SQ-04: Webhook Subscription 設定](#7-sq-04-webhook-subscription-設定)
8. [SQ-05: サンドボックス結合テスト（開発側）](#8-sq-05-サンドボックス結合テスト開発側)
9. [SQ-06: 本番 Seller Dashboard の事業者情報登録（KYC）](#9-sq-06-本番-seller-dashboard-の事業者情報登録kyc)
10. [SQ-07: 振込口座・入金サイクル設定](#10-sq-07-振込口座入金サイクル設定)
11. [SQ-08: 決済関連設定（JPY / カードブランド / 利用明細表記）](#11-sq-08-決済関連設定jpy--カードブランド--利用明細表記)
12. [SQ-09: 領収書・通知メール設定](#12-sq-09-領収書通知メール設定)
13. [SQ-10: 本番 Application と Production Credentials 取得](#13-sq-10-本番-application-と-production-credentials-取得)
14. [SQ-11: 本番 Webhook Subscription 設定](#14-sq-11-本番-webhook-subscription-設定)
15. [SQ-12: リスク・不正対策・分割決済・定期課金ポリシー](#15-sq-12-リスク不正対策分割決済定期課金ポリシー)
16. [SQ-13: アクセストークンのローテーション運用](#16-sq-13-アクセストークンのローテーション運用)
17. [SQ-14: 監視・アラート・ダッシュボード通知](#17-sq-14-監視アラートダッシュボード通知)
18. [SQ-15: ディスピュート（チャージバック）対応フロー](#18-sq-15-ディスピュートチャージバック対応フロー)
19. [SQ-16: 本番カットオーバー・チェックリスト](#19-sq-16-本番カットオーバーチェックリスト)
20. [付録A: API バージョン固定と更新方針](#付録a-api-バージョン固定と更新方針)
21. [付録B: サンドボックスのテストカード一覧](#付録b-サンドボックスのテストカード一覧)
22. [付録C: トラブルシューティング](#付録c-トラブルシューティング)

---

## 1. 前提・アプリ側で必要な値の一覧

アプリは以下の環境変数を読む（[config/services.php:66-75](src/config/services.php#L66-L75)）。**本書の各工程は、これらの値を取得・確定させることが目的**。

| .env キー | 取得元（Square 管理画面） | 備考 |
|---|---|---|
| `SQUARE_ENVIRONMENT` | 固定値（`sandbox` / `production`） | `.env` のみで切替 |
| `SQUARE_ACCESS_TOKEN` | Developer Dashboard → Application → Credentials | Sandbox/Production で別物 |
| `SQUARE_APPLICATION_ID` | 同上（Application ID） | Web Payments SDK でも使用 |
| `SQUARE_LOCATION_ID` | Seller Dashboard → Locations / API: `/v2/locations` | 事業所 1 拠点分 |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Developer Dashboard → Webhooks → Subscription | 署名検証 HMAC-SHA256 用 |
| `SQUARE_WEBHOOK_URL` | 固定（`https://<本番ドメイン>/api/webhooks/square`） | Square 登録値と **完全一致** 必須（署名式に含まれる） |
| `SQUARE_CURRENCY` | 固定値 `JPY` | 本プロダクトは日本円のみ |
| `SQUARE_API_VERSION` | 固定値 `2024-10-17` | [付録A](#付録a-api-バージョン固定と更新方針) |
| `VITE_SQUARE_APPLICATION_ID` | `SQUARE_APPLICATION_ID` と同値 | フロントバンドルに埋め込み |
| `VITE_SQUARE_LOCATION_ID` | `SQUARE_LOCATION_ID` と同値 | 同上 |
| `VITE_SQUARE_ENVIRONMENT` | `SQUARE_ENVIRONMENT` と同値 | Web SDK のロード URL を切替 |

**重要**:
- `SQUARE_WEBHOOK_URL` は署名検証式 `base64(HMAC-SHA256(webhook_url + body, signature_key))` に使われる（[SquareClient.php:178](src/app/Services/Payment/SquareClient.php#L178)）。Square 管理画面で登録した URL と **1 バイトでも異なると検証失敗**。末尾スラッシュ・プロトコル（https）・サブドメインまで厳密に一致させること。
- `VITE_*` 変数は `npm run build` 時にバンドルされるため、値を変更したら必ず **フロントの再ビルドとデプロイ** が必要。

---

## 2. Square アカウント種別と選定方針

### 2.1 アカウント体系

```
Square Account (事業者として1つ)
  ├─ Seller Dashboard  ... 事業・決済・振込・領収書・売上分析
  └─ Developer Dashboard ... Application・Webhook・API Key・Sandbox
       ├─ Sandbox Test Account (開発用・任意数)
       └─ Production Application (本番用)
```

### 2.2 本プロダクトの選定

| 論点 | 採用 | 理由 |
|---|---|---|
| アカウント所有者 | ビジネスオーナー（代表）個人 Square ID | 金融情報ひも付きのため、個人名義で作成し事業者登録 |
| 認証方式 | **Personal Access Token** | OAuth は本アプリ不要（マルチテナント SaaS ではない／自社で 1 アカウントのみ運用） |
| Application 数 | Sandbox 1 / Production 1 | 十分 |
| Location 数 | 1（オンライン事業所） | JPY の場合でもオンライン事業の Location が必須 |

> **OAuth にしない理由**: 本プロダクトは **自社事業として 1 つの Square アカウント配下で年会費を徴収する** モデル。ユーザー（会員）が自分の Square 口座を接続する必要がないため、Personal Access Token で運用する方が単純かつ安全。

---

## 3. 工程マップ（サンドボックス → 本番）

```
[A: 開発初期]
  SQ-01 アカウント作成
    ↓
  SQ-02 Application 作成（Sandbox Credentials 発行）
    ↓
  SQ-03 Sandbox 環境整備（Test Location / Test Customer）
    ↓
  SQ-04 Sandbox Webhook Subscription
    ↓
  SQ-05 ステージングで結合テスト

[B: 本番準備]
  SQ-06 KYC（本人確認・事業者確認）  ← 最長で数営業日
    ↓
  SQ-07 振込口座登録
    ↓
  SQ-08 JPY / カードブランド / 明細表記
    ↓
  SQ-09 領収書メール設定
    ↓
  SQ-10 Production Credentials 取得
    ↓
  SQ-11 Production Webhook Subscription

[C: 運用]
  SQ-12 リスク・不正対策
  SQ-13 トークンローテーション
  SQ-14 監視・アラート
  SQ-15 ディスピュート対応
  SQ-16 カットオーバー・チェックリスト
```

**並列化できないクリティカルパス**: `SQ-06 KYC` は Square の審査待ちが入る（通常 1〜5 営業日、書類追加要求があれば延長）。本番ローンチの **最低 2 週間前に着手** すること。

---

## 4. SQ-01: Square アカウント作成

### 4.1 作業

| # | 手順 |
|---|---|
| 1 | https://squareup.com/jp から「無料で始める」でアカウント作成 |
| 2 | メールアドレス / パスワード / 事業所 **日本** を選択 |
| 3 | ビジネス種別を選択（本プロダクトは「オンラインビジネス」） |
| 4 | 業種選択: 「サブスクリプションサービス」または「プロフェッショナルサービス」 |
| 5 | 2 段階認証（2FA）を **必ず ON**（SMS または認証アプリ） |

### 4.2 合否

- [ ] ログイン後、Seller Dashboard トップに「アカウント有効化」バナーが出る（KYC 前の状態）
- [ ] ログインメールに Square からの Welcome メールが届く
- [ ] 2FA が有効（設定画面で確認）

### 4.3 注意事項

- **アカウント名義は法人／代表個人名で統一**。KYC 書類と不一致だと却下される。
- この時点では KYC 未完了のため、本番決済はできない。サンドボックスは即利用可能。
- ルート権限となるログインアカウントは **代表 + 経理の 2 名のみ** に限定。開発者は後述の Team Member 権限で招待する。

---

## 5. SQ-02: Developer Dashboard / Application 作成

### 5.1 作業

1. https://developer.squareup.com にログイン（Seller と同じ Square アカウントで）
2. 「+ Create your first application」または右上「+」→ Application 作成
3. Application 名: `auction-subscription-sandbox`（本番は別に作成）
4. 用途選択: 「Accept payments online」
5. 作成後、以下 3 つのタブを確認：
   - **Credentials** ... Sandbox / Production の Application ID・Access Token
   - **Webhooks** ... Subscription 登録（後述 SQ-04 / SQ-11）
   - **OAuth** ... 本プロジェクトでは未使用

### 5.2 取得する値（Sandbox）

| .env キー | 取得場所 |
|---|---|
| `SQUARE_APPLICATION_ID` | Credentials タブ → Sandbox → Application ID（`sandbox-sq0idb-...`） |
| `SQUARE_ACCESS_TOKEN` | Credentials タブ → Sandbox → Access Token（`EAAA...`） |
| `VITE_SQUARE_APPLICATION_ID` | 同上（Application ID と同じ値） |

> **Access Token の扱い**:
> - 画面上は初回表示のみフル桁。以降は末尾しか見えないため、1Password/AWS Secrets Manager に即保存。
> - Git には絶対にコミットしない（`.env.example` にはプレースホルダのみ）。
> - ローテーション手順は [SQ-13](#16-sq-13-アクセストークンのローテーション運用)。

### 5.3 合否

- [ ] Sandbox Application ID が `sandbox-sq0idb-` 始まりで取得できた
- [ ] Sandbox Access Token が EAAA始まりで、権限（Scopes）に `PAYMENTS_WRITE` / `CUSTOMERS_WRITE` / `CUSTOMERS_READ` / `PAYMENTS_READ` が含まれる
- [ ] 本番用 Application は **まだ作らない**（KYC 完了後に SQ-10 で作成）

---

## 6. SQ-03: サンドボックス環境の整備

### 6.1 Test Location の確認

Sandbox アカウントには自動で 1 つの Test Location が作られている。

1. Developer Dashboard → Credentials タブ → Sandbox → 「Default Test Account」リンク
2. Sandbox Seller Dashboard が開く → Account & Settings → Business → Locations
3. Location ID（`L` から始まる英数字）を控える

| .env キー | 値 |
|---|---|
| `SQUARE_LOCATION_ID` | Sandbox の Test Location ID |
| `VITE_SQUARE_LOCATION_ID` | 同上 |

### 6.2 Sandbox テストシード

Sandbox Seller Dashboard で以下を作成しておくと結合テストで使える：

- Test Customer × 2 名（アプリ側の User 2 名に対応付け）
- Test Card 入力は [付録B](#付録b-サンドボックスのテストカード一覧) を参照

### 6.3 合否

- [ ] `SQUARE_LOCATION_ID` が取得でき、`.env`（staging）に反映済み
- [ ] Sandbox Seller Dashboard にログインでき、「Transactions」ページが空で表示される

---

## 7. SQ-04: Webhook Subscription 設定

### 7.1 購読するイベント（仕様固定）

[SquareWebhookController.php:69-73](src/app/Http/Controllers/Webhook/SquareWebhookController.php#L69-L73) が処理しているのは以下のみ。**それ以外は購読しない**（不要なトラフィックを Square 側に投げさせない）。

| イベント | 用途 |
|---|---|
| `payment.created` | 決済作成の非同期確認（補助） |
| `payment.updated` | 成功確定・失敗・返金発生の検知 |
| `refund.created` | 返金作成の検知 |
| `refund.updated` | 返金の COMPLETED 到達検知 |

### 7.2 Sandbox での作業手順

1. Developer Dashboard → Application → Webhooks → Subscriptions
2. 「Add subscription」
3. 入力：
   - **Name**: `auction-sandbox-webhook`
   - **URL**: `https://<staging ドメイン>/api/webhooks/square`
     - 例: `https://staging.auction.beer-o-clock.jp/api/webhooks/square`
     - **末尾スラッシュなし**。アプリの [routes/api.php:65-66](src/routes/api.php#L65-L66) で登録されているパスと完全一致させる
   - **API version**: `2024-10-17`
   - **Events**: 上記 4 つをチェック
4. Save → 一覧に戻り、作成された Subscription を開く
5. **Signature Key** を取得 → `SQUARE_WEBHOOK_SIGNATURE_KEY` に設定
6. `SQUARE_WEBHOOK_URL` には手順 3 で入力したのと **完全同一の URL** を設定

### 7.3 受信テスト（Sandbox）

Developer Dashboard → Subscription 詳細 → 「Send test event」で `payment.updated` のテストイベントを発火できる。

| 確認項目 | 期待値 |
|---|---|
| HTTP ステータス | 200（既処理 or 新規処理） / 401（署名不一致） / 500（処理エラー） |
| アプリ側 DB | `square_webhook_events` テーブルに行が追加 / `processed_at` が埋まる |
| アプリログ | 署名不一致時に `Square webhook signature mismatch` が出る |
| 冪等性 | 同じ test event を 2 回送信 → 2 回目は即 200 で返り DB 変化なし |

### 7.4 合否

- [ ] Sandbox Subscription の Signature Key / URL / Events が設定済み
- [ ] Send test event で 200 が返る
- [ ] `square_webhook_events` テーブルにレコードが記録される
- [ ] 意図的に Signature Key を誤らせ → 401 が返ることを確認（**必ず正常値に戻す**）

---

## 8. SQ-05: サンドボックス結合テスト（開発側）

本節は Square 側の作業ではなくアプリ側の検証項目だが、**Sandbox 設定が全て揃った後でなければ着手できない** ため、SQ の工程に含める。

### 8.1 スイート

| ID | 内容 | 合否 |
|---|---|---|
| INT-01 | 新規加入（成功カード `4111 1111 1111 1111`）→ Subscription 作成・Payment 完了・ Card on File 作成 | ✅ |
| INT-02 | 新規加入（失敗カード `4000 0000 0000 0002` = DECLINED） → エラー表示・Card 無効化 | ✅ |
| INT-03 | SCA 必須カード（[付録B](#付録b-サンドボックスのテストカード一覧)）→ `verifyBuyer` 成功 | ✅ |
| INT-04 | `subscriptions:renew` を手動実行 → 期限切れのサブスクに対して自動再課金 | ✅ |
| INT-05 | 再課金失敗 → Subscription が `past_due` / `suspended` に遷移 | ✅ |
| INT-06 | 管理者から全額返金 → Payment レコードが `refunded` | ✅ |
| INT-07 | Webhook: Sandbox 管理画面から payment.updated（FAILED）を送信 → Subscription 停止 | ✅ |
| INT-08 | Webhook 冪等性: 同じ event_id を 2 回送信 → DB 行は 1 つ | ✅ |
| INT-09 | カード再登録 → 旧 Card が Square で disabled 状態 | ✅ |
| INT-10 | 署名不一致で POST → 401（ログに warning） | ✅ |

### 8.2 ステージング環境での Webhook 疎通

Sandbox Webhook は **インターネットから到達可能な URL** を指定する必要がある。ローカル開発マシンに直接届けたい場合は ngrok などのトンネルを使うが、本プロダクトは staging が既にインターネット公開されているため、staging ドメインを指定する運用とする。

---

## 9. SQ-06: 本番 Seller Dashboard の事業者情報登録（KYC）

### 9.1 作業

1. 本番 Seller Dashboard → Account & Settings → Business information
2. 以下を登録：
   - **法人/個人事業主** の選択
   - **商号 / 法人番号（法人のみ）** 
   - **代表者氏名・生年月日・住所**（本人確認書類と完全一致）
   - **事業所住所・電話番号**
   - **業種**（サブスクリプション・オンラインサービス）
   - **予想月間取引額**（実態に合わせる。過小申告も過大申告も後の追加審査のリスク）
3. 本人確認書類のアップロード：
   - 法人: 登記簿謄本（3 ヶ月以内）・代表者の本人確認書類（運転免許証など）
   - 個人事業主: 本人確認書類＋開業届または確定申告書
4. ウェブサイト URL（サブスク決済フォームが実在するページ）を登録
   - 本プロダクトでは加入フロー画面 URL を指定

### 9.2 留意事項

- **法人名義と振込口座名義の一致**が必須。不一致だと承認後も入金が止まる。
- 審査中は Production credentials が取れない（発行はできるが、決済がブロックされる）ので、**審査完了 → SQ-10 の順** を厳守。
- 書類に問題があると Square から追加提出依頼メールが届く。代表者のメール受信体制を確認。

### 9.3 合否

- [ ] Seller Dashboard トップの「アカウントを有効化」バナーが消えた
- [ ] 「Account status: Active」に変わった
- [ ] Square からの審査完了メールを受領

---

## 10. SQ-07: 振込口座・入金サイクル設定

### 10.1 作業

1. Seller Dashboard → Account & Settings → Bank accounts → 「Add bank account」
2. 銀行名・支店・口座種別・口座番号・口座名義（**Seller 名義と一致**）
3. 少額テスト入金（数円）を Square が実行 → 数営業日後に金額を確認し、画面に入力して認証完了
4. 入金サイクル設定: Account & Settings → Transfers
   - **標準**: 取引翌営業日入金（JP 標準）
   - 「Custom schedule」で特定曜日にまとめることも可。本プロダクトは **月次での経理処理** に合わせ `月次（毎月 1 日）` を推奨
5. **最低入金金額**: 1,000 円（日本のデフォルト）を確認

### 10.2 合否

- [ ] 口座認証 完了メール受領
- [ ] Transfers 画面に「Next transfer: YYYY-MM-DD」と表示される
- [ ] 経理側に入金サイクルを書面で共有

---

## 11. SQ-08: 決済関連設定（JPY / カードブランド / 利用明細表記）

### 11.1 通貨

- Seller Dashboard → Account & Settings → Business → Currency: **JPY**（日本アカウントはデフォルト。他通貨不可）
- アプリ側 `SQUARE_CURRENCY=JPY` と一致

### 11.2 受け入れカードブランド

| ブランド | 本プロダクトで受付 | 備考 |
|---|---|---|
| Visa | ✅ | 必須 |
| Mastercard | ✅ | 必須 |
| JCB | ✅ | 日本ユーザー向けに必須 |
| American Express | ✅ | 手数料率が異なる。有効化必要 |
| Diners / Discover | ⚪（任意） | トラフィック少。無効でも可 |

Seller Dashboard → Payment methods で有効化する。Amex を有効にするには追加申請が必要な場合あり。

### 11.3 利用明細表記（Statement Descriptor）

クレジットカード明細に表示される事業者名。ユーザーが明細を見てチャージバックを起こさないよう、**アプリ名または事業者名を明示**。

- Seller Dashboard → Account & Settings → Business → Statement descriptor
- 推奨値: `AUCTION NENKAIHI`（最大 20 文字・半角英数）
- 長い日本語を使うと一部発行会社で文字化けする

### 11.4 合否

- [ ] Currency が JPY
- [ ] Visa / Mastercard / JCB / Amex がオン
- [ ] Statement descriptor が設定済み

---

## 12. SQ-09: 領収書・通知メール設定

### 12.1 Square 発行のメール領収書

本プロダクトでは **PDF 領収書を自前生成している**（[InvoiceController.php](src/app/Http/Controllers/Api/InvoiceController.php)）が、Square 側もメール領収書を自動送信する設定になっている。

| 設定項目 | 推奨値 | 理由 |
|---|---|---|
| Automatic email receipts | **OFF** | 自前 PDF と二重送信になり混乱を招く |
| SMS receipts | OFF | 同上 |
| Receipt logo / business info | 念のため登録 | 将来的に有効化した場合の事業者情報ブランディング |

**所在**: Seller Dashboard → Account & Settings → Receipt

### 12.2 決済成功／失敗メール（管理者宛）

Seller Dashboard → Account & Settings → Notifications で、**Seller 宛の通知メール** を ON にすると決済の着金／失敗のたびに Square から管理者にメールが飛ぶ。

- 推奨: 「Failed payments」のみ ON（失敗時の気付き用）
- 「Successful payments」は OFF（件数が増えると埋もれる）

### 12.3 合否

- [ ] Automatic email receipts = OFF
- [ ] Failed payments 通知 = ON
- [ ] 通知先メールが経理 + オンコール担当の 2 名に設定されている

---

## 13. SQ-10: 本番 Application と Production Credentials 取得

### 13.1 作業

1. KYC 完了（SQ-06）を確認
2. Developer Dashboard → Applications → 「+ Create application」
   - Name: `auction-subscription-production`
   - 既存の Sandbox Application とは別に作成する（同一 Application の Sandbox/Production は credentials が別なだけで混同しやすいので、本プロダクトでは完全分離を推奨）
3. Credentials タブ → **Production** セクションから以下を取得：

| .env キー（本番用） | 取得元 |
|---|---|
| `SQUARE_APPLICATION_ID` | Production → Application ID（`sq0idp-...`） |
| `SQUARE_ACCESS_TOKEN` | Production → Access Token（**初回表示のみ全桁**） |
| `SQUARE_LOCATION_ID` | 本番 Seller Dashboard → Locations の本番 Location ID |

4. 本番 `.env` に反映（`/var/www/auction/.env`）：
   ```
   SQUARE_ENVIRONMENT=production
   SQUARE_APPLICATION_ID=sq0idp-XXXX
   SQUARE_ACCESS_TOKEN=EAAA-XXXX
   SQUARE_LOCATION_ID=LXXXXXXXXXXXXXX
   VITE_SQUARE_APPLICATION_ID=sq0idp-XXXX
   VITE_SQUARE_LOCATION_ID=LXXXXXXXXXXXXXX
   VITE_SQUARE_ENVIRONMENT=production
   ```
5. フロントを再ビルド：
   ```bash
   ssh ec2-user@<prod> "cd /var/www/auction && npm ci && npm run build"
   ```
6. `config:cache` / `supervisor restart`：
   ```bash
   ssh ec2-user@<prod> "cd /var/www/auction && php artisan config:cache && sudo supervisorctl restart 'auction-worker-*'"
   ```

### 13.2 セキュリティ

- Production Access Token は **AWS Secrets Manager または 1Password Business** に保管。`.env` ファイルは EC2 上で `chmod 640 owner:www-data` に設定済みを確認。
- IAM で EC2 の Secrets Manager 取得権限を付与済みであれば、`.env` への直書きを廃止して実行時取得に切り替える運用も可（本プロダクトでは現状 `.env` 直書き）。

### 13.3 合否

- [ ] Production Application ID が `sq0idp-` 始まり
- [ ] 本番 `.env` に Production credentials 反映
- [ ] `curl -H "Square-Version: 2024-10-17" -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" https://connect.squareup.com/v2/locations` で Location 一覧が取れる（疎通確認）
- [ ] Secrets Manager / 1Password にトークン複製済み

---

## 14. SQ-11: 本番 Webhook Subscription 設定

### 14.1 作業

Sandbox と **別の Subscription** を本番 Application 配下に作成。

| 項目 | 値 |
|---|---|
| Name | `auction-production-webhook` |
| URL | `https://auction.beer-o-clock.jp/api/webhooks/square`（本番ドメイン確定後に書き換え） |
| API version | `2024-10-17` |
| Events | `payment.created` / `payment.updated` / `refund.created` / `refund.updated` |

本番 `.env`：
```
SQUARE_WEBHOOK_SIGNATURE_KEY=<Production Signature Key>
SQUARE_WEBHOOK_URL=https://auction.beer-o-clock.jp/api/webhooks/square
```

### 14.2 本番疎通テスト

- [ ] Send test event（payment.updated）→ 200 が返る
- [ ] `square_webhook_events` に本番レコードが入る
- [ ] `storage/logs/laravel.log` に `signature mismatch` が出ていない
- [ ] CloudWatch/サーバログで、Square 側の IP から POST が届いていることを確認

### 14.3 WAF 設定

本プロダクトは AWS WAF を導入済み（[AWS_WAF_DDoS対策設定手順書.md](docs/AWS_WAF_DDoS対策設定手順書.md)）。Square からの POST が誤検知で WAF に弾かれないよう以下を確認：

- `/api/webhooks/square` のパスに対する **レート制限を緩和**
- User-Agent（Square 側が送ってくるもの）をブロックしない
- Body サイズ上限を 64KB 以上で許容（payment.updated は比較的小さい）

### 14.4 合否

- [ ] 本番 Subscription で Send test event → 200
- [ ] 実際のテスト加入（自分のカードで 1 件 本番課金 → 即全額返金）をし、`payment.created` / `payment.updated` / `refund.updated` が **すべて届く** ことを確認
- [ ] WAF ログで Square IP がブロックされていない

---

## 15. SQ-12: リスク・不正対策・分割決済・定期課金ポリシー

### 15.1 Risk Manager 設定

Seller Dashboard → Account & Settings → Risk → Rules

| ルール | 推奨 | 備考 |
|---|---|---|
| CVV 必須 | **ON** | Web Payments SDK は必ず CVV を取るので影響なし |
| 郵便番号必須 | OFF | JP では郵便番号照合は実装されていない AVS が多く、誤判定の原因 |
| 高額決済アラート | しきい値 **10 万円** | 年会費プランが 1 万円想定のため、通常はこの額を超えない |
| 同一カードの短時間複数決済 | **ブロック（5 分以内 3 回）** | 再試行攻撃対策 |
| 国外カードの制限 | **警告のみ**（ブロックしない） | 海外在住会員がいる場合に備える |

### 15.2 定期課金の明示

Card Network（Visa/MC）は **定期課金を明示的に Square 側で宣言** することを推奨する。本プロダクトでは Square の Subscription API を使わず自前スケジューラだが、`chargeCard` 呼び出し時の `note` フィールドで用途を明記している（[SubscriptionService.php:84](src/app/Services/Payment/SubscriptionService.php#L84)）。

- Square 管理画面側での追加設定は **不要**
- ただし、カード会員利用規約・プライバシーポリシーに「年 1 回自動課金」を明記すること（アプリ側の責任）

### 15.3 合否

- [ ] Risk Rules が上記推奨に沿って設定済み
- [ ] 高額決済アラート先メールが経理に設定されている

---

## 16. SQ-13: アクセストークンのローテーション運用

### 16.1 方針

Square Personal Access Token は **明示的な失効期限がない**（無期限）。ただし以下の状況で即時失効が必要：

- トークン漏洩が疑われる
- 開発者の離職
- 年次セキュリティレビュー（推奨: 年 1 回）

### 16.2 ローテーション手順

1. Developer Dashboard → Application → Credentials → Production → **「Rotate」ボタン**
2. 新しい Access Token が発行され、**旧トークンは即座に無効化**（= デプロイ完了までの間は決済不能）
3. 本番 `.env` を更新 → `config:cache` → `supervisor restart` を **即時実行**
4. ダウンタイムを避けるには、手順を以下の順序で実施：
   - **メンテナンス告知を出す**（5 分程度）
   - AWS Systems Manager などでコマンドを用意しておき、Rotate 押下 → 自動で `.env` 書き換え → `config:cache` → restart
   - 正常性確認（`/api/me/subscription` で 200 が返る）
   - メンテナンス解除

### 16.3 定期課金タイミングとの衝突回避

`subscriptions:renew` は毎日 02:00（supervisor cron）に走る想定。**ローテーションは 02:00〜03:00 を避ける**。

### 16.4 合否

- [ ] ローテーション手順が Runbook 化されている
- [ ] 最後のローテーション日が記録されている
- [ ] 旧トークンを使ってアクセス → 401 Unauthorized を確認

---

## 17. SQ-14: 監視・アラート・ダッシュボード通知

### 17.1 Square ダッシュボード側の監視

| 項目 | 通知先 | 頻度 |
|---|---|---|
| Failed payments | Seller の管理メール | 即時 |
| Chargebacks / Disputes | Seller の管理メール | 即時（SQ-15 詳述） |
| Bank transfer failures | Seller の管理メール | 即時 |
| Account status changes | Seller の管理メール | 即時 |

**設定所在**: Seller Dashboard → Account & Settings → Notifications

### 17.2 アプリ側の監視（参考）

Square と独立した監視として以下を既に実装：
- `failed_jobs` テーブルの監視（CloudWatch Logs → アラート）
- `square_webhook_events.processing_error` が NULL でない行が 0 であること（定期クエリ）
- `payments.status = 'failed'` の件数 / 24h を Slack に日次レポート

### 17.3 合否

- [ ] Square 通知メール の宛先が経理 + オンコールで設定済み
- [ ] アプリ側モニタリングが稼働している（[実装状況レポート.md](docs/実装状況レポート.md) 参照）

---

## 18. SQ-15: ディスピュート（チャージバック）対応フロー

### 18.1 受信通路

- カード会員が発行会社経由でチャージバックを申請 → Square に通知 → **Seller Dashboard の Disputes タブ** に表示 + 通知メール
- Square Webhook の `dispute.*` は本プロダクトでは未購読（運用頻度が低いため Seller Dashboard の手動確認で足りる）

### 18.2 対応 SLA

Square から提示される **Response Deadline（通常 7〜14 日）** 内に対応しないと自動敗訴 → 売上取消。

### 18.3 作業手順

1. Seller Dashboard → Disputes → 対象レコードを開く
2. 「Challenge」または「Accept」を選択
3. Challenge する場合のエビデンス：
   - 購入者同意のエビデンス（加入時の Web Payments SDK トークン化ログ・IP・タイムスタンプ）
   - 自前 PDF 領収書
   - 利用規約への同意記録（チェックボックスログ）
   - 実際にサービスを提供した記録（ログイン履歴など）
4. Square 管理画面で PDF をアップロード + テキスト説明を記入 → Submit

### 18.4 アプリ側のデータ参照先

| 必要データ | 取得元 |
|---|---|
| 加入時の IP・User-Agent | `subscriptions.created_at` + アクセスログ |
| 初回 Payment 詳細 | `payments` テーブル |
| カード末尾 4 桁 | `subscriptions.card_last4` |
| Web Payments SDK tokenize 成功ログ | `storage/logs/laravel.log`（grep `verifyBuyer`） |
| 利用規約同意ログ | 別途実装（本プロダクト現状はアプリ側要確認） |

### 18.5 合否

- [ ] Disputes タブに現在 0 件
- [ ] Response Deadline 前に対応する Runbook が経理に共有済み
- [ ] 過去 1 年のチャージバック率が 1%未満（業界ベンチマーク）を維持

---

## 19. SQ-16: 本番カットオーバー・チェックリスト

本番公開前の最終チェック。**1 項目でも N なら公開しない**。

### 19.1 Square 側

- [ ] Seller Dashboard: Account status = **Active**
- [ ] Bank account 認証済み
- [ ] Currency = JPY / Visa・Mastercard・JCB・Amex 有効
- [ ] Statement descriptor 設定済み
- [ ] Automatic email receipts = OFF
- [ ] Failed payment 通知メール先 = 経理 + オンコール
- [ ] Production Application 作成済み（`sq0idp-`）
- [ ] Production Access Token を Secrets Manager に保管
- [ ] Production Webhook Subscription（`payment.*` / `refund.*` の 4 イベント）
- [ ] Risk Rules 設定済み
- [ ] 2FA がビジネスオーナー・経理の両方で ON

### 19.2 アプリ側（参照）

- [ ] 本番 `.env` が production 値で差し替え済み
- [ ] `VITE_SQUARE_*` でフロント再ビルド済み
- [ ] `php artisan config:cache` 実行済み
- [ ] supervisor 配下の全ワーカーが restart 済み
- [ ] `subscriptions:renew` が cron/supervisor で有効
- [ ] `curl https://connect.squareup.com/v2/locations` で 200 疎通
- [ ] Sandbox Subscription を**無効化**（本番と混同しないため）
- [ ] WAF で `/api/webhooks/square` のレート制限緩和
- [ ] CloudWatch アラート（failed_jobs, webhook processing_error）有効

### 19.3 本番スモーク

- [ ] 実カードで 1 件の年会費加入 → Subscription / Payment / Webhook すべて正常
- [ ] 管理者画面から全額返金 → Payment が `refunded` / Webhook で一致
- [ ] `subscriptions:renew` を手動 `--dry-run` → 対象件数が想定どおり
- [ ] 上記完了後、テスト加入分を削除（DB）または返金済みのまま記録として保持

---

## 付録A: API バージョン固定と更新方針

- 本プロダクトは `2024-10-17` に固定（[config/services.php:74](src/config/services.php#L74)）
- Square は **月次で新バージョンをリリース**。古いバージョンは最低 1 年はサポートされる
- 更新タイミング：
  - 年 1 回のセキュリティレビュー時に検討
  - Square から deprecation メールが来たら 2 ヶ月以内に対応
- 更新手順：
  1. Sandbox で新バージョンに切り替え → 全テスト通過
  2. Webhook Subscription の API version も合わせて更新
  3. 本番反映

---

## 付録B: サンドボックスのテストカード一覧

Square 公式: https://developer.squareup.com/docs/devtools/sandbox/payments

| 用途 | カード番号 | CVV | 有効期限 | 期待挙動 |
|---|---|---|---|---|
| 成功（Visa） | 4111 1111 1111 1111 | 111 | 12/30 | COMPLETED |
| 成功（Mastercard） | 5105 1051 0510 5100 | 111 | 12/30 | COMPLETED |
| 成功（JCB） | 3530 1113 3330 0000 | 111 | 12/30 | COMPLETED |
| 失敗（汎用 DECLINE） | 4000 0000 0000 0002 | 111 | 12/30 | DECLINED |
| 失敗（CVV 不正） | 4310 0000 0000 0007 | 111 | 12/30 | CVV_FAILURE |
| 失敗（保留） | 4310 0000 0000 0015 | 111 | 12/30 | PAYMENT_LIMIT_EXCEEDED |
| SCA 検証要求 | 4800 0000 0000 0004 | 111 | 12/30 | verifyBuyer 要求 |

> バージョンにより変更される可能性あり。Square 公式ページを常に正とする。

---

## 付録C: トラブルシューティング

| 症状 | 原因候補 | 確認手順 |
|---|---|---|
| Web Payments SDK の Card UI が空白 | `VITE_SQUARE_APPLICATION_ID` / `VITE_SQUARE_LOCATION_ID` が空 or 環境不一致 | ブラウザコンソール `window.Square` が存在するか。Vite ビルド後のバンドルに ID が埋まっているか |
| `verifyBuyer` で失敗する | SCA テストカード以外で要求されている / amount_money が 0 | SubscriptionRegisterModal.tsx:160 のログ |
| chargeCard で `UNAUTHORIZED` | Access Token が Sandbox のまま / ローテーション直後に旧トークン | `.env` と `config:cache` の再実行確認 |
| Webhook が 401 ばかり | `SQUARE_WEBHOOK_URL` が Square 登録値と不一致 | 1 文字単位で比較。末尾スラッシュ・プロトコル |
| Webhook が届かない | WAF でブロック / Ingress 設定 / URL 誤登録 | Developer Dashboard → Subscription → Delivery logs |
| Refund が `PENDING` のまま | Bank side 処理待ち（JP カードは数営業日） | Webhook `refund.updated` → COMPLETED を待つ |
| Location が Active でない | KYC 未完了 / 口座未登録 | Seller Dashboard トップバナー確認 |
| `subscriptions:renew` が 0 件 | 期限計算誤り / タイムゾーン不一致 | `SELECT id, ends_at FROM subscriptions WHERE ends_at < NOW()` |
| Payment 完了なのに Subscription が active にならない | Webhook で payment.updated を処理していない / idempotency 衝突 | `square_webhook_events.processing_error` を確認 |
| SCA で毎回ポップアップ | `intent=CHARGE` だが金額 0 やカード未照合 | `amount` が整数で渡っているか |

---

## 参考リンク

- Square Developer Docs: https://developer.squareup.com/docs
- Web Payments SDK: https://developer.squareup.com/docs/web-payments/overview
- Webhooks: https://developer.squareup.com/docs/webhooks/overview
- Cards API (Card on File): https://developer.squareup.com/docs/cards-api/what-it-does
- Payments API: https://developer.squareup.com/docs/payments-api/what-it-does
- Refunds API: https://developer.squareup.com/docs/refunds-api/overview
- API Versioning: https://developer.squareup.com/docs/build-basics/versioning-overview

以上。
