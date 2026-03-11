<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\SetPasswordController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\AnnouncementController as AdminAnnouncementController;
use App\Http\Controllers\Admin\AuctionController as AdminAuctionController;
use App\Http\Controllers\Admin\SystemSettingController;
use App\Http\Controllers\User\AnnouncementController as UserAnnouncementController;
use App\Http\Controllers\Seller\ItemController as SellerItemController;
use App\Http\Controllers\Seller\ProfileController as SellerProfileController;
use App\Http\Controllers\Seller\DashboardController as SellerDashboardController;
use App\Http\Controllers\Seller\ShippingController as SellerShippingController;
use App\Http\Controllers\Seller\SettlementController as SellerSettlementController;
use App\Http\Controllers\Admin\ItemController as AdminItemController;
use App\Http\Controllers\Admin\LiveController as AdminLiveController;
use App\Http\Controllers\Admin\WonItemController as AdminWonItemController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\LaneController as AdminLaneController;
use App\Http\Controllers\Participant\AuctionController as ParticipantAuctionController;
use App\Http\Controllers\Participant\BidController as ParticipantBidController;
use App\Http\Controllers\Participant\BidLimitController as ParticipantBidLimitController;
use App\Http\Controllers\Participant\WonItemController as ParticipantWonItemController;
use App\Http\Controllers\Participant\SettingsController as ParticipantSettingsController;
use App\Http\Controllers\Participant\FavoriteController as ParticipantFavoriteController;
use App\Http\Controllers\NotificationTestController;
use App\Http\Controllers\ManualController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// ALB ヘルスチェック
Route::get('/health', function () {
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        \Illuminate\Support\Facades\Cache::store('redis')->get('health-check');
        return response()->json(['status' => 'ok'], 200);
    } catch (\Exception $e) {
        return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
});

// LINE Login コールバック（ブラウザからリダイレクトされる。認証はController内で手動チェック）
Route::get('auth/line/callback', [\App\Http\Controllers\Auth\LineAuthController::class, 'callback']);

// 認証API（ゲスト）
Route::prefix('auth')->group(function () {
    Route::post('/login', [LoginController::class, 'login']);
    Route::post('/register', [RegisterController::class, 'register']);
    Route::post('/forgot-password', [PasswordResetController::class, 'forgot']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
    Route::post('/verify-token', [SetPasswordController::class, 'verify']);
    Route::post('/set-password', [SetPasswordController::class, 'setPassword']);
});

// 認証API（認証必須）
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [LoginController::class, 'logout']);
    Route::get('/auth/me', [LoginController::class, 'me']);
    
    // マニュアルAPI（全ロール共通）
    Route::get('/manuals', [ManualController::class, 'index']);
    Route::get('/manuals/{id}', [ManualController::class, 'show']);
});

// 管理者API
Route::middleware(['auth:sanctum', 'check.role:admin'])->prefix('admin')->group(function () {
    Route::apiResource('users', UserController::class);
    Route::post('users/{id}/restore', [UserController::class, 'restore']);
    
    // お知らせ管理
    Route::apiResource('announcements', AdminAnnouncementController::class);
    Route::patch('announcements/{id}/toggle-visibility', [AdminAnnouncementController::class, 'toggleVisibility']);
    Route::post('announcements/generate-content', [AdminAnnouncementController::class, 'generateContent']);
    
    // オークション管理
    Route::apiResource('auctions', AdminAuctionController::class);
    Route::patch('auctions/{id}/status', [AdminAuctionController::class, 'updateStatus']);
    Route::patch('auctions/{id}/lane-count', [AdminAuctionController::class, 'updateLaneCount']);
    Route::get('auctions-item-management', [AdminAuctionController::class, 'itemManagementList']);
    
    // システム設定管理
    Route::get('settings', [SystemSettingController::class, 'index']);
    Route::get('settings/defaults', [SystemSettingController::class, 'getAuctionDefaults']);
    Route::get('settings/{category}', [SystemSettingController::class, 'show']);
    Route::put('settings', [SystemSettingController::class, 'update']);
    Route::get('settings/shipping/rates', [SystemSettingController::class, 'getShippingRates']);
    Route::put('settings/shipping/rates', [SystemSettingController::class, 'updateShippingRates']);
    
    // 生体管理
    Route::get('auctions/{auctionId}/items', [AdminItemController::class, 'index']);
    Route::post('auctions/{auctionId}/items', [AdminItemController::class, 'store']);
    
    // 生体一括操作（{id}より前に定義する必要がある）
    Route::patch('auctions/{auctionId}/items/bulk-status', [AdminItemController::class, 'bulkUpdateStatus']);
    Route::get('auctions/{auctionId}/items/template', [AdminItemController::class, 'downloadTemplate']);
    Route::post('auctions/{auctionId}/items/import', [AdminItemController::class, 'import']);
    Route::get('sellers/list', [AdminItemController::class, 'getSellers']);
    
    // 生体個別操作
    Route::get('auctions/{auctionId}/items/{id}', [AdminItemController::class, 'show']);
    Route::put('auctions/{auctionId}/items/{id}', [AdminItemController::class, 'update']);
    Route::patch('auctions/{auctionId}/items/{id}/status', [AdminItemController::class, 'updateStatus']);
    Route::delete('auctions/{auctionId}/items/{id}', [AdminItemController::class, 'destroy']);
    
    // 生体メディア管理
    Route::post('auctions/{auctionId}/items/media/bulk-upload', [\App\Http\Controllers\Admin\ItemMediaBulkController::class, 'bulkUpload']);
    Route::post('auctions/{auctionId}/items/{id}/media', [AdminItemController::class, 'uploadMedia']);
    Route::delete('auctions/{auctionId}/items/{id}/media/{mediaId}', [AdminItemController::class, 'deleteMedia']);
    Route::put('auctions/{auctionId}/items/{id}/media/reorder', [AdminItemController::class, 'reorderMedia']);
    Route::patch('auctions/{auctionId}/items/{id}/media/{mediaId}/thumbnail', [AdminItemController::class, 'setThumbnail']);
    
    // レーン管理
    Route::get('auctions/{auctionId}/lanes', [AdminLaneController::class, 'index']);
    Route::post('auctions/{auctionId}/lanes/{laneId}/items', [AdminLaneController::class, 'assignItem']);
    Route::delete('auctions/{auctionId}/lanes/{laneId}/items/{itemId}', [AdminLaneController::class, 'removeItem']);
    Route::put('auctions/{auctionId}/lanes/{laneId}/items/reorder', [AdminLaneController::class, 'reorderItems']);
    Route::post('auctions/{auctionId}/lanes/create', [AdminLaneController::class, 'createLane']);
    Route::delete('auctions/{auctionId}/lanes/{laneId}', [AdminLaneController::class, 'deleteLane']);
    Route::put('auctions/{auctionId}/lanes/{laneId}', [AdminLaneController::class, 'updateLane']);
    Route::post('auctions/{auctionId}/lanes/auto-assign', [AdminLaneController::class, 'autoAssign']);
    Route::post('auctions/{auctionId}/lanes/bulk-unassign', [AdminLaneController::class, 'bulkUnassign']);
    
    // 出品者順序管理
    Route::prefix('auctions/{auctionId}/seller-order')->group(function () {
        Route::get('/', [App\Http\Controllers\Admin\SellerOrderController::class, 'index']);
        Route::post('/randomize', [App\Http\Controllers\Admin\SellerOrderController::class, 'randomize']);
        Route::put('/reorder', [App\Http\Controllers\Admin\SellerOrderController::class, 'reorder']);
        Route::put('/{sellerProfileId}/items/reorder', [App\Http\Controllers\Admin\SellerOrderController::class, 'reorderItems']);
    });
    
    // ダッシュボード
    Route::get('dashboard', [AdminDashboardController::class, 'index']);
    Route::get('dashboard/sales-summary', [AdminDashboardController::class, 'salesSummary']);
    
    // ライブオークション管理
    Route::get('live-auctions', [AdminLiveController::class, 'auctionList']);
    Route::get('auctions/{auctionId}/live', [AdminLiveController::class, 'show']);
    Route::post('auctions/{auctionId}/live/start', [AdminLiveController::class, 'start']);
    Route::post('auctions/{auctionId}/live/pause', [AdminLiveController::class, 'pause']);
    Route::post('auctions/{auctionId}/live/resume', [AdminLiveController::class, 'resume']);
    Route::post('auctions/{auctionId}/live/finish', [AdminLiveController::class, 'finish']);
    Route::post('lanes/{laneId}/next-item', [AdminLiveController::class, 'nextItem']);
    Route::patch('items/{itemId}/price', [AdminLiveController::class, 'adjustPrice']);
    Route::get('auctions/{auctionId}/countdown-status', [AdminLiveController::class, 'countdownStatus']);
    // 待機室手動公開・閉鎖
    Route::get('auctions/{auctionId}/entrance-status',  [AdminLiveController::class, 'entranceStatus']);
    Route::post('auctions/{auctionId}/entrance/open',   [AdminLiveController::class, 'openEntrance']);
    Route::post('auctions/{auctionId}/entrance/close',  [AdminLiveController::class, 'closeEntrance']);
    
    // 落札者管理
    Route::get('won-items-auctions', [AdminWonItemController::class, 'auctionList']);
    Route::get('auctions/{auctionId}/won-items', [AdminWonItemController::class, 'index']);
    Route::get('won-items/{id}', [AdminWonItemController::class, 'show']);
    Route::post('won-items/{id}/confirm-payment', [AdminWonItemController::class, 'confirmPayment']);
    Route::post('won-items/{id}/ship', [AdminWonItemController::class, 'ship']);
    Route::post('won-items/{id}/complete', [AdminWonItemController::class, 'complete']);
    Route::patch('won-items/{id}/notes', [AdminWonItemController::class, 'updateNotes']);
});

// ユーザーAPI（参加者・出品者共通）
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/announcements', [UserAnnouncementController::class, 'index']);
    Route::get('/announcements/{id}', [UserAnnouncementController::class, 'show']);
});

// 出品者API
Route::middleware(['auth:sanctum', 'check.role:seller'])->prefix('seller')->group(function () {
    // ダッシュボード
    Route::get('/dashboard', [SellerDashboardController::class, 'index']);
    
    // プロフィール
    Route::get('/profile', [SellerProfileController::class, 'show']);
    Route::put('/profile', [SellerProfileController::class, 'update']);
    Route::put('/profile/bank', [SellerProfileController::class, 'updateBankAccount']);
    Route::put('/profile/notifications', [SellerProfileController::class, 'updateNotificationSettings']);
    Route::put('/profile/display', [SellerProfileController::class, 'updateDisplaySettings']);
    Route::post('/profile/notifications/test', [NotificationTestController::class, 'sendSellerTest']);
    
    // 出品管理
    Route::get('/items', [SellerItemController::class, 'index']);
    Route::get('/items/stats', [SellerItemController::class, 'stats']);
    Route::get('/items/auctions', [SellerItemController::class, 'getAvailableAuctions']);
    Route::post('/items', [SellerItemController::class, 'store']);
    Route::get('/items/{id}', [SellerItemController::class, 'show']);
    Route::put('/items/{id}', [SellerItemController::class, 'update']);
    Route::delete('/items/{id}', [SellerItemController::class, 'destroy']);
    
    // 発送管理
    Route::get('/shipping', [SellerShippingController::class, 'index']);
    Route::post('/shipping/{id}/ship', [SellerShippingController::class, 'ship']);
    Route::put('/shipping/{id}/tracking', [SellerShippingController::class, 'updateTracking']);
    
    // 売上・精算
    Route::get('/settlements', [SellerSettlementController::class, 'index']);
    Route::get('/settlements/{auctionId}', [SellerSettlementController::class, 'show']);
});

// 参加者API
Route::middleware(['auth:sanctum', 'check.role:participant'])->prefix('participant')->group(function () {
    // オークション一覧・詳細
    Route::get('/auctions', [ParticipantAuctionController::class, 'index']);
    Route::get('/auctions/{id}', [ParticipantAuctionController::class, 'show']);
    Route::get('/auctions/{id}/live', [ParticipantAuctionController::class, 'live']);
    Route::get('/auctions/{id}/my-won-items', [ParticipantAuctionController::class, 'myWonItems']);
    Route::get('/auctions/{id}/items', [ParticipantAuctionController::class, 'items']);
    
    // 入札
    Route::post('/bids', [ParticipantBidController::class, 'toggle']);
    Route::get('/bids/my-active', [ParticipantBidController::class, 'myActive']);

    // 指値（上限価格）
    Route::get('/bid-limits',          [ParticipantBidLimitController::class, 'index']);
    Route::post('/bid-limits',         [ParticipantBidLimitController::class, 'store']);
    Route::get('/bid-limits/{itemId}', [ParticipantBidLimitController::class, 'show']);
    Route::delete('/bid-limits/{itemId}', [ParticipantBidLimitController::class, 'destroy']);
    
    // 落札商品
    Route::get('/won-items', [ParticipantWonItemController::class, 'index']);
    Route::get('/won-items/{id}', [ParticipantWonItemController::class, 'show']);
    Route::put('/won-items/{id}/address', [ParticipantWonItemController::class, 'updateAddress']);
    
    // お気に入り
    Route::get('/favorites', [ParticipantFavoriteController::class, 'index']);
    Route::post('/favorites/toggle', [ParticipantFavoriteController::class, 'toggle']);
    Route::post('/favorites/check', [ParticipantFavoriteController::class, 'checkBulk']);

    // 設定
    Route::get('/settings', [ParticipantSettingsController::class, 'index']);
    Route::put('/settings/profile', [ParticipantSettingsController::class, 'updateProfile']);
    Route::put('/settings/notifications', [ParticipantSettingsController::class, 'updateNotificationSettings']);
    Route::post('/settings/notifications/test', [NotificationTestController::class, 'sendParticipantTest']);

    // LINE連携
    Route::get('/settings/line/redirect',       [\App\Http\Controllers\Auth\LineAuthController::class, 'redirect']);
    Route::get('/settings/line/status',          [\App\Http\Controllers\Auth\LineAuthController::class, 'status']);
    Route::delete('/settings/line/unlink',       [\App\Http\Controllers\Auth\LineAuthController::class, 'unlink']);
    Route::get('/settings/line/notifications',   [\App\Http\Controllers\Participant\LineSettingsController::class, 'index']);
    Route::put('/settings/line/notifications',   [\App\Http\Controllers\Participant\LineSettingsController::class, 'update']);
});
