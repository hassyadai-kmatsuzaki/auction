# 出品ID・公開フラグ仕様書

最終更新: 2026-05-18
ステータス: 第2版 / レビュー前

---

## 0. 設計方針（重要）

**出品IDは「表示専用」の文字列**である。業務ロジック（入札、落札判定、決済、発送等）の識別子としては従来通り `items.id` / `items.item_number` を使い続け、出品IDはどこにも参照を持たせない。
そのため:

- 既存のロック順序・トランザクション境界・API契約・ブロードキャストペイロードは**いっさい変更しない**。
- API は追加のみ（既存フィールドは消さない）。フロント側は表示時に `exhibit_code` を主表示として使う。
- 出品IDは一度発行したら以後固定。再採番ロジックは持たない（並び替え・レーン移動が発生しても表示は乱れるだけで、データ事故にはならない）。

---

## 1. 目的と背景

オークション運営において、現状の商品ID (`items.id` / `items.item_number`) は内部採番のため、出品者・落札者間のコミュニケーションで「どの商品か」を口頭・チャットで指し示すのに不向き。
そこで人間に読みやすい **出品ID** を新設し、以下を実現する。

1. レーン名と出品順から自動採番される短い識別子（例: `A001`, `B015`）を発行する。
2. 参加者・落札者の目に触れる画面では出品IDを主表示にし、内部の商品IDは隠す（API・DB上は残置）。
3. オークションに **公開フラグ** を持たせ、true になったタイミングで落札者管理画面から商品閲覧が可能になる（公開前は管理画面のみ閲覧可）。
4. 出品IDが発行されたら、出品者に LINE / メールで「出品ID・商品ID・タイトル」を通知する。

---

## 2. 用語定義

| 用語 | 定義 |
|---|---|
| 商品ID | `items.id`（DB主キー）および `items.item_number`（オークション内連番）。内部識別子。 |
| 出品ID | レーン名 + 3桁ゼロ埋め連番（例: `A001`）。本仕様で新設する人間可読の識別子。 |
| 承認済み | `items.status = 'registered'` かつ `lane_items` にレコードが存在する状態。レーンと順番が確定していることを意味する。 |
| 公開 | オークションの `is_published = true` の状態。落札者管理画面で参加者が商品を閲覧できる条件。 |

---

## 3. データモデル変更

### 3.1 `lanes` テーブル

- `lane_name` は既存（`string(100) NULL`）。スキーマ変更なし。
- **初期値ロジックを変更**: `LaneController::createInitialLanes()` で `lane_name` を `A`, `B`, `C`, … と自動設定する（`chr(64 + lane_number)`）。
- 既存運用で `lane_name = NULL` のレーンがある本番データに対しては、運用側で事前に英字名を投入する（出品ID表示が空文字+数字になるため。空欄でも処理は落ちないが、表示が崩れる）。
- **ユニーク制約は今回は付けない**。同一 auction 内で `lane_name` が重複した場合、出品IDも重複し得るが、表示専用のため業務影響なし。将来の運用要件で必要になったら別チケットで検討。

### 3.2 `items` テーブル

新規カラムを追加:

| カラム | 型 | NULL | 既定 | 説明 |
|---|---|---|---|---|
| `exhibit_code` | `varchar(8)` | NULL | NULL | 出品ID（表示専用）。例: `A001`。レーン割当時に発行され以後固定。 |
| `exhibit_code_issued_at` | `timestamp` | NULL | NULL | 出品ID発行日時。 |

インデックス:
- `index(exhibit_code)` — 検索・絞り込み用途（任意）。
- **ユニーク制約は付けない**。`exhibit_code` は外部参照されない表示専用フィールドであり、重複が起きても業務に影響しない（表示が紛らわしくなるだけ）。

### 3.3 `auctions` テーブル

新規カラム:

| カラム | 型 | NULL | 既定 | 説明 |
|---|---|---|---|---|
| `is_published` | `boolean` | NOT NULL | `false` | 落札者管理画面への公開フラグ。 |
| `published_at` | `timestamp` | NULL | NULL | 公開操作日時（監査用）。 |

> `auctions.status` の `finished` / `live` とは独立。`is_published = false` の間は `status = finished` でも参加者の落札者管理画面に商品が出ない。

### 3.4 マイグレーション

```
2026_05_19_000001_add_exhibit_code_to_items_table.php
2026_05_19_000002_add_is_published_to_auctions_table.php
```

> 既存 lane_name の埋め直しや、終了済み auction の `is_published = true` バックフィルは、運用側で個別に対応する想定（本マイグレーションには含めない）。

---

## 4. 出品ID 発行ロジック

### 4.1 採番ルール

- フォーマット: `{lane_name}{NNN}` （lane_name = レーン名、NNN = 発行時点での `lane_items.sequence_order` を3桁ゼロ埋め）
  - 例: レーン A の sequence_order=1 → `A001`、sequence_order=12 → `A012`
- 4桁以上必要になるケース（1レーン1000生体超）は今期想定外。万一発生したら桁あふれを許容（`A1000`）。
- 出品IDは **レーン割当（= 承認確定）時点で発行・以後固定**。

### 4.2 発行のトリガー

新たな状態遷移・ステータスは導入しない。以下のいずれかが起きた瞬間に発行する。

1. **未発行のアイテムが `lane_items` に新規 INSERT された時** （= レーンと順番が初めて確定）
   - `LaneController::assignItem`
   - `LaneController::autoAssign`
2. **既に lane に割当済みのアイテムの `items.status` が `registered` に戻された時**（draft / cancelled から戻す運用は通常ないが、念のため）

実装は **`IssueExhibitCodeAction`** （新規 Action クラス）に集約し、上記呼び出し点から実行する。
冪等性: 既に `exhibit_code` がセットされているアイテムは即 return する。

### 4.3 採番アルゴリズム

**設計方針**: 表示専用フィールドなので、新たなロックは取らない。`assignItem` / `autoAssign` の既存トランザクション内で、`lane_items` への INSERT 直後に `lane_items.sequence_order` を読んで `exhibit_code` をセットするだけ。`sequence_order` は同一レーン内でユニーク（既存の `resequenceLane` が保証）なため、同一レーン内では重複しない。

```php
function issue(Item $item): void {
    if ($item->exhibit_code !== null) return;  // 固定済み

    $assignment = DB::table('lane_items')->where('item_id', $item->id)->first();
    if (! $assignment) return;                  // lane 未割当ならスキップ

    $lane = Lane::find($assignment->lane_id);
    if (! $lane || ! $lane->lane_name) return;  // lane名未設定ならスキップ（表示崩れ許容）

    $code = sprintf('%s%03d', $lane->lane_name, $assignment->sequence_order);

    $item->update([
        'exhibit_code' => $code,
        'exhibit_code_issued_at' => now(),
    ]);
}
```

ポイント:
- **`lockForUpdate` は使わない**。既存ロック順序を一切変更しない（CLAUDE.md feedback `project_bid_lock_order` 遵守）。
- 同一 auction で同一 `lane_name` のレーンを複数作った場合、`exhibit_code` も重複し得るが、表示専用フィールドなので業務影響なし。運用で `lane_name` が重複しないようにする。
- 同一レーン内のリシーケンス時の整合性は気にしない（後述）。

### 4.4 「割当時発行・以後固定」の帰結（表示崩れの許容）

- レーン内で **並び替え** が発生しても出品IDは振り直さない → 「出品IDの数字」と「実際の出品順 (`sequence_order`)」が乖離する可能性がある。
- 「レーン間移動」も同じ。移動先で新規発番せず元のコードを保持。`A012` が後にレーン B に移動しても `A012` のまま。
- これは出品者通知済みコードを変更しないための仕様。会場では `sequence_order` 順に進行するため、出品IDの数字順と進行順が一致しない場面は **許容する**。
- データ整合性事故は **発生しない**（業務ロジックは引き続き `items.id` / `item_number` を使うため）。混乱するのは表示だけ。
- 管理画面のレーン編集UIには「出品ID発行後の並び替え・移動は会場での見え方が乱れます」という注意書きを表示する程度に留め、操作自体は禁止しない。

### 4.5 ロールバック / 再発行（運用例外）

- 通常運用では不要。
- 管理者が `exhibit_code` を手動でクリアした場合、次に `IssueExhibitCodeAction` が走れば現在の `sequence_order` を元に再発番される。
- 出品キャンセル（`items.status = cancelled`）時:
  - `exhibit_code` は **クリアしない**（通知済みのため）。会場・商品リストには「キャンセル済」表示で残置。

---

## 5. 公開フラグ（`auctions.is_published`）

### 5.1 制御範囲

| 画面 / API | `is_published = false` 時の挙動 | `is_published = true` 時の挙動 |
|---|---|---|
| 参加者: 落札者管理画面（`/participant/won-items`, `GET /api/participant/won-items`） | そのオークションの won_item は一覧に表示しない | 通常通り表示 |
| 参加者: オークション会場（live ページ） | 既存の `auctions.status` 制御に従う（変更なし） | 同上 |
| 出品者: 出品商品一覧 | 既存通り表示（出品者には常に見える） | 同上 |
| 管理者: 落札者管理画面 | 公開フラグに依らず常時閲覧可（運用上必要なため） | 同上 |
| 管理者: オークション一覧 | 「未公開」バッジを表示 | 「公開中」バッジを表示 |

### 5.2 公開操作

- 管理画面: オークション詳細に「公開する」ボタンを追加。
  - `auctions.status` が `finished` でなくても toggle 可能（運用判断）。ただしデフォルト操作タイミングは「終了後、検収後」。
  - 「公開する」押下で `is_published = true` / `published_at = now()` を更新。
  - 「非公開に戻す」も可能（誤公開のロールバック用）。
- 公開操作は監査ログ (`audit_log_entries`) に記録する。

### 5.3 通知

- 公開操作時に落札者へ通知を送るか否かは **本仕様の対象外**（別途検討）。本仕様では「画面で見えるようになる」までを定義する。

---

## 6. 出品者向け通知（出品ID発行通知）

### 6.1 発火条件

- 出品IDが発行された時、即時にキューに積む。
- ただし「商品1件ごとに発火」だと複数商品出品者に通知が連投されるため、**出品者単位でデバウンス**する:
  - キューイング: `NotifyExhibitCodesJob(seller_profile_id, auction_id)` を `delay(60s)` で投入。
  - 60秒以内に同 seller × auction のジョブが既にキューにある場合は積み増さない（Redis SETNX 等で重複抑止）。
  - 60秒経過時点で、当該 seller × auction の **未通知の出品ID全件** を1通にまとめて送信する。
- 60秒のウィンドウを設ける理由: 管理者が一気にレーン割当する運用（auto-assign）で連続発番が起きるため。

### 6.2 通知チャネルと内容

| チャネル | 宛先 | 件名 / 主タイトル | 本文 |
|---|---|---|---|
| メール | `users.email`（出品者本人） | 「【出品ID発行】{auction.title}」 | 出品者宛挨拶 + オークション名・開催日 + 表形式で `出品ID / 商品ID(=item_number) / タイトル(=species_name)` の一覧 + フッタ（問い合わせ: info@nep-corp.com、From/Reply-To: noreply@line-ene.com） |
| LINE | `users.line_user_id`（連携済みの場合のみ） | — | Flex Message。ヘッダ「出品ID発行のお知らせ」、各行に `出品ID / 商品ID / タイトル` を表示。文末に「会場ではこの出品IDで進行します」 |

- LINE 未連携の出品者にはメールのみ送信。
- 既存実装に合わせて Mail クラスは `RoutesToNotifyQueue` を使う。
- メール送信失敗時はリトライ3回、最終失敗時は管理者通知（既存 NotificationService の仕組みに従う）。

### 6.3 通知の冪等性

- `items` に `exhibit_code_notified_at` カラムを **追加しない**（最小スキーマ変更）。代わりにジョブ内で「`exhibit_code IS NOT NULL` かつ通知ログ（後述）に当該 item_id が無いもの」を抽出する。
- 通知ログ: 既存の `line_notification_logs` に `notification_type = 'exhibit_code_issued'` で1行ずつ記録（item_id を `payload` JSON に含める）。メール側は専用テーブル不要、ログだけで再送防止可能。

### 6.4 出品者側の出品IDの見え方（参考）

- 出品者の「出品商品一覧」画面では、出品IDと商品IDの両方を併記する（出品者にとっては商品IDも有用なため）。

---

## 7. UI 変更点

> **共通方針**: API レスポンスから `item_number` / `items.id` は **削除しない**。フロント側で `exhibit_code` を主表示にし、参加者・落札者UIでは `item_number` / `items.id` の表示を伏せるのみ。

### 7.1 レーン管理画面（管理者）

- 「レーンを追加」のデフォルト lane_name を次のアルファベットに（既存 lane 数+1 → `chr(64 + n)`）。
- レーン名編集時、空欄を許可しない方向に変更（出品IDの表示崩れ防止）。
- レーン名は A-Z 推奨。日本語名・数字名も技術的には可能だが、出品ID生成上は半角英字1〜2文字を強く推奨（ガイドメッセージを表示）。
- 各商品カードに「出品ID」バッジ表示。未発行は「未発行」表記。
- レーン編集UIに「出品ID発行後の並び替え・移動は会場表示が乱れます」の注意書きを追加（操作自体は許可）。

### 7.2 オークション会場（参加者）

- 商品カードのヘッダーで `exhibit_code` を主表示にする（`#{item_number}` の表示は伏せる）。
- `exhibit_code` が NULL の場合のみ `item_number` フォールバック（運用上は発生しない想定だが安全側）。
- 商品詳細モーダル内も `item_number` / `items.id` の表示を伏せる。

### 7.3 商品リスト（参加者向け）

- 同上。`exhibit_code` を主表示にする。

### 7.4 落札者管理画面（参加者）

- `auctions.is_published = false` の auction に紐づく won_item を非表示（バックエンド側でフィルタ）。
- 表示する won_item のテーブル列で「商品ID」表記を「出品ID」表記に置換。

### 7.5 管理者画面

- 商品一覧テーブルに「出品ID」列を追加（既存の「No.」列はそのまま残す）。
- 落札者管理画面の商品列に「出品ID」を併記表示（管理者は両方見える）。
- オークション一覧に「公開状態」列を追加（公開中 / 未公開）。

### 7.6 出品者画面

- 「出品商品一覧」「精算詳細」等で出品IDと商品IDを併記表示。

---

## 8. 既存データ移行（本番投入時）

本番投入時の手順:

1. **マイグレーション実行前準備**: 現在進行中の auction が無いタイミング（朝の準備時間帯）で実施。
2. マイグレーション:
   - `items.exhibit_code` / `items.exhibit_code_issued_at` / `auctions.is_published` / `auctions.published_at` カラム追加。既存レコードは NULL / false。
3. **既存の終了済みオークションへの遡及発番（任意）**:
   - 過去オークションの items に対して、`lane_items.sequence_order` 順に `IssueExhibitCodeAction` を一括実行するスクリプト `php artisan exhibit-code:backfill --auction={id}` を提供。
   - 過去オークション分は出品者通知は **送らない**（バックフィル時は通知抑止フラグ付き）。
   - 過去分の遡及発番が不要であれば本ステップはスキップ可。
4. **既存 `lane_name = NULL` の扱い**:
   - 運用側で個別に英字名（A,B,C…）を投入する。投入されないままだと `exhibit_code` が空文字+数字（例: `001`）になり表示が崩れるため、本機能リリース前にUI側で `lane_name` 空欄禁止を有効化する流れと合わせて対応する。
5. **公開フラグの初期化**:
   - 既存の終了済み auction に対する `is_published = true` のバックフィルは **運用側で別途対応**（本仕様外）。

> ⚠️ `php artisan` は本番では必ず `sudo -u ec2-user` で実行（[memory: feedback_no_sudo_artisan])。

---

## 9. API / バックエンド変更まとめ

### 新規 Action / Service
- `App\Actions\Exhibit\IssueExhibitCodeAction` — 出品ID発行ロジック本体。
- `App\Jobs\NotifyExhibitCodesJob` — 出品者単位の出品ID通知ジョブ（delay 60s）。
- `App\Mail\SellerExhibitCodeNotificationMail` — メールテンプレ。
- `App\Services\LineFlexBuilder` に `buildExhibitCodeNotification(array $items): array` を追加。

### 既存ファイル改修
- `app/Http/Controllers/Admin/LaneController.php`
  - `createInitialLanes`: lane_name を A,B,C... で生成。
  - `createLane` / `assignItem` / `autoAssign` / `reorderItems`: 適切なタイミングで `IssueExhibitCodeAction` を呼ぶ。
- `app/Http/Controllers/Admin/AuctionController.php`
  - 公開/非公開トグルのエンドポイント追加: `PATCH /api/admin/auctions/{id}/publish` (body: `{is_published: bool}`)。
- `app/Http/Controllers/Participant/WonItemController.php`（および admin/参加者の関連 endpoint）
  - `auctions.is_published = false` の auction を除外するフィルタ追加（管理者向けは除外しない）。
- `app/Models/Item.php`
  - `$fillable` に `exhibit_code`, `exhibit_code_issued_at` 追加。
- `app/Models/Auction.php`
  - `$fillable` / `$casts` に `is_published`, `published_at` 追加。

### API レスポンス変更
- すべての item リソースに `exhibit_code` を **追加**（既存フィールド `item_number` / `id` は削除しない）。
- 旧フロントとの互換を保つため、参加者向け・管理者向け・出品者向け全てで `item_number` / `id` は引き続き返却する。
- 参加者・落札者UIでの「商品IDを伏せる」処理はフロント側で完結させる（バックエンドは何もしない）。
- ブロードキャストペイロード（BidEvent, CountdownService 等）は **一切変更しない**。`exhibit_code` をブロードキャストに含めたい場合は別チケットで検討。

---

## 10. テスト観点

### ユニット / 機能テスト
- `IssueExhibitCodeAction`:
  - 単一商品をレーンAに割当 → `A001` 発行。
  - 同レーン3件連続割当 → `A001`, `A002`, `A003` 発行（sequence_order に従う）。
  - 並び替えで sequence_order が変わっても `exhibit_code` は変更されない（固定確認）。
  - 異なるレーンに移動しても `exhibit_code` は変更されない（固定確認）。
  - `lane_name = NULL` のレーンに割当時はスキップ（例外を投げない）。
- 公開フラグ:
  - `is_published = false` → 参加者 won_item 一覧は当該 auction が見えない。
  - 管理者は `is_published` に関わらず見える。
- 通知:
  - 同一 seller × auction の連続発番で通知が1通にまとまる（60秒デバウンス）。
  - LINE 未連携でもメールは飛ぶ。
  - バックフィル時は通知が飛ばない。
- 既存の入札・落札判定・決済・発送フローが exhibit_code 導入後も変わらず動作することを既存テストで確認（リグレッション確認）。

### 手動テスト
- A,B,C 3レーン × 各2商品（計6商品）の auto-assign → 出品IDが `A001/A002/B001/B002/C001/C002` で発番。
- 出品者2名にまたがる場合の通知デバウンス確認。
- 公開トグルでの表示切替確認。
- 既存マニュアル/CLAUDE.md feedback「artisan を root で叩かない」が守られているか確認。

### リグレッション観点（重要）
- **入札系トランザクションのロック順序が変わっていないこと**を確認（`IssueExhibitCodeAction` は新たな lockForUpdate を取らないため、原則影響なし）。
- カウントダウンJob・入札系・落札確定・決済・発送には影響しないことを確認（exhibit_code は表示のみで業務ロジックから参照されない）。
- ブロードキャストペイロードに変更が入っていないこと（Reverb 経由の WebSocket クライアント互換）。

---

## 11. 未決定事項 / 今後の検討

- 公開フラグ ON 時の落札者向け通知（メール/LINE）有無 — 別仕様で議論。
- 出品IDの英字部分が2桁になる超大規模オークション（27レーン以上）の表記ゆれ — 当面想定外。
- 出品者画面での「自分の出品ID一覧」エクスポート機能 — 要望次第で別チケット。
- レーンキャンセル時の exhibit_code の扱い（現状: 残置）— 表示時に「キャンセル済」バッジで上書きする想定だがUI詳細は別途。

---

以上。

