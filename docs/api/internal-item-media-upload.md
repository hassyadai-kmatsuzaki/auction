# 社内ツール用 メディアアップロード API

社内ツール (upload_system.py 等) から商品メディア (画像 / 動画) をアップロードするための内部 API です。一般ユーザー向け管理画面 (admin / media_editor) とは別経路で、サーバ間連携用のシンプルなインターフェースを提供します。

- ベース URL: `https://medaka-auction.com/api/internal` (本番ステージング共通)
- 認証: `auth:sanctum` (Bearer トークン)
- 権限: `admin` ロール必須

ルート定義: [routes/api.php:413-419](../../routes/api.php#L413-L419)
コントローラ: [app/Http/Controllers/Internal/ItemMediaController.php](../../app/Http/Controllers/Internal/ItemMediaController.php)

---

## 認証

すべてのエンドポイントで以下のヘッダが必要です。

```
Authorization: Bearer <sanctum-token>
```

トークン未付与 / 不正トークン → `401 Unauthorized`
`admin` 以外のロール → `403 Forbidden`

---

## エンドポイント

### 1. メディアアップロード

`POST /api/internal/items/{itemId}/media`

商品にメディアを 1 件追加します。画像は即時に保存、動画は保存後に
- ポスター画像 (JPEG) を**同期生成** ([VideoProcessingService::generatePoster](../../app/Services/VideoProcessingService.php))
- 圧縮処理 (H.264 / 長辺 720px / CRF 26) を**非同期キュー** ([ProcessItemVideoJob](../../app/Jobs/ProcessItemVideoJob.php)) で実行

#### リクエスト

- `Content-Type: multipart/form-data`
- パスパラメータ: `itemId` (整数) — `items.id`
- ヘッダ (任意・推奨): `Idempotency-Key: <unique-string>` — 後述「冪等性キー」を参照
- ボディ:

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `file` | 必須 | File | 拡張子: jpg / jpeg / png / gif / webp / mp4 / mov / webm。最大 100 MB |
| `media_type` | 必須 | string | `image` または `video` |
| `is_thumbnail` | 任意 | boolean | `true` の場合、当該 item の他メディアの `is_thumbnail` を false に揃え、サムネイルとして設定する。`media_type=video` の場合は無視される |

#### レスポンス

**成功 (201 Created)**

画像:
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

動画:
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

`poster_generated` は同期ポスター生成の成否。`compression_status` は非同期圧縮ジョブの状態 (`queued` → `processing` → `done` / `failed`)。状態は「3. メディア処理状態取得」で追跡可能。

**エラー**

| ステータス | 条件 |
|---|---|
| 401 | トークン未付与 / 不正 |
| 403 | `admin` ロールでない |
| 404 | `itemId` の商品が存在しない |
| 409 | `Idempotency-Key` 衝突 (処理中) |
| 422 | バリデーション失敗 / `Idempotency-Key` 衝突 (内容不一致) |

---

### 2. サムネイル指定

`PATCH /api/internal/items/{itemId}/media/{mediaId}/thumbnail`

既存メディアのうち 1 件をサムネイルに指定します。動画は指定不可。

#### リクエスト

ボディなし。

#### レスポンス

**成功 (200 OK)**
```json
{
  "success": true,
  "message": "サムネイルを設定しました。",
  "data": {
    "item_id": 5035,
    "media_id": 12345,
    "thumbnail_url": "https://.../storage/items/29/5035/uuid.jpg"
  }
}
```

**エラー**

| ステータス | 条件 |
|---|---|
| 404 | `itemId` / `mediaId` が存在しない |
| 422 | 指定メディアが動画 |

---

### 3. メディア処理状態取得

`GET /api/internal/items/{itemId}/media/{mediaId}`

主に動画アップロード後の圧縮状態を確認するために使用します。

#### レスポンス

**成功 (200 OK)**
```json
{
  "success": true,
  "data": {
    "media": {
      "id": 12346,
      "media_type": "video_top",
      "file_path": "items/29/5035/uuid_enc_xxxxxx.mp4",
      "file_url": "https://.../storage/items/29/5035/uuid_enc_xxxxxx.mp4",
      "poster_path": "items/29/5035/uuid_poster_xxxxxx.jpg",
      "poster_url": "https://.../storage/items/29/5035/uuid_poster_xxxxxx.jpg",
      "mime_type": "video/mp4",
      "file_size": 5242880,
      "is_processed": true,
      "is_thumbnail": false,
      "display_order": 4
    },
    "processing": {
      "status": "done",
      "reason": null,
      "at": "2026-05-20T18:50:12+09:00"
    }
  }
}
```

`processing.status` の取りうる値:

| status | 意味 |
|---|---|
| `queued` | キュー投入済み、ワーカー処理待ち |
| `processing` | ワーカーが処理中 |
| `done` | 圧縮完了 (`file_path` も圧縮後ファイルに差し替わっている) |
| `failed` | 失敗。`reason` にエラー原因 |
| `unknown` | Redis から状態が取得できない (古いメディア等)。`media.is_processed` を参照 |

---

## 冪等性キー (Idempotency-Key)

### 何を解決するか

クライアント側のリトライ実装によって、ネットワーク不調 (POST は届いたがレスポンスが届かない) のケースで**同じファイルが二重登録**される問題を防ぎます。

### 仕様

- リクエストヘッダ: `Idempotency-Key: <文字列>`
- 推奨形式: **UUID v4** (例: `550e8400-e29b-41d4-a716-446655440000`)
- 最大長: 128 文字
- 適用範囲: 上記「1. メディアアップロード」のみ

### クライアント側の責務

1. **1 つの論理アップロードにつき 1 つのキーを生成**する (例: 「item 5035 にこの動画を追加する」操作 = 1キー)
2. **リトライ時は同じキーを再利用**する。ネットワークエラー、5xx エラー、タイムアウト、いずれの場合でも同じキーを送る
3. **ファイル内容が変わったら必ず新しいキーを振り直す** (同キー + 異なる内容は 422 で拒否される)
4. ヘッダ未付与でも従来通り動作するが、二重登録リスクを負うことになる

### サーバ側の挙動

サーバはキー + リクエスト本文 (itemId / media_type / is_thumbnail / ファイル内容の SHA-256) を保存し、再送を以下の通り処理します。

| ケース | 挙動 |
|---|---|
| 初回 | 通常処理。レスポンスを保存 |
| 同キー + 同内容で再送 (前回完了済) | 保存済みレスポンスを返す。レスポンスヘッダに `Idempotent-Replayed: true` を付与 |
| 同キー + 同内容で再送 (前回まだ処理中) | `409 Conflict`。クライアントは数秒待ってから再試行 |
| 同キー + 異なる内容で再送 | `422 Unprocessable Entity`。クライアント実装の不具合 |
| 異なるキー | 別リクエストとして通常処理 |

### 保管期間 / クリーンアップ

冪等性キーは `idempotency_keys` テーブルに永続化されます。自動クリーンアップは行いません (1日数百件の規模を想定)。長期間蓄積した場合は手動で `DELETE FROM idempotency_keys WHERE created_at < ...` で削減できます。

### Python 実装例 (参考)

```python
import uuid
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def upload_media(session: requests.Session, token: str, item_id: int, file_path: str, media_type: str):
    # 1 アップロードにつき 1 回だけキーを生成
    idem_key = str(uuid.uuid4())

    with open(file_path, 'rb') as f:
        # 同じファイルハンドルをリトライ間で使う場合は seek(0) を忘れない
        for attempt in range(3):
            f.seek(0)
            try:
                resp = session.post(
                    f'https://medaka-auction.com/api/internal/items/{item_id}/media',
                    headers={
                        'Authorization': f'Bearer {token}',
                        'Idempotency-Key': idem_key,  # ← リトライ間で同じ値を維持
                    },
                    files={'file': f},
                    data={'media_type': media_type},
                    timeout=120,
                )
            except requests.exceptions.RequestException:
                continue  # 通信エラーは再送 (同じ idem_key で)

            if resp.status_code == 409:
                # サーバ側が処理中、少し待って再試行
                time.sleep(2)
                continue

            return resp  # 2xx でも 4xx でも結果を返す
        raise RuntimeError('upload failed after retries')
```

---

## 関連

- 動画圧縮ジョブ: [ProcessItemVideoJob.php](../../app/Jobs/ProcessItemVideoJob.php)
- 動画処理サービス: [VideoProcessingService.php](../../app/Services/VideoProcessingService.php)
- 冪等性管理サービス: [IdempotencyService.php](../../app/Services/IdempotencyService.php)
- マイグレーション: [2026_05_20_000001_create_idempotency_keys_table.php](../../database/migrations/2026_05_20_000001_create_idempotency_keys_table.php)
