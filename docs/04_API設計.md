# メダカライブオークションシステム - API設計

## API概要

### ベースURL
```
http://localhost:8430/api
```

### 認証
- Laravel Sanctum を使用したトークンベース認証
- 全てのAPIリクエストには `Authorization: Bearer {token}` ヘッダーが必要（公開APIを除く）

### レスポンス形式

**成功時**
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

**エラー時**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": { ... }
  }
}
```

---

## 認証API

### POST /api/register
ユーザー登録申請（承認待ち）

**リクエスト**
```json
{
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "password": "password123",
  "password_confirmation": "password123",
  "phone": "090-1234-5678",
  "postal_code": "123-4567",
  "address": "東京都渋谷区..."
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "田中太郎",
      "email": "tanaka@example.com",
      "status": "pending"
    }
  },
  "message": "登録申請を受け付けました。承認をお待ちください。"
}
```

---

### POST /api/login
ログイン（承認済みユーザーのみ）

**リクエスト**
```json
{
  "email": "tanaka@example.com",
  "password": "password123"
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "田中太郎",
      "email": "tanaka@example.com",
      "user_type": "participant",
      "status": "approved"
    },
    "token": "1|abc..."
  }
}
```

---

### POST /api/logout
ログアウト

**レスポンス**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## お知らせAPI

### GET /api/announcements
お知らせ一覧取得

**クエリパラメータ**
- `page`: ページ番号
- `per_page`: 1ページあたりの件数

**レスポンス**
```json
{
  "success": true,
  "data": {
    "announcements": [
      {
        "id": 1,
        "title": "11月12日オークション開催のお知らせ",
        "content": "...",
        "priority": "high",
        "published_at": "2025-11-10T10:00:00Z",
        "is_read": false
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3
    }
  }
}
```

---

### POST /api/announcements/{id}/read
お知らせを既読にする

**レスポンス**
```json
{
  "success": true,
  "message": "Marked as read"
}
```

---

## オークションAPI

### GET /api/auctions
オークション一覧取得

**クエリパラメータ**
- `status`: ステータスフィルタ（`live`, `preparing`, `finished`）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "auctions": [
      {
        "id": 1,
        "title": "2025年11月オークション",
        "event_date": "2025-11-12",
        "start_time": "10:00:00",
        "status": "live",
        "total_items": 120
      }
    ]
  }
}
```

---

### GET /api/auctions/{id}
オークション詳細取得

**レスポンス**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "2025年11月オークション",
    "event_date": "2025-11-12",
    "start_time": "10:00:00",
    "status": "live",
    "description": "...",
    "lanes": [
      {
        "id": 1,
        "lane_number": 1,
        "status": "active",
        "current_item": { ... }
      }
    ]
  }
}
```

---

## リアルタイム入札API

### GET /api/auctions/{auction_id}/live
ライブオークション状態取得（6レーン）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "auction_id": 1,
    "lanes": [
      {
        "lane_id": 1,
        "lane_number": 1,
        "status": "active",
        "current_item": {
          "id": 1,
          "item_number": 1,
          "species_name": "幹之メダカ",
          "quantity": 5,
          "current_price": 800,
          "estimated_price": 1000,
          "thumbnail_path": "/storage/thumbnails/...",
          "active_bidders_count": 3,
          "countdown_seconds": 15,
          "my_bid_status": "active"
        }
      }
    ]
  }
}
```

---

### POST /api/bids
入札ON/OFF切り替え

**リクエスト**
```json
{
  "item_id": 1,
  "is_active": true
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "bid_id": 123,
    "item_id": 1,
    "is_active": true,
    "current_price": 800
  }
}
```

---

### GET /api/bids/my-active
自分のアクティブな入札一覧

**レスポンス**
```json
{
  "success": true,
  "data": {
    "active_bids": [
      {
        "bid_id": 123,
        "item": {
          "id": 1,
          "species_name": "幹之メダカ",
          "current_price": 800,
          "lane_number": 1
        }
      }
    ]
  }
}
```

---

## 落札API

### GET /api/my/won-items
自分の落札商品一覧

**クエリパラメータ**
- `auction_id`: オークションIDフィルタ

**レスポンス**
```json
{
  "success": true,
  "data": {
    "won_items": [
      {
        "id": 789,
        "item": {
          "id": 1,
          "item_number": 1,
          "species_name": "幹之メダカ",
          "quantity": 5,
          "thumbnail_path": "/storage/thumbnails/..."
        },
        "winning_price": 1200,
        "total_amount": 6000,
        "payment_status": "pending",
        "delivery_status": "pending",
        "shipping_address": "東京都渋谷区..."
      }
    ],
    "total_amount": 25000
  }
}
```

---

### PUT /api/my/won-items/{id}/address
配送先住所の更新（入金前のみ）

**リクエスト**
```json
{
  "shipping_address": "東京都渋谷区..."
}
```

**レスポンス**
```json
{
  "success": true,
  "message": "配送先を更新しました"
}
```

---

## 管理者API - お知らせ管理

### POST /api/admin/announcements
お知らせ作成

**リクエスト**
```json
{
  "title": "オークション開催のお知らせ",
  "content": "...",
  "priority": "high",
  "is_published": true,
  "published_at": "2025-11-10T10:00:00Z",
  "expires_at": "2025-11-15T10:00:00Z"
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "announcement": { ... }
  }
}
```

---

### PUT /api/admin/announcements/{id}
お知らせ更新

### DELETE /api/admin/announcements/{id}
お知らせ削除

---

## 管理者API - オークション管理

### GET /api/admin/auctions
オークション一覧取得（管理者用）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "auctions": [
      {
        "id": 1,
        "title": "2025年11月オークション",
        "event_date": "2025-11-12",
        "status": "live",
        "total_items": 120,
        "total_sold": 100,
        "total_sales": 1500000,
        "can_edit": false
      }
    ]
  }
}
```

---

### POST /api/admin/auctions
オークション作成

**リクエスト**
```json
{
  "title": "2025年12月オークション",
  "event_date": "2025-12-10",
  "start_time": "10:00:00",
  "description": "..."
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "auction": { ... }
  }
}
```

---

### PUT /api/admin/auctions/{id}
オークション更新（開催前のみ）

**制約**: `status`が`finished`の場合はエラー

**レスポンス（エラー例）**
```json
{
  "success": false,
  "error": {
    "code": "AUCTION_FINISHED",
    "message": "終了したオークションは編集できません"
  }
}
```

---

### DELETE /api/admin/auctions/{id}
オークション削除（開催前のみ）

---

## 管理者API - 生体管理

### GET /api/admin/auctions/{auction_id}/items
生体一覧取得

**レスポンス**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "item_number": 1,
        "species_name": "幹之メダカ",
        "quantity": 5,
        "start_price": 500,
        "current_price": 500,
        "is_premium": true,
        "thumbnail_path": "/storage/thumbnails/...",
        "status": "registered",
        "lane_assignment": {
          "lane_number": 1,
          "sequence_order": 1
        }
      }
    ],
    "statistics": {
      "total_items": 120,
      "registered": 100,
      "live": 10,
      "sold": 5,
      "unsold": 5
    }
  }
}
```

---

### POST /api/admin/auctions/{auction_id}/items
生体登録（マルチパート）

**リクエスト**
```
item_number: 1
species_name: 幹之メダカ
quantity: 5
start_price: 500
estimated_price: 1000
inspection_info: 体外光あり
individual_info: 全体的に光沢あり
notes: ...
is_premium: true
video_top: [ファイル]
video_side: [ファイル]
photos[]: [ファイル] (プレミアムのみ)
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "item": { ... }
  }
}
```

---

### PUT /api/admin/auctions/{auction_id}/items/{id}
生体更新

### DELETE /api/admin/auctions/{auction_id}/items/{id}
生体削除

---

### POST /api/admin/auctions/{auction_id}/items/reorder
出品順序変更

**リクエスト**
```json
{
  "item_ids": [3, 1, 2, 5, 4]
}
```

---

### POST /api/admin/auctions/{auction_id}/items/assign-lanes
レーン自動割り当て

**レスポンス**
```json
{
  "success": true,
  "message": "レーンに自動割り当てしました"
}
```

---

## 管理者API - ライブオークション管理

### POST /api/admin/auctions/{auction_id}/start
オークション開始

**レスポンス**
```json
{
  "success": true,
  "message": "オークションを開始しました"
}
```

---

### POST /api/admin/lanes/{lane_id}/next
次の生体へ進める（手動）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "lane_id": 1,
    "previous_item_id": 1,
    "current_item_id": 2
  }
}
```

---

### POST /api/admin/auctions/{auction_id}/pause
全レーン一時停止

### POST /api/admin/auctions/{auction_id}/resume
全レーン再開

---

## 管理者API - 落札者管理

### GET /api/admin/auctions/{auction_id}/won-items
全落札商品一覧

**クエリパラメータ**
- `payment_status`: 支払いステータスフィルタ
- `delivery_status`: 発送ステータスフィルタ

**レスポンス**
```json
{
  "success": true,
  "data": {
    "won_items": [
      {
        "id": 789,
        "item": { ... },
        "winner": {
          "id": 5,
          "name": "田中太郎",
          "email": "tanaka@example.com",
          "phone": "090-1234-5678"
        },
        "winning_price": 1200,
        "total_amount": 6000,
        "payment_status": "paid",
        "delivery_status": "pending",
        "shipping_address": "..."
      }
    ],
    "statistics": {
      "total_sales": 1500000,
      "paid_amount": 1200000,
      "pending_amount": 300000
    }
  }
}
```

---

### PUT /api/admin/won-items/{id}/payment-confirm
入金確認

**レスポンス**
```json
{
  "success": true,
  "data": {
    "won_item_id": 789,
    "payment_status": "paid",
    "payment_confirmed_at": "2025-11-13T10:30:00Z"
  }
}
```

---

### PUT /api/admin/won-items/{id}/shipped
発送完了

**リクエスト**
```json
{
  "tracking_number": "1234567890"
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "won_item_id": 789,
    "delivery_status": "shipped",
    "tracking_number": "1234567890",
    "shipped_at": "2025-11-13T15:00:00Z"
  }
}
```

---

## 管理者API - ユーザー管理

### GET /api/admin/users
ユーザー一覧取得

**クエリパラメータ**
- `status`: pending/approved/suspended
- `user_type`: admin/participant

**レスポンス**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "name": "田中太郎",
        "email": "tanaka@example.com",
        "user_type": "participant",
        "status": "pending",
        "created_at": "2025-11-01T10:00:00Z"
      }
    ],
    "statistics": {
      "pending": 5,
      "approved": 100,
      "suspended": 2
    }
  }
}
```

---

### POST /api/admin/users/{id}/approve
ユーザー承認

**レスポンス**
```json
{
  "success": true,
  "message": "ユーザーを承認しました"
}
```

---

### POST /api/admin/users/{id}/suspend
ユーザー停止

### POST /api/admin/users/{id}/activate
ユーザー復活

---

## 管理者API - 設定

### GET /api/admin/settings
システム設定取得

**レスポンス**
```json
{
  "success": true,
  "data": {
    "settings": {
      "site_name": "メダカライブオークション",
      "contact_email": "info@example.com",
      "price_increment_rate": 10,
      "price_increment_min": 50,
      "countdown_seconds": 3,
      "premium_plan_fee": 300
    }
  }
}
```

---

### PUT /api/admin/settings
システム設定更新

**リクエスト**
```json
{
  "price_increment_rate": 15,
  "countdown_seconds": 5
}
```

---

## WebSocket/リアルタイムイベント

### チャンネル: `auction.{auction_id}.live`
オークションのリアルタイム更新を購読

**イベント: `PriceUpdated`**
```json
{
  "item_id": 1,
  "lane_id": 1,
  "new_price": 900,
  "active_bidders_count": 4,
  "countdown_seconds": 3
}
```

**イベント: `LaneChanged`**
```json
{
  "lane_id": 1,
  "previous_item_id": 1,
  "current_item_id": 2
}
```

**イベント: `BidderJoined`**
```json
{
  "item_id": 1,
  "active_bidders_count": 5
}
```

**イベント: `BidderLeft`**
```json
{
  "item_id": 1,
  "active_bidders_count": 3
}
```

---

## エラーコード一覧

| コード | 説明 |
|-------|------|
| `AUTH_FAILED` | 認証失敗 |
| `USER_NOT_APPROVED` | ユーザーが未承認 |
| `INVALID_REQUEST` | リクエストパラメータ不正 |
| `NOT_FOUND` | リソースが見つからない |
| `PERMISSION_DENIED` | 権限不足 |
| `AUCTION_NOT_ACTIVE` | オークションが開催中でない |
| `AUCTION_FINISHED` | オークション終了済み（編集不可） |
| `BID_CLOSED` | 入札受付終了 |
| `ALREADY_WON` | 既に落札済み |
| `DEADLINE_PASSED` | 期限切れ |
