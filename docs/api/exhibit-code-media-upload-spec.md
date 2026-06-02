# 出品ID（exhibit_code）メディアアップロード API 仕様書

メダイチ動画自動編集パイプライン向け、出品ID（`exhibit_code`）でのメディアアップロード API 仕様書です。

- 作成日：2026-06-02
- 提出元：medaichi-system 開発（松崎）
- 提出先：AI動画パイプライン側（西川 様）
- 関連依頼：「出品ID(exhibit_code)アップロード対応」（2026-06-01）

---

## 1. 概要

印刷QRカードから読み取った **出品ID（`exhibit_code` = `A-001` 形式）** で商品を特定し、
動画・画像メディアを紐付けるサーバ間連携用 API です。

- AI 側は `items.id` を扱う必要はありません。**`auction_id` + `exhibit_code`** で紐付けます。
- 既存の `items.id` 版エンドポイントと**併存**します（既存は変更なし）。
- ボディ仕様・冪等性・1ファイル=1リクエスト・レスポンス形式は `items.id` 版と**完全に同一**です。
  変わるのは **パスのキーだけ**（`items.id` → `auction_id` + `exhibit_code`）。

---

## 2. エンドポイント

```
POST /api/internal/auctions/{auction_id}/items/{exhibit_code}/media
```

- ベースURL：`https://medaka-ichiba.com/api/internal`（本番・ステージング共通）
- 1リクエストにつきメディア1件を追加します。

### 認証

```
Authorization: Bearer <sanctum-token>
```

- 認証方式：Sanctum Bearer トークン
- 必要権限：`admin` ロール
- トークン未付与／不正 → `401`、`admin` 以外 → `403`

---

## 3. リクエスト

`Content-Type: multipart/form-data`

### パスパラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `auction_id` | 整数 | オークション識別子。現2桁→将来3桁の数字 |
| `exhibit_code` | 文字列 | 出品ID。`{レーン}-{3桁ゼロ埋め}` 形式（後述「5. フォーマット」） |

### ヘッダ

| ヘッダ | 必須 | 説明 |
|---|---|---|
| `Authorization` | 必須 | `Bearer <token>` |
| `Idempotency-Key` | 任意（強く推奨） | UUID v4。リトライ二重登録の防止（後述「6. 冪等性」） |

### ボディ

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `file` | 必須 | File | 拡張子：`jpg` / `jpeg` / `png` / `gif` / `webp` / `mp4` / `mov` / `webm`。最大 **100 MB** |
| `media_type` | 必須 | string | `"image"` または `"video"` |
| `is_thumbnail` | 任意 | boolean | `1`/`true` のとき、その商品の他メディアの `is_thumbnail` を解除し当該をサムネに設定。`media_type=video` の場合は無視 |

---

## 4. レスポンス

### 成功（201 Created）

画像：

```json
{
  "success": true,
  "message": "ファイルをアップロードしました。",
  "data": {
    "media": {
      "id": 12345,
      "media_type": "photo_other",
      "file_path": "items/29/5035/uuid.jpg",
      "file_url": "https://.../storage/items/29/5035/uuid.jpg",
      "poster_path": null,
      "poster_url": null,
      "is_processed": true,
      "is_thumbnail": false,
      "display_order": 3
    }
  }
}
```

動画：

```json
{
  "success": true,
  "message": "ファイルをアップロードしました。",
  "data": {
    "media": {
      "id": 12346,
      "media_type": "video_top",
      "file_path": "items/29/5035/uuid.mp4",
      "file_url": "https://.../storage/items/29/5035/uuid.mp4",
      "poster_path": "items/29/5035/uuid_poster_xxxxxx.jpg",
      "poster_url": "https://.../storage/items/29/5035/uuid_poster_xxxxxx.jpg",
      "is_processed": false,
      "is_thumbnail": false,
      "display_order": 4
    },
    "processing": {
      "poster_generated": true,
      "compression_status": "queued"
    }
  }
}
```

- 動画はアップロード後、ポスター画像（JPEG）を同期生成し、圧縮処理（H.264 / 長辺720px / CRF26）を
  非同期キューで実行します。`compression_status` は `queued` → `processing` → `done` / `failed` と遷移します。

### エラー一覧

| ステータス | 条件 |
|---|---|
| `201` | 成功 |
| `401` | トークン未付与／不正 |
| `403` | `admin` ロールでない |
| `404` | `auction_id` が存在しない／`(auction_id, exhibit_code)` に該当する商品なし |
| `409` | 該当商品が複数（曖昧。本来は起きない想定）／`Idempotency-Key` 衝突（前回処理中） |
| `422` | オークションが受付状態（開催前）でない／バリデーション失敗／`Idempotency-Key` 衝突（内容不一致） |

エラー時のボディ例：

```json
{ "success": false, "message": "指定された出品ID（exhibit_code）に該当する商品が見つかりません。" }
```

バリデーションエラー（422）はフィールド別：

```json
{ "success": false, "errors": { "media_type": ["メディア種別が不正です。"] } }
```

---

## 5. exhibit_code フォーマット（★最重要★）

QRカードとシステム発番の `exhibit_code` が **完全に同一文字列** でないと紐付けできません。

- フォーマット：**`{レーン}-{3桁ゼロ埋め}`**（例 `A-001`, `B-200`）
- レーン：英字（`A`, `B`）
- 番号：`001`〜（3桁ゼロ埋め）
- **大文字・ハイフン・ゼロ埋め桁数まで一致が必要**。`A-1` / `A001` / `a-001` はいずれも不可（→ `404`）

> システム側の自動発番をこのフォーマット（ハイフン入り `A-001`）に合わせて修正済みです（2026-06-02）。

---

## 6. 冪等性キー（Idempotency-Key）

ネットワーク不調（POST は届いたがレスポンスが届かない）でのリトライによる**二重登録を防止**します。

- ヘッダ：`Idempotency-Key: <文字列>`（推奨：UUID v4、最大128文字）
- **1つの論理アップロード＝1キー**。リトライ時は**同じキーを再利用**する（通信エラー・5xx・タイムアウトいずれも同じキー）。
- ファイル内容を変えたら**必ず新しいキーに振り直す**（同キー＋異なる内容は `422`）。
- 未付与でも動作するが、その場合は二重登録リスクを負う。

| ケース | 挙動 |
|---|---|
| 初回 | 通常処理。レスポンスを保存 |
| 同キー＋同内容で再送（前回完了済） | 保存済みレスポンスを返す。ヘッダ `Idempotent-Replayed: true` |
| 同キー＋同内容で再送（前回まだ処理中） | `409`。数秒待って再試行 |
| 同キー＋異なる内容で再送 | `422`（クライアント実装の不具合） |
| 異なるキー | 別リクエストとして通常処理 |

---

## 7. オークションの受付条件

誤った `auction_id` で別オークションの同一 `exhibit_code` に**誤爆**するのを防ぐため、API は次を検証します。

1. `auction_id` が**存在**すること（なければ `404`）。
2. オークションが **開催前（準備中／開催予定）** であること。
   開催中・終了・キャンセル済みのオークションは受け付けません（`422`）。
   ※ 撮影〜編集〜登録は開催が始まる前に行う運用のためです。

`exhibit_code` はオークション毎に再利用される（＝それ自体は非ユニーク）ため、`auction_id` がスコープキーになります。

---

## 8. 依頼書「確認だけ」への回答

| 確認項目 | 回答 |
|---|---|
| `exhibit_code` はオークション内ユニーク制約があるか？ | DBの UNIQUE 制約は無し。ただし発番が「レーン名＋レーン内連番」由来のため**発番ロジック上はオークション内で一意**。よって `409` は理論上のみ（データ異常時の保険） |
| `exhibit_code` は items テーブルに保存で確定か？ | **はい**。`items.exhibit_code`（`varchar`、index あり）に保存 |
| 発番タイミングは「admin で並び替え→自動発番」か？ | **その理解で正しい**。レーン割当時に発番され、一度発番した値は並び替えても固定 |
| `auction_id` の型は整数か？ | **はい**、整数（`auctions.id`）。現2桁→将来3桁の数字 |

---

## 9. リクエスト例

### cURL

```bash
curl -X POST \
  "https://medaka-auction.com/api/internal/auctions/42/items/A-001/media" \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -F "file=@/path/to/edited.mp4" \
  -F "media_type=video"
```

### Python（参考・リトライ込み）

```python
import uuid, time
import requests

def upload_media_by_exhibit_code(
    session: requests.Session,
    token: str,
    auction_id: int,
    exhibit_code: str,   # 例: "A-001"
    file_path: str,
    media_type: str,     # "image" | "video"
):
    # 1アップロードにつき1回だけキーを生成（リトライ間で再利用）
    idem_key = str(uuid.uuid4())
    url = f"https://medaka-auction.com/api/internal/auctions/{auction_id}/items/{exhibit_code}/media"

    with open(file_path, "rb") as f:
        for attempt in range(3):
            f.seek(0)  # リトライ時はファイル位置を先頭に戻す
            try:
                resp = session.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Idempotency-Key": idem_key,  # ← リトライ間で同じ値
                    },
                    files={"file": f},
                    data={"media_type": media_type},
                    timeout=120,
                )
            except requests.exceptions.RequestException:
                continue  # 通信エラーは同じ idem_key で再送

            if resp.status_code == 409:
                time.sleep(2)  # 処理中、少し待って再試行
                continue

            return resp  # 2xx / 4xx いずれも結果を返す
        raise RuntimeError("upload failed after retries")
```

---

## 10. テスト用オークション（6/03 検証）

実アップロードまで通すには、印刷カードの `exhibit_code`（`A-001`〜）に一致する商品を持つ
**開催前（準備中／開催予定）のステージングオークション**が必要です。
用意でき次第、その **`auction_id`** をお伝えします（AI 側の設定に投入してください）。
