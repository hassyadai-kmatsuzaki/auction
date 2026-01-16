# メダカライブオークションシステム - 仕様書（v2.1 改善版）

## 📚 ドキュメント一覧

本システムの仕様書は以下のドキュメントで構成されています。

---

### 1. [システム概要](./01_システム概要.md)
システム全体の概要、特徴、ユーザー種別、主要機能一覧を記載しています。

**主な内容:**
- システムの特徴（リアルタイム入札、6レーン同時進行）
- ユーザー種別（管理者、参加者）
- オークションスケジュール
- プレミアムプラン
- **車や絵画のオークション会場のようなライブ感**

---

### 2. [画面設計](./02_画面設計.md) 🎨 **フロントエンド正**
全17画面の詳細仕様と画面遷移図を記載しています。

**画面構成:**
- **共通画面（2画面）**: ログイン、ユーザー登録申請
- **参加者向け画面（3画面）**: お知らせ一覧、オークション会場（6レーン）、落札管理
- **管理者向け画面（12画面）**: ダッシュボード、お知らせ管理、オークション管理、生体管理、ライブ管理、落札者管理、ユーザー管理、設定

**実装状況:**
- ✅ React + TypeScript + Material-UI で実装済み
- ✅ `src/resources/ts/` 配下に全画面作成済み
- ✅ ルーティング設定完了

**参考UI:** [メダカライブオークション](https://v0-medaka-auction-ui.vercel.app/)

---

### 3. [データベース設計（改善版 v2.1）](./03_データベース設計_改善版.md) 🗄️ **最新版**
CTOフィードバックを完全反映した、実務に強いデータベース設計です。

**主なテーブル（17テーブル）:**

#### Phase 1（初期実装）- 14テーブル
- `users`: ユーザー（承認制、論理削除対応）
- `auctions`: オークションイベント
- `items`: 生体/商品（seller_id は Phase 1 では NULL）
- `item_media`: 生体メディア（動画・画像）
- `lanes`: レーン
- `lane_items`: レーン商品割り当て
- **`bid_participants`**: 入札参加状態（NEW - 状態管理）
- **`bid_events`**: 入札イベント履歴（NEW - 履歴管理）
- **`price_events`**: 価格変動履歴（NEW - 整合性の真実）
- `won_items`: 落札（配送先ロック機能追加）
- `announcements`: お知らせ
- `announcement_reads`: お知らせ既読管理
- `system_settings`: システム設定
- **`audit_logs`**: 監査ログ（NEW - 最初から実装）

#### Phase 2（将来拡張）- 3テーブル
- `sellers`: 出品者情報（`is_enabled=FALSE` で待機）
- `auction_deposits`: オークション別保証金設定（`is_enabled=FALSE` で待機）
- `deposits`: 参加者保証金管理（Phase 2 で有効化）

**改善ポイント:**
- ✅ 状態と履歴の完全分離（bid_participants + bid_events）
- ✅ 価格変動の根拠記録（price_events）
- ✅ 監査ログの完全実装（audit_logs）
- ✅ 配送先更新ルールの明文化（shipping_locked_at）
- ✅ Phase 1/2 の明確な分離設計

**CSV出力:**
- 📊 [テーブル一覧CSV](./database_tables_list.csv)
- 📊 [全テーブル詳細CSV](./database_schema_all_tables.csv)
- 📊 個別テーブルCSV（users, sellers, auctions, items 等）

---

### 4. [データベース設計_ER図](./データベース設計_ER図.md)
Mermaid形式の視覚的ER図と詳細解説です。

**含まれる内容:**
- 全体構成図（Mermaid）
- テーブル分類（6カテゴリ）
- 主要なリレーション図
- データフロー図
- キー制約まとめ
- インデックス戦略

---

### 5. [データベース設計_改善版_実装ガイド](./データベース設計_改善版_実装ガイド.md) 🛠️
改善版データベースの実装手順とコード例です。

**含まれる内容:**
- マイグレーション実行手順
- Phase 1 と Phase 2 の違い
- 実装コード例（Laravel）
  - 入札参加処理（ON/OFFボタン）
  - 価格自動上昇処理
  - 監査ログ記録
  - 配送先更新バリデーション
- 単体テスト・統合テストのコード例
- トラブルシューティング

---

### 6. [API設計](./04_API設計.md)
RESTful APIの仕様とWebSocketイベントを記載しています。

**主なAPI:**
- 認証API（登録申請、ログイン、ログアウト）
- お知らせAPI
- オークションAPI
- リアルタイム入札API
- 落札API
- 管理者API（お知らせ管理、オークション管理、生体管理、ライブ管理、落札者管理、ユーザー管理、設定）

**WebSocketイベント:**
- `PriceUpdated`: 価格更新
- `LaneChanged`: レーン切替
- `BidderJoined`: 入札者参加
- `BidderLeft`: 入札者離脱

---

### 7. [ビジネスフロー](./05_ビジネスフロー.md)
システムの業務フローを詳細に記載しています。

**主なフロー:**
1. **ユーザー登録・承認フロー**: 登録申請 → 管理者承認 → ログイン可能
2. **お知らせ配信フロー**: 作成 → 配信 → 閲覧
3. **オークション準備フロー**: オークション作成 → 生体登録 → レーン割り当て → 開催前通知
4. **オークション開催フロー**: 開始 → リアルタイム入札 → 落札決定 → 進行制御
5. **落札後フロー**: 落札通知 → 振込 → 発送
6. **システム設定フロー**: 各種設定の変更
7. **トラブル対応フロー**: 緊急停止、入金遅延

---

### 8. [技術仕様](./06_技術仕様.md)
開発に必要な技術的な詳細を記載しています。

**主な内容:**
- 技術スタック（TypeScript/React/MUI、Laravel、MySQL）
- ディレクトリ構成
- リアルタイム入札の実装
- 価格上昇ロジック
- パフォーマンス最適化
- セキュリティ対策
- テスト戦略
- デプロイ手順

---

### 9. [マイグレーション実行ガイド](./マイグレーション実行ガイド.md)
データベースマイグレーションの実行手順とトラブルシューティングです。

---

### 10. [CTO_FEEDBACK_対応完了レポート](../CTO_FEEDBACK_対応完了レポート.md) 📋
CTOフィードバックへの対応内容をまとめたレポートです。

**対応内容:**
- 設計方針の明確化（Phase 1/2）
- bidsの状態/履歴分離
- 価格更新の整合性確保
- won_itemsの更新ルール明文化
- 監査ログ実装
- 金額の型と丸め規則明文化

---

## 🎯 必要ページまとめ

### 共通（2ページ）
1. ログイン (`/login`)
2. ユーザー登録申請 (`/register`)

### 参加者向け（3ページ）
1. お知らせ一覧（ホーム） (`/`)
2. オークション会場（6レーン） (`/auction-live`)
3. 落札管理 (`/won-items`)

### 管理者向け（12ページ）
1. 管理ダッシュボード (`/admin`)
2. お知らせ管理 (`/admin/announcements`)
3. お知らせ作成・編集 (`/admin/announcements/create`, `/admin/announcements/edit/:id`)
4. オークション管理 (`/admin/auctions`)
5. オークション作成・編集 (`/admin/auctions/create`, `/admin/auctions/edit/:id`)
6. 生体管理（商品管理） (`/admin/items`)
7. 生体登録・編集 (`/admin/items/create`, `/admin/items/edit/:id`)
8. ライブオークション管理（6レーン制御） (`/admin/live-control`)
9. 落札者管理 (`/admin/won-items`)
10. ユーザー管理 (`/admin/users`)
11. ユーザー詳細・編集 (`/admin/users/:id`)
12. 設定 (`/admin/settings`)

**合計: 17ページ** ✅ 実装済み

---

## 📊 データベース構成まとめ（改善版 v2.1）

### Phase 1: コアテーブル（14テーブル）

| # | テーブル名 | 説明 | 使用状況 |
|---|----------|------|---------|
| 1 | users | ユーザー管理（承認制、論理削除） | ✅ Phase 1 |
| 2 | auctions | オークションイベント管理 | ✅ Phase 1 |
| 3 | items | 生体（商品）管理 | ✅ Phase 1 |
| 4 | item_media | 動画・画像管理 | ✅ Phase 1 |
| 5 | lanes | レーン管理 | ✅ Phase 1 |
| 6 | lane_items | レーン商品割り当て | ✅ Phase 1 |
| 7 | **bid_participants** | **入札参加状態（状態管理）** | ✅ Phase 1 |
| 8 | **bid_events** | **入札イベント履歴（履歴管理）** | ✅ Phase 1 |
| 9 | **price_events** | **価格変動履歴（整合性の真実）** | ✅ Phase 1 |
| 10 | won_items | 落札管理（詳細な配送・受取情報） | ✅ Phase 1 |
| 11 | announcements | お知らせ管理 | ✅ Phase 1 |
| 12 | announcement_reads | お知らせ既読管理 | ✅ Phase 1 |
| 13 | system_settings | システム設定 | ✅ Phase 1 |
| 14 | **audit_logs** | **監査ログ** | ✅ Phase 1 |

### Phase 2: 拡張テーブル（3テーブル）

| # | テーブル名 | 説明 | 使用状況 |
|---|----------|------|---------|
| 15 | sellers | 出品者管理（銀行口座、手数料率） | ⏸️ Phase 2 |
| 16 | auction_deposits | オークション別保証金設定 | ⏸️ Phase 2 |
| 17 | deposits | 参加者保証金管理 | ⏸️ Phase 2 |

**合計: 17テーブル**

---

## 🔗 リレーション（改善版）

```
users (1) ──< (N) bid_participants [入札参加]
users (1) ──< (N) bid_events [入札イベント]
users (1) ──< (N) won_items [落札]
users (1) ──< (N) audit_logs [操作]
users (1) ──< (N) deposits [保証金] ※Phase 2

sellers (1) ──< (N) items [出品] ※Phase 2

auctions (1) ──< (N) items [商品]
auctions (1) ──< (N) lanes [レーン]
auctions (1) ──< (1) auction_deposits [保証金設定] ※Phase 2
auctions (1) ──< (N) deposits [保証金] ※Phase 2

items (1) ──< (N) item_media [メディア]
items (1) ──< (N) bid_participants [入札参加者]
items (1) ──< (N) bid_events [入札イベント]
items (1) ──< (N) price_events [価格変動]
items (1) ──< (1) won_items [落札]
items (1) ──< (1) lane_items [レーン割当]

lanes (1) ──< (N) lane_items [商品割当]

announcements (1) ──< (N) announcement_reads [既読]
```

---

## 🚀 開発の進め方

### ✅ Phase 1: 基盤構築（Week 1-2）- 完了
- [x] データベース設計・マイグレーション
- [x] ユーザー認証機能（承認制）
- [x] 基本的なCRUD（ユーザー、オークション、生体）
- [x] 管理画面の基礎
- [x] フロントエンド画面作成（全17画面）

### 🔄 Phase 2: コア機能（Week 3-4）- 進行中
- [ ] 生体登録・表示機能
- [ ] 動画・画像アップロード
- [ ] オークションイベント管理
- [ ] お知らせ管理機能
- [ ] 参加者のホーム画面

### 📅 Phase 3: リアルタイム機能（Week 5-7）
- [ ] WebSocket環境構築（Laravel Echo + Pusher）
- [ ] 6レーンのリアルタイム入札UI
- [ ] 入札ロジック実装（bid_participants + bid_events）
- [ ] 価格自動上昇システム（price_events）
- [ ] レーン進行制御

### 📅 Phase 4: 落札管理（Week 8-9）
- [ ] 落札管理機能
- [ ] 振込確認機能
- [ ] 発送管理機能
- [ ] 請求書生成

### 📅 Phase 5: テスト・デプロイ（Week 10）
- [ ] ユニットテスト
- [ ] E2Eテスト
- [ ] パフォーマンステスト
- [ ] 本番環境デプロイ

---

## 📝 重要な変更点（v2.1 改善版）

### ✅ CTOフィードバック対応

| # | フィードバック | 対応内容 | 優先度 |
|---|-------------|---------|--------|
| 1 | 出品者・保証金の扱いが不明確 | Phase 1/2で明確化、`is_enabled`フラグ追加 | 🔴 最優先 |
| 2 | bidsが状態と履歴を混在 | `bid_participants`+`bid_events`に分離 | 🔴 高 |
| 3 | 価格更新の整合性が曖昧 | `price_events`で根拠記録 | 🔴 高 |
| 4 | won_itemsの更新ルール不明確 | `shipping_locked_at`追加、ルール明文化 | 🔴 高 |
| 5 | 監査ログがない | `audit_logs`テーブル追加 | 🟡 中 |
| 6 | 金額の型と丸め規則 | DECIMAL維持、丸め規則明文化 | 🟡 中 |

### ✅ 追加された機能（v2.1）
- **状態と履歴の分離**: bid_participants（状態）+ bid_events（履歴）
- **価格変動の根拠記録**: price_events（整合性の唯一の真実）
- **監査ログ**: audit_logs（最初から実装）
- **配送先ロック機能**: won_items.shipping_locked_at
- **Phase 1/2 の明確な分離**: is_enabled フラグで制御

### ❌ 削除された機能（v2.0 から継続）
以下の機能は、**リアルタイムオークション会場のコンセプトに合わないため削除**：

- ❌ お気に入り機能（事前登録・通知）
- ❌ 商品の事前一覧・詳細閲覧
- ❌ 受取方法の詳細選択（配送のみに簡素化）

### 🎯 コンセプト
**車や絵画のオークション会場のような、その場で進行するライブオークション**
- 事前閲覧なし
- お気に入り登録なし
- オークション当日のみ、6レーンで同時進行
- **Phase 1**: 管理者が一括管理（シンプル）
- **Phase 2**: 出品者機能・保証金システム追加（拡張）

---

## 📞 関連リンク

- **参考UI**: [メダカライブオークション](https://v0-medaka-auction-ui.vercel.app/)
- **開発環境**: Docker Compose
- **ポート**: 8430 (Nginx)、23306 (MySQL)、5173 (Vite)

---

## 🔖 バージョン履歴

- **v2.1** (2026-01-16): CTOフィードバック完全対応
  - bid_participants + bid_events に分離
  - price_events 追加
  - audit_logs 追加
  - shipping_locked_at 追加
  - Phase 1/2 の明確化
  - CSV出力対応

- **v2.0** (2025-11-12): 大幅リニューアル
  - リアルタイムオークション会場のコンセプトに変更
  - お気に入り機能削除
  - 出品者機能削除（管理者が一括管理）
  - ユーザー承認制導入
  - お知らせ機能追加
  - ページ数を17画面に簡素化

- **v1.0** (2025-11-12): 初版作成
  - システム概要、画面設計、DB設計、API設計、ビジネスフロー、技術仕様を作成

---

## 📊 CSV出力ファイル一覧

スプレッドシートでテーブル構成を確認できるCSVファイルを用意しています：

1. **[database_tables_list.csv](./database_tables_list.csv)** - テーブル一覧
2. **[database_schema_all_tables.csv](./database_schema_all_tables.csv)** - 全テーブル詳細（1ファイル）
3. **個別テーブルCSV**:
   - [database_schema_users.csv](./database_schema_users.csv)
   - [database_schema_sellers.csv](./database_schema_sellers.csv)
   - [database_schema_auctions.csv](./database_schema_auctions.csv)
   - [database_schema_items.csv](./database_schema_items.csv)
   - [database_schema_bid_participants.csv](./database_schema_bid_participants.csv)
   - [database_schema_bid_events.csv](./database_schema_bid_events.csv)
   - [database_schema_price_events.csv](./database_schema_price_events.csv)
   - [database_schema_won_items.csv](./database_schema_won_items.csv)
   - [database_schema_audit_logs.csv](./database_schema_audit_logs.csv)

**使い方**: Google SpreadsheetやExcelにインポートして、テーブル構成を視覚的に確認できます。

---

**メダカライブオークションシステム v2.1（改善版）- フロントエンド実装済み・データベース設計完了！** 🎉
