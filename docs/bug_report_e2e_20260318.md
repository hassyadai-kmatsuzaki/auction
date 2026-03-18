# E2Eテスト バグ調査報告・修正方針

**作成日:** 2026-03-18
**対象バグ:** 4件（重大度: 高）

---

## Bug①: 管理者画面 - 生体削除で「Class Storage not found」

### 現象
管理者管理画面の生体管理で削除ボタンを押すと以下のエラーが発生し削除できない。
```
Class "App\Http\Controllers\Admin\Storage" not found
```

### 原因
**ファイル:** `app/Http/Controllers/Admin/ItemController.php` (355行目付近)

`destroy()` メソッド内で `Storage::disk($disk)->delete(...)` を呼び出しているが、`use Illuminate\Support\Facades\Storage;` のインポートが欠落している。

PHPは未インポートのクラスを現在の名前空間（`App\Http\Controllers\Admin`）で解決しようとするため、`App\Http\Controllers\Admin\Storage` が見つからないエラーとなる。

> 参考: `ItemMediaBulkController.php` では正しくインポートされている。

### 修正方針
`ItemController.php` のインポート文に以下を追加する:
```php
use Illuminate\Support\Facades\Storage;
```

### 影響範囲
- 管理者画面からの生体削除機能のみ
- 修正リスク: 極小（インポート追加のみ）

---

## Bug②: 出品者画面 - 複数生体登録時のデッドロック

### 現象
出品者管理画面で複数生体を同時登録しようとすると以下のエラーが発生する:
```
SQLSTATE[40001]: Serialization failure: 1213 Deadlock found when trying to get lock;
try restarting transaction
(SQL: select max(`item_number`) as aggregate from `items` where `auction_id` = 12 for update)
```

### 原因
**関連ファイル:**
- `app/Http/Controllers/Seller/ItemController.php` (193-223行目)
- `app/Http/Controllers/Admin/ItemController.php` (132-165行目)
- `app/Services/ItemImportService.php` (50-84行目)

#### 根本原因
1. **`lockForUpdate()` を集約クエリ（`max()`）に使用**: `SELECT max(item_number) ... FOR UPDATE` はインデックス範囲全体にロックをかけるため、同一 `auction_id` への並行アクセスが全てブロックされる
2. **手動トランザクション管理**: `DB::beginTransaction()` を使用しており、デッドロック時の自動リトライがない
3. **CSV一括インポート**: `ItemImportService` ではロックなしで `max()` を取得後、個別にレコードを作成するため競合が発生する

#### デッドロック発生シナリオ
1. 出品者Aがアイテム登録開始 → `FOR UPDATE` でロック取得
2. 出品者Bが同時にアイテム登録開始 → 同じロックを待機
3. トランザクションの順序によって循環待ちが発生 → デッドロック

### 修正方針

**方針: 採番方式の変更 + リトライ機構の導入**

1. **`DB::transaction()` のクロージャ形式に変更** — デッドロック時に自動リトライされる（デフォルト1回）:
```php
DB::transaction(function () use ($request, $auctionId) {
    $maxNumber = Item::where('auction_id', $auctionId)
        ->lockForUpdate()
        ->max('item_number') ?? 0;
    // ...
}, 3); // 最大3回リトライ
```

2. **CSV一括インポートをトランザクションで包む** — `ItemImportService::processRows()` のループ全体を単一トランザクション内で実行し、ループ先頭で1回だけ `lockForUpdate()` で `max()` を取得、以降はインクリメントで採番する:
```php
DB::transaction(function () use ($rows, $auctionId) {
    $nextNumber = (Item::where('auction_id', $auctionId)
        ->lockForUpdate()->max('item_number') ?? 0) + 1;
    foreach ($rows as $row) {
        $row['item_number'] = $nextNumber++;
        $this->createItem($row);
    }
}, 3);
```

### 影響範囲
- 出品者・管理者両方のアイテム登録、CSV一括インポート
- 修正リスク: 中（トランザクション制御の変更のため十分なテストが必要）

---

## Bug③: 管理者画面 - 新規登録時にステータスが常に「承認済み」になる

### 現象
管理者画面で生体を新規登録する際、ステータスを「審査中」「キャンセル」で登録しても「承認済み」として登録される。

- 審査中 → 承認済み
- 承認済み → 承認済み
- キャンセル → 承認済み

### 原因
**ファイル:** `app/Http/Controllers/Admin/ItemController.php`

#### 2つの問題
1. **バリデーション（109-123行目）**: `status` フィールドがバリデーションルールに含まれていないため、リクエストで送信された `status` 値が無視される
2. **ステータスのハードコード（158行目）**: `Item::create()` で `'status' => 'registered'` とハードコードされており、リクエスト値を参照していない

```php
// 現状（store メソッド）
$item = Item::create([
    // ...
    'status' => 'registered',  // ← ハードコードされている
]);
```

> 参考: 同ファイルの `update()` メソッド（285行目, 308行目）では `status` のバリデーションとリクエスト値の使用が正しく実装されている。

### 修正方針

1. **バリデーションに `status` を追加**:
```php
$validator = Validator::make($request->all(), [
    // 既存のルール...
    'status' => 'nullable|in:draft,registered,cancelled',
]);
```

2. **`Item::create()` でリクエスト値を使用**:
```php
$item = Item::create([
    // ...
    'status' => $request->input('status', 'registered'), // デフォルトは registered
]);
```

### 影響範囲
- 管理者画面からの生体新規登録のみ（更新は正常動作）
- 修正リスク: 小

---

## Bug④: スマホ - サイドバーが閉じない / グレーアウト

### 現象
1. スマホでサイドバーの各項目をタップすると画面は切り替わるがサイドバーが閉じない
2. サイドメニューからタブの切り替えを行うと画面全体がグレーアウトして操作不可能になる

### 原因
**関連ファイル:**
- `resources/ts/layouts/ParticipantLayout.tsx` (131行目)
- `resources/ts/layouts/AdminLayout.tsx` (401-412行目)
- `resources/ts/layouts/SellerLayout.tsx` (337-348行目)

#### 問題1: ルート変更時にDrawerが自動で閉じない
全3レイアウトで、`useEffect` によるルート変更監視が実装されていない。ナビゲーション項目のクリックハンドラ内で `setDrawerOpen(false)` を呼んでいるが、遷移に時間がかかる場合やエラー発生時にDrawerが閉じないことがある。

#### 問題2: ParticipantLayout の ModalProps 欠落
`ParticipantLayout.tsx` の Drawer に `ModalProps={{ keepMounted: true }}` が設定されていない（AdminLayout / SellerLayout には設定済み）。これにより、バックドロップのDOM要素が適切にクリーンアップされず、画面がグレーアウトする。

#### 問題3: ログアウト時の競合
ログアウト処理が非同期であるため、Drawer の閉じるタイミングとナビゲーションの完了タイミングに競合が生じ、バックドロップが残存する可能性がある。

### 修正方針

1. **全レイアウトに `useEffect` でルート変更監視を追加**:
```tsx
const location = useLocation();

useEffect(() => {
    setMobileOpen(false); // or setDrawerOpen(false)
}, [location.pathname]);
```

2. **ParticipantLayout に `ModalProps` を追加**:
```tsx
<Drawer
    anchor="left"
    open={drawerOpen}
    onClose={() => setDrawerOpen(false)}
    ModalProps={{ keepMounted: true }}  // 追加
>
```

3. **ログアウト処理の改善**: Drawer を閉じてからログアウト処理を実行する順序を明確にする。

### 影響範囲
- 全画面のモバイル表示（管理者・出品者・参加者）
- 修正リスク: 小（UI制御の改善のみ）

---

## 修正優先度

| Bug | 重大度 | 修正リスク | 優先度 |
|-----|--------|-----------|--------|
| ① Storage未インポート | 高（機能不全） | 極小 | **即時対応** |
| ③ ステータスハードコード | 高（データ不整合） | 小 | **即時対応** |
| ④ サイドバー/グレーアウト | 中（UX障害） | 小 | **高** |
| ② デッドロック | 高（並行時障害） | 中 | **高** |
