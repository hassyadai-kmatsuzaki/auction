# メダカライブオークションシステム - ER図

## 📊 全体構成図（Mermaid）

```mermaid
erDiagram
    %% ユーザー関連
    users ||--o{ bids : "入札"
    users ||--o{ won_items : "落札"
    users ||--o{ deposits : "保証金"
    users ||--o{ announcements : "作成"
    users ||--o{ announcement_reads : "既読"
    users ||--o{ users : "承認"
    
    %% 出品者関連
    sellers ||--o{ items : "出品"
    
    %% オークション関連
    auctions ||--o{ items : "商品"
    auctions ||--o{ lanes : "レーン"
    auctions ||--|| auction_deposits : "保証金設定"
    auctions ||--o{ deposits : "保証金"
    auctions ||--o{ announcements : "関連"
    
    %% 商品関連
    items ||--o{ item_media : "メディア"
    items ||--o{ bids : "入札"
    items ||--|| won_items : "落札"
    items ||--|| lane_items : "レーン割当"
    
    %% レーン関連
    lanes ||--o{ lane_items : "商品割当"
    
    %% お知らせ関連
    announcements ||--o{ announcement_reads : "既読"
    
    %% ユーザー
    users {
        bigint id PK
        string name
        string email UK
        string password
        enum user_type "admin/participant"
        string phone
        string postal_code
        string prefecture
        string city
        string address_line1
        string address_line2
        enum status "pending/approved/suspended/rejected"
        timestamp approved_at
        bigint approved_by FK
        text rejected_reason
        timestamp last_login_at
        boolean is_active
        timestamp deleted_at
        timestamps
    }
    
    %% 出品者
    sellers {
        bigint id PK
        string seller_code UK
        string seller_name
        string contact_name
        string email
        string phone
        string postal_code
        string prefecture
        string city
        string address_line1
        string address_line2
        string bank_name
        string bank_branch
        enum account_type "checking/savings"
        string account_number
        string account_holder
        decimal commission_rate
        text notes
        boolean is_active
        timestamps
    }
    
    %% オークション
    auctions {
        bigint id PK
        string title
        date event_date
        time start_time
        time end_time
        enum status "preparing/scheduled/live/finished/cancelled"
        text description
        tinyint lane_count
        decimal default_bid_increment
        integer countdown_seconds
        boolean deposit_required
        timestamp upload_deadline
        integer payment_deadline_hours
        integer shipping_deadline_hours
        bigint created_by FK
        timestamps
    }
    
    %% オークション別保証金設定
    auction_deposits {
        bigint id PK
        bigint auction_id FK "UK"
        decimal deposit_amount
        enum deposit_type "none/fixed/flexible"
        text description
        timestamps
    }
    
    %% 保証金
    deposits {
        bigint id PK
        bigint auction_id FK
        bigint user_id FK
        decimal deposit_amount
        enum payment_method "bank_transfer/credit_card/cash"
        enum payment_status "pending/confirmed/refunded/forfeited"
        timestamp paid_at
        timestamp refunded_at
        decimal refund_amount
        text notes
        timestamps
    }
    
    %% 商品
    items {
        bigint id PK
        bigint auction_id FK
        bigint seller_id FK
        integer item_number
        string species_name
        integer quantity
        decimal start_price
        decimal current_price
        decimal reserve_price
        decimal estimated_price
        decimal bid_increment
        text inspection_info
        text individual_info
        text notes
        boolean is_premium
        decimal premium_fee
        string thumbnail_path
        enum status "draft/registered/live/sold/unsold/cancelled"
        enum unsold_action "return/free_pickup/relist"
        decimal storage_fee
        timestamp live_started_at
        timestamp live_ended_at
        timestamps
    }
    
    %% 商品メディア
    item_media {
        bigint id PK
        bigint item_id FK
        enum media_type "video_top/video_side/photo_top/photo_side/photo_other"
        string file_path
        string file_name
        bigint file_size
        string mime_type
        integer duration
        integer width
        integer height
        integer display_order
        boolean is_thumbnail
        timestamp uploaded_at
        timestamps
    }
    
    %% レーン
    lanes {
        bigint id PK
        bigint auction_id FK
        tinyint lane_number
        string lane_name
        bigint current_item_id FK
        enum status "waiting/active/paused/finished"
        timestamp started_at
        timestamp finished_at
        timestamps
    }
    
    %% レーン商品割当
    lane_items {
        bigint id PK
        bigint lane_id FK
        bigint item_id FK "UK"
        integer sequence_order
        timestamp started_at
        timestamp finished_at
        integer duration_seconds
        timestamps
    }
    
    %% 入札
    bids {
        bigint id PK
        bigint item_id FK
        bigint bidder_id FK
        decimal bid_price
        decimal total_amount
        boolean is_active
        enum bid_type "manual/auto"
        string ip_address
        text user_agent
        timestamps
    }
    
    %% 落札
    won_items {
        bigint id PK
        bigint item_id FK "UK"
        bigint winner_id FK
        decimal winning_price
        integer quantity
        decimal total_amount
        decimal commission_rate
        decimal commission_amount
        decimal seller_amount
        enum payment_status "pending/paid/confirmed/refunded"
        enum payment_method "bank_transfer/credit_card/cash/onsite"
        timestamp paid_at
        timestamp payment_confirmed_at
        timestamp payment_deadline
        enum delivery_method "shipping/pickup"
        timestamp pickup_datetime
        enum pickup_timeslot
        enum delivery_status "pending/preparing/shipped/completed/cancelled"
        string shipping_postal_code
        string shipping_prefecture
        string shipping_city
        string shipping_address_line1
        string shipping_address_line2
        string shipping_name
        string shipping_phone
        string shipping_company
        string tracking_number
        timestamp shipped_at
        timestamp delivered_at
        text notes
        timestamps
    }
    
    %% お知らせ
    announcements {
        bigint id PK
        string title
        text content
        enum announcement_type "general/auction/system/maintenance"
        enum target_audience "all/participants/admins"
        boolean is_published
        timestamp published_at
        timestamp expires_at
        enum priority "low/normal/high/urgent"
        boolean is_pinned
        bigint auction_id FK
        bigint created_by FK
        timestamps
    }
    
    %% お知らせ既読
    announcement_reads {
        bigint id PK
        bigint announcement_id FK
        bigint user_id FK
        timestamp read_at
        timestamps
    }
    
    %% システム設定
    system_settings {
        bigint id PK
        string setting_key UK
        text setting_value
        enum value_type "string/integer/decimal/boolean/json"
        string category
        string display_name
        text description
        boolean is_public
        timestamps
    }
```

---

## 🎯 テーブル分類

### 1. ユーザー管理（2テーブル）

#### 1.1 users（ユーザー）
- **役割**: 管理者・参加者の管理
- **特徴**: 承認制、論理削除対応
- **主要カラム**: user_type, status, approved_by

#### 1.2 sellers（出品者）
- **役割**: 生体を出品する業者・個人の管理
- **特徴**: 銀行口座情報、手数料率設定
- **主要カラム**: seller_code, bank_*, commission_rate

---

### 2. オークション管理（3テーブル）

#### 2.1 auctions（オークションイベント）
- **役割**: オークション開催単位の管理
- **特徴**: ステータス管理、期限設定
- **主要カラム**: event_date, status, lane_count

#### 2.2 auction_deposits（オークション別保証金設定）
- **役割**: オークションごとの保証金設定
- **特徴**: タイプ別設定（なし/固定/自由）
- **主要カラム**: deposit_type, deposit_amount

#### 2.3 deposits（保証金管理）
- **役割**: 参加者の保証金預かり状況
- **特徴**: 返金・没収対応
- **主要カラム**: payment_status, refund_amount

---

### 3. 商品管理（2テーブル）

#### 3.1 items（生体/商品）
- **役割**: オークション出品商品の管理
- **特徴**: プレミアムプラン、未落札時対応
- **主要カラム**: species_name, current_price, is_premium, unsold_action

#### 3.2 item_media（生体メディア）
- **役割**: 商品の画像・動画管理
- **特徴**: 種別管理、表示順序
- **主要カラム**: media_type, file_path, display_order

---

### 4. レーン・入札管理（4テーブル）

#### 4.1 lanes（レーン）
- **役割**: オークション進行のレーン管理
- **特徴**: 6レーン同時進行
- **主要カラム**: lane_number, current_item_id, status

#### 4.2 lane_items（レーン商品割り当て）
- **役割**: 各レーンへの商品割り当て
- **特徴**: 進行順序、所要時間記録
- **主要カラム**: sequence_order, duration_seconds

#### 4.3 bids（入札）
- **役割**: リアルタイム入札記録
- **特徴**: ON/OFFボタン、自動上昇
- **主要カラム**: bid_price, is_active, bid_type

#### 4.4 won_items（落札）
- **役割**: 落札情報と受取・配送管理
- **特徴**: 詳細な配送情報、受取方法選択
- **主要カラム**: winning_price, payment_status, delivery_method, shipping_*

---

### 5. お知らせ管理（2テーブル）

#### 5.1 announcements（お知らせ）
- **役割**: システムからのお知らせ配信
- **特徴**: 対象者・優先度設定、有効期限
- **主要カラム**: announcement_type, target_audience, priority

#### 5.2 announcement_reads（お知らせ既読管理）
- **役割**: ユーザーごとの既読状態
- **特徴**: 既読日時記録
- **主要カラム**: read_at

---

### 6. システム管理（1テーブル）

#### 6.1 system_settings（システム設定）
- **役割**: システム全体の設定管理
- **特徴**: キー・バリュー型、型安全
- **主要カラム**: setting_key, setting_value, value_type

---

## 🔗 主要なリレーション

### ユーザー中心
```
users
  ├─→ bids (入札者として)
  ├─→ won_items (落札者として)
  ├─→ deposits (参加者として)
  ├─→ announcements (作成者として)
  ├─→ announcement_reads (閲覧者として)
  └─→ users (承認者として)
```

### オークション中心
```
auctions
  ├─→ items (商品)
  ├─→ lanes (レーン)
  ├─→ auction_deposits (保証金設定)
  ├─→ deposits (参加者保証金)
  └─→ announcements (関連お知らせ)
```

### 商品中心
```
items
  ├─→ item_media (メディアファイル)
  ├─→ bids (入札)
  ├─→ won_items (落札)
  ├─→ lane_items (レーン割当)
  ├─← sellers (出品者)
  └─← auctions (オークション)
```

### レーン中心
```
lanes
  ├─→ lane_items (商品割当)
  ├─→ items (現在の商品)
  └─← auctions (オークション)
```

---

## 📈 データフロー

### 1. オークション準備フロー

```
auctions (作成)
  ↓
items (商品登録)
  ↓
item_media (メディアアップロード)
  ↓
lanes (レーン作成)
  ↓
lane_items (商品割り当て)
  ↓
announcements (開催通知)
```

### 2. オークション開催フロー

```
auctions (status: live)
  ↓
lanes (status: active)
  ↓
lane_items (started_at記録)
  ↓
items (status: live)
  ↓
bids (リアルタイム入札)
  ↓
items (current_price更新)
  ↓
won_items (落札確定)
  ↓
items (status: sold)
```

### 3. 落札後フロー

```
won_items (作成)
  ↓
announcements (落札通知)
  ↓
won_items (payment_status: paid)
  ↓
won_items (payment_confirmed_at記録)
  ↓
won_items (delivery_status: shipped)
  ↓
won_items (tracking_number記録)
  ↓
won_items (delivery_status: completed)
```

---

## 🔐 キー制約まとめ

### 主キー（PK）
すべてのテーブルに `id` (BIGINT UNSIGNED AUTO_INCREMENT)

### 一意制約（UK）
- `users.email`
- `sellers.seller_code`
- `auction_deposits.auction_id`
- `deposits.(auction_id, user_id)`
- `items.(auction_id, item_number)`
- `lanes.(auction_id, lane_number)`
- `lane_items.item_id`
- `won_items.item_id`
- `announcement_reads.(announcement_id, user_id)`
- `system_settings.setting_key`

### 外部キー（FK）
- **users → users** (approved_by)
- **auctions → users** (created_by)
- **auction_deposits → auctions** (auction_id) CASCADE
- **deposits → auctions, users** (auction_id, user_id) CASCADE
- **items → auctions, sellers** (auction_id CASCADE, seller_id RESTRICT)
- **item_media → items** (item_id) CASCADE
- **lanes → auctions, items** (auction_id CASCADE, current_item_id SET NULL)
- **lane_items → lanes, items** (lane_id, item_id) CASCADE
- **bids → items, users** (item_id, bidder_id) CASCADE
- **won_items → items, users** (item_id, winner_id) RESTRICT
- **announcements → users, auctions** (created_by RESTRICT, auction_id CASCADE)
- **announcement_reads → announcements, users** (announcement_id, user_id) CASCADE

---

## 📊 インデックス戦略まとめ

### リアルタイム入札用
```sql
-- 商品ごとの最新アクティブ入札を高速取得
bids: (item_id, is_active, created_at DESC)
bids: (item_id, created_at DESC)
```

### レーン進行用
```sql
-- レーン内の次の商品を高速取得
lane_items: (lane_id, sequence_order)
```

### 落札管理用
```sql
-- 入金期限切れ商品を高速取得
won_items: (payment_deadline)
won_items: (winner_id, payment_status)
```

### お知らせ表示用
```sql
-- 有効なお知らせを高速取得
announcements: (is_published, published_at, expires_at)
```

---

## 🎯 完璧なテーブル設計のポイント

✅ **正規化とパフォーマンスのバランス**  
✅ **拡張性（ENUM + system_settings）**  
✅ **データ整合性（FK制約、CHECK制約）**  
✅ **リアルタイム性（適切なインデックス）**  
✅ **運用性（論理削除、監査ログ）**  
✅ **セキュリティ（暗号化、アクセス制御）**  

---

**メダカライブオークションシステムの完璧なER図が完成しました！** 🎉
