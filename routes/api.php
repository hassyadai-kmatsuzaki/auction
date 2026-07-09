<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\SetPasswordController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\AnnouncementController as AdminAnnouncementController;
use App\Http\Controllers\Admin\EmailCampaignController as AdminEmailCampaignController;
use App\Http\Controllers\Admin\AuctionController as AdminAuctionController;
use App\Http\Controllers\Admin\SystemSettingController;
use App\Http\Controllers\Admin\LpCvrSettingController;
use App\Http\Controllers\User\AnnouncementController as UserAnnouncementController;
use App\Http\Controllers\Seller\ItemController as SellerItemController;
use App\Http\Controllers\Seller\ProfileController as SellerProfileController;
use App\Http\Controllers\Seller\DashboardController as SellerDashboardController;
use App\Http\Controllers\Seller\ShippingController as SellerShippingController;
use App\Http\Controllers\Seller\SettlementController as SellerSettlementController;
use App\Http\Controllers\Admin\SettlementController as AdminSettlementController;
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
use App\Http\Controllers\Api\ShippingCalculateController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\OptimizedMediaController;
use App\Http\Controllers\Admin\ShippingRateController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\Auth\GoogleAuthController;

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

// Square Webhook（認証不要。HMAC署名で検証）
Route::post('/webhooks/square', [\App\Http\Controllers\Webhook\SquareWebhookController::class, 'handle'])
    ->name('webhooks.square');

// E-NE 外部連携 Webhook（認証不要。HMAC署名で検証。契約締結で承認済み会員を自動作成）
// ライブ非影響: 即202＋notifyキューで非同期。rate.limit でフラッド保護（G2）
Route::post('/webhooks/ene', [\App\Http\Controllers\Webhook\EneWebhookController::class, 'handle'])
    ->middleware('rate.limit:120,1')
    ->name('webhooks.ene');

// 認証API（ゲスト・レート制限付き）
Route::middleware('rate.limit:10,1')->prefix('auth')->group(function () {
    Route::post('/login', [LoginController::class, 'login']);
    Route::post('/register', [RegisterController::class, 'register']);
    Route::post('/forgot-password', [PasswordResetController::class, 'forgot']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
    Route::post('/verify-token', [SetPasswordController::class, 'verify']);
    Route::post('/set-password', [SetPasswordController::class, 'setPassword']);

    // 2FA認証（ログイン時）
    Route::post('/two-factor/verify', [TwoFactorController::class, 'verify']);

    // Google OAuth
    Route::get('/google/redirect', [GoogleAuthController::class, 'redirect']);
    Route::get('/google/callback', [GoogleAuthController::class, 'callback']);
});

// 配送料金計算API（認証必須）
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/shipping/calculate', [ShippingCalculateController::class, 'calculate']);
});

// 画像最適化API（元画像がpublicディスクで公開済みのため認証不要）
Route::get('/media/{mediaId}/optimized', [OptimizedMediaController::class, 'show']);
Route::get('/media/optimized-by-path', [OptimizedMediaController::class, 'showByPath']);

// LINE 通知からアクセスされる請求書PDF（signed URL で保護、有効期限付き）
Route::get('/line/invoices/{auctionId}/{winnerId}', [InvoiceController::class, 'lineDownloadInvoice'])
    ->middleware('signed')
    ->name('line.invoice.download');

// 認証API（認証必須）
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [LoginController::class, 'logout']);
    Route::get('/auth/me', [LoginController::class, 'me']);

    // チュートリアルAPI（全ロール共通）
    Route::get('/tutorials', [\App\Http\Controllers\Api\TutorialController::class, 'index']);
    Route::post('/tutorials/complete', [\App\Http\Controllers\Api\TutorialController::class, 'complete']);

    // マニュアルAPI（全ロール共通）
    Route::get('/manuals', [ManualController::class, 'index']);
    Route::get('/manuals/{id}', [ManualController::class, 'show']);

    // 2FA管理（認証済みユーザー）
    Route::prefix('two-factor')->group(function () {
        Route::get('/status', [TwoFactorController::class, 'status']);
        Route::post('/setup', [TwoFactorController::class, 'setup']);
        Route::post('/confirm', [TwoFactorController::class, 'confirm']);
        Route::delete('/disable', [TwoFactorController::class, 'disable']);
        Route::post('/recovery-codes', [TwoFactorController::class, 'regenerateRecoveryCodes']);
    });

    // 年会費サブスクリプション（ロール問わず利用可）
    Route::prefix('me/subscription')->group(function () {
        Route::get('/', [\App\Http\Controllers\User\SubscriptionController::class, 'show']);
        Route::post('/', [\App\Http\Controllers\User\SubscriptionController::class, 'store']);
        Route::put('/card', [\App\Http\Controllers\User\SubscriptionController::class, 'replaceCard']);
        Route::delete('/', [\App\Http\Controllers\User\SubscriptionController::class, 'cancel']);
    });

    // LINE連携（ロール問わず利用可）
    Route::prefix('line/settings')->group(function () {
        Route::get('/redirect',       [\App\Http\Controllers\Auth\LineAuthController::class, 'redirect']);
        Route::get('/status',          [\App\Http\Controllers\Auth\LineAuthController::class, 'status']);
        Route::delete('/unlink',       [\App\Http\Controllers\Auth\LineAuthController::class, 'unlink']);
        Route::get('/notifications',   [\App\Http\Controllers\Participant\LineSettingsController::class, 'index']);
        Route::put('/notifications',   [\App\Http\Controllers\Participant\LineSettingsController::class, 'update']);
        Route::post('/test',           [\App\Http\Controllers\Participant\LineSettingsController::class, 'test']);
    });
});

// 管理者API
Route::middleware(['auth:sanctum', 'check.role:admin', 'audit'])->prefix('admin')->group(function () {
    Route::get('users-bank-transfer-renewals', [UserController::class, 'bankTransferRenewals']);
    Route::apiResource('users', UserController::class);
    Route::post('users/{id}/restore', [UserController::class, 'restore']);
    Route::post('users/{id}/confirm-bank-transfer', [UserController::class, 'confirmBankTransfer']);
    Route::post('users/{id}/renew-bank-transfer', [UserController::class, 'renewBankTransfer']);
    Route::post('users/{id}/profile-image', [UserController::class, 'uploadProfileImage']);
    Route::delete('users/{id}/profile-image', [UserController::class, 'deleteProfileImage']);
    Route::post('users/{id}/seller-profile-image', [UserController::class, 'uploadSellerProfileImage']);
    Route::delete('users/{id}/seller-profile-image', [UserController::class, 'deleteSellerProfileImage']);
    
    // お知らせ管理
    Route::apiResource('announcements', AdminAnnouncementController::class);
    Route::patch('announcements/{id}/toggle-visibility', [AdminAnnouncementController::class, 'toggleVisibility']);
    Route::post('announcements/generate-content', [AdminAnnouncementController::class, 'generateContent']);

    // メール配信管理
    // preview/test-send は POST だが副作用（DB 書き込み）はないので apiResource の前に置く
    Route::post('email-campaigns/preview', [AdminEmailCampaignController::class, 'preview']);
    Route::post('email-campaigns/test-send', [AdminEmailCampaignController::class, 'testSend']);
    Route::get('email-campaigns', [AdminEmailCampaignController::class, 'index']);
    Route::get('email-campaigns/{id}', [AdminEmailCampaignController::class, 'show'])->whereNumber('id');
    Route::post('email-campaigns', [AdminEmailCampaignController::class, 'store']);
    Route::post('email-campaigns/{id}/cancel', [AdminEmailCampaignController::class, 'cancel'])->whereNumber('id');
    
    // オークション管理
    Route::apiResource('auctions', AdminAuctionController::class);
    Route::patch('auctions/{id}/status', [AdminAuctionController::class, 'updateStatus']);
    Route::patch('auctions/{id}/publish', [AdminAuctionController::class, 'updatePublish']);
    Route::patch('auctions/{id}/lane-count', [AdminAuctionController::class, 'updateLaneCount']);
    Route::get('auctions-item-management', [AdminAuctionController::class, 'itemManagementList']);

    // 行動分析（オークション別 KPI / 生体別 / 誰が / 全体）
    Route::get('analytics/overview', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'overview']);
    Route::get('auctions/{auctionId}/analytics', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'auctionSummary'])->whereNumber('auctionId');
    Route::get('auctions/{auctionId}/analytics/items', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'auctionItems'])->whereNumber('auctionId');
    Route::get('auctions/{auctionId}/analytics/users', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'auctionUsers'])->whereNumber('auctionId');

    // システム設定管理
    Route::get('settings', [SystemSettingController::class, 'index']);
    Route::get('settings/defaults', [SystemSettingController::class, 'getAuctionDefaults']);
    Route::get('settings/{category}', [SystemSettingController::class, 'show']);
    Route::put('settings', [SystemSettingController::class, 'update']);
    Route::get('settings/shipping/rates', [SystemSettingController::class, 'getShippingRates']);
    Route::put('settings/shipping/rates', [SystemSettingController::class, 'updateShippingRates']);

    // LP CVR 設定（買受者LP / 出品者LP の流入経路別CTA URL）
    Route::prefix('lp-cvr/{lpType}')->where(['lpType' => 'buyer|seller'])->group(function () {
        Route::get('/', [LpCvrSettingController::class, 'index']);
        Route::post('/', [LpCvrSettingController::class, 'store']);
        Route::put('/default', [LpCvrSettingController::class, 'updateDefault']);
        Route::put('/{id}', [LpCvrSettingController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [LpCvrSettingController::class, 'destroy'])->whereNumber('id');
    });
    
    // 生体管理
    Route::get('auctions/{auctionId}/items', [AdminItemController::class, 'index']);
    Route::post('auctions/{auctionId}/items', [AdminItemController::class, 'store']);
    
    // 生体一括操作（{id}より前に定義する必要がある）
    Route::get('auctions/{auctionId}/items/selectable-ids', [AdminItemController::class, 'selectableIds']);
    Route::patch('auctions/{auctionId}/items/bulk-status', [AdminItemController::class, 'bulkUpdateStatus']);
    Route::patch('auctions/{auctionId}/items/bulk-anonymous', [AdminItemController::class, 'bulkUpdateAnonymous']);
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
    Route::post('auctions/{auctionId}/lanes/issue-exhibit-codes', [AdminLaneController::class, 'issueExhibitCodes']);
    Route::post('auctions/{auctionId}/lanes/resend-exhibit-codes', [AdminLaneController::class, 'resendExhibitCodeNotifications']);
    
    // 出品者別 伝票番号一覧
    Route::get('auctions/{auctionId}/shipments', [\App\Http\Controllers\Admin\ShipmentController::class, 'index']);

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
    Route::post('auctions/{auctionId}/winners/{winnerId}/calculate-shipping', [AdminWonItemController::class, 'calculateShipping']);
    Route::post('auctions/{auctionId}/winners/{winnerId}/approve-shipping', [AdminWonItemController::class, 'approveShipping']);
    Route::post('auctions/{auctionId}/winners/{winnerId}/manual-shipping-fee', [AdminWonItemController::class, 'setManualShippingFee']);
    Route::get('auctions/{auctionId}/winners/{winnerId}/invoice', [InvoiceController::class, 'adminDownloadInvoice']);
    Route::get('auctions/{auctionId}/winners/{winnerId}/delivery-note', [InvoiceController::class, 'adminDownloadDeliveryNote']);
    Route::get('auctions/{auctionId}/sellers/{sellerId}/payment-notice', [InvoiceController::class, 'adminDownloadPaymentNotice']);

    // 帳票管理（一覧）
    Route::get('documents/invoices', [\App\Http\Controllers\Admin\DocumentController::class, 'invoices']);
    Route::get('documents/payment-notices', [\App\Http\Controllers\Admin\DocumentController::class, 'paymentNotices']);
    Route::get('documents/delivery-notes', [\App\Http\Controllers\Admin\DocumentController::class, 'deliveryNotes']);

    // 配送マスタ管理
    Route::get('shipping-master', [ShippingRateController::class, 'index']);
    Route::put('shipping-master/rates', [ShippingRateController::class, 'updateRates']);
    Route::put('shipping-master/packing-materials', [ShippingRateController::class, 'updatePackingMaterials']);

    // 種別マスタ管理（メダカ / 水草 / 金魚 / その他 …）
    Route::prefix('masters/species-types')->group(function () {
        Route::get('/', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'store']);
        Route::post('/reorder', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'reorder']);
        Route::get('/{id}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'show']);
        Route::patch('/{id}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'destroy']);

        // 袋マスタ（種別配下）
        Route::get('/{id}/bag-specs', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'bagSpecsIndex']);
        Route::post('/{id}/bag-specs', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'bagSpecsStore']);
        Route::patch('/{id}/bag-specs/{specId}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'bagSpecsUpdate']);
        Route::delete('/{id}/bag-specs/{specId}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'bagSpecsDestroy']);

        // 箱入数マスタ
        Route::get('/{id}/box-capacities', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'boxCapacitiesIndex']);
        Route::put('/{id}/box-capacities', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'boxCapacitiesUpsert']);
        Route::delete('/{id}/box-capacities/{capId}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'boxCapacitiesDestroy']);

        // 混載制約
        Route::get('/{id}/mix-restrictions', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'mixRestrictionsIndex']);
        Route::post('/{id}/mix-restrictions', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'mixRestrictionsStore']);
        Route::delete('/{id}/mix-restrictions/{rowId}', [\App\Http\Controllers\Admin\SpeciesTypeController::class, 'mixRestrictionsDestroy']);
    });

    // 品種名（生体名）マスタ。出品申込フォームの入力補助（変換候補）のサジェスト元。
    Route::prefix('masters/species-names')->group(function () {
        Route::get('/', [\App\Http\Controllers\Admin\SpeciesNameController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Admin\SpeciesNameController::class, 'store']);
        Route::post('/reorder', [\App\Http\Controllers\Admin\SpeciesNameController::class, 'reorder']);
        Route::patch('/{id}', [\App\Http\Controllers\Admin\SpeciesNameController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [\App\Http\Controllers\Admin\SpeciesNameController::class, 'destroy'])->whereNumber('id');
    });

    // 撮影ビュー設定（生体名 → 上見/横見）。サムネ向きを生体名で決定的に固定するための軽量マッピング。
    Route::prefix('masters/thumbnail-views')->group(function () {
        Route::get('/', [\App\Http\Controllers\Admin\SpeciesThumbnailViewController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Admin\SpeciesThumbnailViewController::class, 'store']);
        // ビュー未設定の生体名一覧（items から導出）。{id} ルートより前に置く。
        Route::get('/unregistered', [\App\Http\Controllers\Admin\SpeciesThumbnailViewController::class, 'unregistered']);
        Route::patch('/{id}', [\App\Http\Controllers\Admin\SpeciesThumbnailViewController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [\App\Http\Controllers\Admin\SpeciesThumbnailViewController::class, 'destroy'])->whereNumber('id');
        // 既存出品へ撮影ビューを手動で遡及再適用（写真を後から追加した時など）。
        Route::post('/{id}/reapply', [\App\Http\Controllers\Admin\SpeciesThumbnailViewController::class, 'reapply'])->whereNumber('id');
    });

    // 出品者精算管理
    Route::get('settlements', [AdminSettlementController::class, 'index']);
    Route::get('settlements/{id}', [AdminSettlementController::class, 'show']);
    Route::patch('settlements/{id}', [AdminSettlementController::class, 'update']);
    Route::post('settlements/{id}/mark-paid', [AdminSettlementController::class, 'markPaid']);
    Route::post('settlements/{id}/recalculate', [AdminSettlementController::class, 'recalculate']);

    // AI API
    Route::prefix('ai')->group(function () {
        Route::get('/dashboard', [\App\Http\Controllers\Admin\AIController::class, 'dashboard']);
        // 画像認識
        // batch は {itemId} ワイルドカードより前に定義（先食い防止）
        Route::post('/image-analysis/batch/{auctionId}', [\App\Http\Controllers\Admin\AIController::class, 'batchAnalyzeImages']);
        Route::post('/image-analysis/{itemId}', [\App\Http\Controllers\Admin\AIController::class, 'analyzeImage']);
        Route::get('/image-analysis/{itemId}/results', [\App\Http\Controllers\Admin\AIController::class, 'imageAnalysisResults']);
        // 価格予測
        Route::post('/price-prediction/{itemId}', [\App\Http\Controllers\Admin\AIController::class, 'predictPrice']);
        Route::get('/market-trends', [\App\Http\Controllers\Admin\AIController::class, 'marketTrends']);
        // 不正検知
        Route::post('/fraud-detection/{auctionId}', [\App\Http\Controllers\Admin\AIController::class, 'runFraudDetection']);
        Route::get('/fraud-alerts', [\App\Http\Controllers\Admin\AIController::class, 'fraudAlerts']);
        Route::patch('/fraud-alerts/{id}', [\App\Http\Controllers\Admin\AIController::class, 'resolveFraudAlert']);
        // レコメンド
        Route::post('/recommendations/{userId}', [\App\Http\Controllers\Admin\AIController::class, 'generateRecommendations']);
        // NLP
        Route::post('/nlp/extract', [\App\Http\Controllers\Admin\AIController::class, 'extractItemInfo']);
        Route::post('/nlp/classify', [\App\Http\Controllers\Admin\AIController::class, 'classifyCategory']);
    });

    // レポートAPI
    Route::prefix('reports')->group(function () {
        Route::get('/weekly', [\App\Http\Controllers\Admin\ReportController::class, 'weekly']);
        Route::get('/monthly', [\App\Http\Controllers\Admin\ReportController::class, 'monthly']);
        Route::post('/generate', [\App\Http\Controllers\Admin\ReportController::class, 'generate']);
    });

    // CSVエクスポート
    Route::prefix('exports')->group(function () {
        Route::get('/auctions-summary.csv', [\App\Http\Controllers\Admin\CsvExportController::class, 'auctionsSummary']);
        Route::get('/auction-items.csv', [\App\Http\Controllers\Admin\CsvExportController::class, 'auctionItems']);
        Route::get('/members.csv', [\App\Http\Controllers\Admin\CsvExportController::class, 'members']);
        Route::get('/won-items-shipping.csv', [\App\Http\Controllers\Admin\CsvExportController::class, 'wonItemsShipping']);
        Route::get('/favorites.csv', [\App\Http\Controllers\Admin\CsvExportController::class, 'favorites']);
        Route::get('/bid-limits.csv', [\App\Http\Controllers\Admin\CsvExportController::class, 'bidLimits']);
    });

    // 血統証明書管理
    Route::prefix('pedigree')->group(function () {
        Route::get('/{itemId}', [\App\Http\Controllers\Api\PedigreeCertificateController::class, 'show']);
        Route::post('/', [\App\Http\Controllers\Api\PedigreeCertificateController::class, 'store']);
        Route::post('/{id}/issue', [\App\Http\Controllers\Api\PedigreeCertificateController::class, 'issue']);
        Route::get('/{id}/download', [\App\Http\Controllers\Api\PedigreeCertificateController::class, 'download']);
    });

    // エスクロー管理
    Route::prefix('escrow')->group(function () {
        Route::get('/', [\App\Http\Controllers\Admin\EscrowController::class, 'index']);
        Route::post('/{id}/confirm-payment', [\App\Http\Controllers\Admin\EscrowController::class, 'confirmPayment']);
        Route::post('/{id}/release', [\App\Http\Controllers\Admin\EscrowController::class, 'release']);
        Route::post('/{id}/refund', [\App\Http\Controllers\Admin\EscrowController::class, 'refund']);
        Route::post('/{id}/dispute', [\App\Http\Controllers\Admin\EscrowController::class, 'dispute']);
    });

    // プラン管理（年会費）
    // 料金は既存契約者の次回更新分から無告知で適用されるため amount は更新不可。
    // 削除は履歴（subscriptions/payments の plan_id）が壊れるため不可。新規受付停止は is_active トグルで行う。
    Route::apiResource('plans', \App\Http\Controllers\Admin\PlanController::class)->except(['destroy']);

    // サブスクリプション管理
    Route::get('subscriptions', [\App\Http\Controllers\Admin\SubscriptionController::class, 'index']);
    Route::get('subscriptions/{id}', [\App\Http\Controllers\Admin\SubscriptionController::class, 'show']);
    Route::post('subscriptions/{id}/cancel', [\App\Http\Controllers\Admin\SubscriptionController::class, 'cancel']);
    Route::post('subscriptions/{id}/retry', [\App\Http\Controllers\Admin\SubscriptionController::class, 'retry']);

    // 決済履歴管理
    Route::get('payments', [\App\Http\Controllers\Admin\PaymentController::class, 'index']);
    Route::get('payments/{id}', [\App\Http\Controllers\Admin\PaymentController::class, 'show']);
    Route::post('payments/{id}/refund', [\App\Http\Controllers\Admin\PaymentController::class, 'refund']);

    // インフラスケーリング
    Route::prefix('scaling')->group(function () {
        Route::get('/status', [\App\Http\Controllers\Admin\ScalingController::class, 'status']);
        Route::post('/scale-up', [\App\Http\Controllers\Admin\ScalingController::class, 'scaleUp']);
        Route::post('/scale-down', [\App\Http\Controllers\Admin\ScalingController::class, 'scaleDown']);
        Route::post('/release-lock', [\App\Http\Controllers\Admin\ScalingController::class, 'releaseLock']);
    });
});

// メディア編集者API（admin / media_editor の両方が利用可、開催前オークションのみ）
Route::middleware(['auth:sanctum', 'check.role:admin,media_editor', 'audit'])->prefix('media-editor')->group(function () {
    // 開催前オークション一覧
    Route::get('auctions', [\App\Http\Controllers\MediaEditor\AuctionController::class, 'index']);

    // アイテム取得・メディア編集（{auctionId} が preparing / scheduled でなければ 403）
    Route::middleware('ensure.auction.editable')->group(function () {
        Route::get('auctions/{auctionId}/items', [\App\Http\Controllers\MediaEditor\ItemController::class, 'index']);
        Route::get('auctions/{auctionId}/items/{id}', [\App\Http\Controllers\MediaEditor\ItemController::class, 'show']);

        Route::post('auctions/{auctionId}/items/media/bulk-upload', [\App\Http\Controllers\Admin\ItemMediaBulkController::class, 'bulkUpload']);
        Route::post('auctions/{auctionId}/items/{id}/media', [\App\Http\Controllers\MediaEditor\ItemController::class, 'uploadMedia']);
        Route::delete('auctions/{auctionId}/items/{id}/media/{mediaId}', [\App\Http\Controllers\MediaEditor\ItemController::class, 'deleteMedia']);
        Route::put('auctions/{auctionId}/items/{id}/media/reorder', [\App\Http\Controllers\MediaEditor\ItemController::class, 'reorderMedia']);
        Route::patch('auctions/{auctionId}/items/{id}/media/{mediaId}/thumbnail', [\App\Http\Controllers\MediaEditor\ItemController::class, 'setThumbnail']);
    });
});

// 社内ツール用API（admin ロールのみ）
// 仕様: docs/api/internal-item-media-upload.md
Route::middleware(['auth:sanctum', 'check.role:admin'])->prefix('internal')->group(function () {
    Route::post('items/{itemId}/media', [\App\Http\Controllers\Internal\ItemMediaController::class, 'upload'])
        ->whereNumber('itemId');
    Route::get('items/{itemId}/media/{mediaId}', [\App\Http\Controllers\Internal\ItemMediaController::class, 'show'])
        ->whereNumber('itemId')->whereNumber('mediaId');
    Route::patch('items/{itemId}/media/{mediaId}/thumbnail', [\App\Http\Controllers\Internal\ItemMediaController::class, 'setThumbnail'])
        ->whereNumber('itemId')->whereNumber('mediaId');

    // 出品ID（exhibit_code）版アップロード。AI動画パイプライン用（items.id を扱わず紐付け）。
    // exhibit_code は `{レーン}-{3桁ゼロ埋め}` 形式（例 A-001）。レーンは英字1文字。
    Route::post('auctions/{auctionId}/items/{exhibitCode}/media', [\App\Http\Controllers\Internal\ItemMediaController::class, 'uploadByExhibitCode'])
        ->whereNumber('auctionId')
        ->where('exhibitCode', '[A-Za-z]-[0-9]{3}');

    // 出品ID（exhibit_code）版 メディア全削除。撮影パイプラインの「全削除→再作成」用。
    // DBレコードに加え S3実体（本体・自動生成ポスター・無圧縮オリジナル）も削除する。
    // 許可は開催前（preparing/scheduled）のみ。POST と同一トークンで叩ける。
    Route::delete('auctions/{auctionId}/items/{exhibitCode}/media', [\App\Http\Controllers\Internal\ItemMediaController::class, 'deleteAllByExhibitCode'])
        ->whereNumber('auctionId')
        ->where('exhibitCode', '[A-Za-z]-[0-9]{3}');
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
    Route::post('/profile/image', [SellerProfileController::class, 'uploadProfileImage']);
    Route::delete('/profile/image', [SellerProfileController::class, 'deleteProfileImage']);
    
    // 種別マスタ（読み取り専用 - 出品フォームのセレクト用）
    Route::get('/species-types', [\App\Http\Controllers\Seller\SpeciesTypeController::class, 'index']);

    // 品種名（生体名）候補（読み取り専用 - 出品フォームの入力補助用）
    Route::get('/species-names', [\App\Http\Controllers\Seller\SpeciesNameController::class, 'index']);

    // 出品管理（参照は非課金可／作成・編集・削除は allows_sell が必要）
    Route::get('/items', [SellerItemController::class, 'index']);
    Route::get('/items/stats', [SellerItemController::class, 'stats']);
    Route::get('/items/auctions', [SellerItemController::class, 'getAvailableAuctions']);
    Route::get('/items/{id}', [SellerItemController::class, 'show']);
    Route::middleware('check.subscription:sell')->group(function () {
        Route::post('/items', [SellerItemController::class, 'store']);
        Route::put('/items/{id}', [SellerItemController::class, 'update']);
        Route::delete('/items/{id}', [SellerItemController::class, 'destroy']);
    });
    
    // 出品申込時の伝票番号登録
    Route::middleware('check.subscription:sell')->group(function () {
        Route::get('/auctions/{auctionId}/shipments', [\App\Http\Controllers\Seller\ShipmentController::class, 'index']);
        Route::post('/auctions/{auctionId}/shipments', [\App\Http\Controllers\Seller\ShipmentController::class, 'bulkUpsert']);
    });

    // 発送管理
    Route::get('/shipping', [SellerShippingController::class, 'index']);
    Route::post('/shipping/{id}/ship', [SellerShippingController::class, 'ship']);
    Route::put('/shipping/{id}/tracking', [SellerShippingController::class, 'updateTracking']);
    
    // 売上・精算
    Route::get('/settlements', [SellerSettlementController::class, 'index']);
    Route::get('/settlements/{auctionId}', [SellerSettlementController::class, 'show']);
    Route::get('/settlements/{auctionId}/payment-notice', [InvoiceController::class, 'sellerDownloadPaymentNotice']);
});

// 参加者API
Route::middleware(['auth:sanctum', 'check.role:participant'])->prefix('participant')->group(function () {
    // オークション一覧・詳細
    Route::get('/auctions', [ParticipantAuctionController::class, 'index']);
    Route::get('/auctions/{id}', [ParticipantAuctionController::class, 'show']);
    Route::get('/auctions/{id}/live', [ParticipantAuctionController::class, 'live']);
    Route::get('/auctions/{id}/my-won-items', [ParticipantAuctionController::class, 'myWonItems']);
    Route::get('/auctions/{id}/items', [ParticipantAuctionController::class, 'items']);
    
    // 入札（プランの allows_bid が必要 + throttle で連打抑制）
    Route::middleware(['check.subscription:bid', 'throttle:bids'])->group(function () {
        Route::post('/bids', [ParticipantBidController::class, 'toggle']);
    });
    Route::middleware(['check.subscription:bid', 'throttle:bid-limits'])->group(function () {
        Route::post('/bid-limits', [ParticipantBidLimitController::class, 'store']);
        Route::delete('/bid-limits/{itemId}', [ParticipantBidLimitController::class, 'destroy']);
    });
    Route::get('/bids/my-active', [ParticipantBidController::class, 'myActive']);

    // 指値参照は非課金でも可
    Route::get('/bid-limits',          [ParticipantBidLimitController::class, 'index']);
    Route::get('/bid-limits/{itemId}', [ParticipantBidLimitController::class, 'show']);
    
    // 落札商品
    Route::get('/won-items', [ParticipantWonItemController::class, 'index']);
    Route::get('/won-items/{id}', [ParticipantWonItemController::class, 'show']);
    Route::put('/auctions/{auctionId}/address', [ParticipantWonItemController::class, 'updateAddress']);
    Route::get('/auctions/{auctionId}/invoice', [InvoiceController::class, 'downloadInvoice']);
    Route::get('/auctions/{auctionId}/receipt', [InvoiceController::class, 'downloadReceipt']);
    // LINE内ブラウザ等ダウンロード不可環境向け: PDFをメール添付で送信
    Route::post('/auctions/{auctionId}/invoice/email', [InvoiceController::class, 'emailInvoice']);
    Route::post('/auctions/{auctionId}/receipt/email', [InvoiceController::class, 'emailReceipt']);
    
    // 出品者一覧（フィルタ用）
    Route::get('/sellers', function () {
        $sellers = \App\Models\SellerProfile::with('user:id,name')
            ->whereHas('user', fn($q) => $q->where('is_active', true))
            ->get()
            ->map(fn($sp) => ['id' => $sp->id, 'name' => $sp->user->name ?? $sp->display_name ?? "出品者{$sp->id}"]);
        return response()->json(['success' => true, 'data' => $sellers]);
    });

    // 商品検索（出品者・価格帯・人気度フィルタ対応）
    Route::get('/items/search', function (\Illuminate\Http\Request $request) {
        $query = \App\Models\Item::whereIn('status', ['registered', 'live'])
            ->with(['media' => fn($q) => $q->orderBy('display_order')->limit(1)]);

        if ($request->filled('auction_id')) {
            $query->where('auction_id', $request->auction_id);
        }
        if ($request->filled('seller_profile_id')) {
            $query->where('seller_profile_id', $request->seller_profile_id);
        }
        if ($request->filled('species')) {
            $query->where('species_name', 'like', "%{$request->species}%");
        }
        if ($request->filled('price_min')) {
            $query->where('start_price', '>=', (int) $request->price_min);
        }
        if ($request->filled('price_max')) {
            $query->where('start_price', '<=', (int) $request->price_max);
        }
        if ($request->filled('sex')) {
            $query->where('sex', $request->sex);
        }

        $sortBy = $request->get('sort', 'item_number');
        if ($sortBy === 'popularity') {
            // 人気度 = お気に入り数の多い順
            $query->withCount('favorites')->orderByDesc('favorites_count');
        } elseif ($sortBy === 'price_asc') {
            $query->orderBy('start_price');
        } elseif ($sortBy === 'price_desc') {
            $query->orderByDesc('start_price');
        } else {
            $query->orderBy('item_number');
        }

        $items = $query->paginate(30);
        return response()->json(['success' => true, 'data' => $items]);
    });

    // AIレコメンド
    Route::get('/recommendations', function (\Illuminate\Http\Request $request) {
        $service = app(\App\Services\AI\RecommendationService::class);
        $recs = $service->getForUser($request->user()->id);
        return response()->json(['success' => true, 'data' => $recs]);
    });

    // 検索条件保存
    Route::get('/saved-searches', [\App\Http\Controllers\Participant\SavedSearchController::class, 'index']);
    Route::post('/saved-searches', [\App\Http\Controllers\Participant\SavedSearchController::class, 'store']);
    Route::delete('/saved-searches/{id}', [\App\Http\Controllers\Participant\SavedSearchController::class, 'destroy']);

    // 配送追跡
    Route::get('/tracking/{trackingNumber}', [\App\Http\Controllers\Api\TrackingController::class, 'show']);

    // お気に入り（書込みは throttle で抑制）
    Route::get('/favorites', [ParticipantFavoriteController::class, 'index']);
    Route::middleware('throttle:favorites')->group(function () {
        Route::post('/favorites/toggle', [ParticipantFavoriteController::class, 'toggle']);
        Route::post('/favorites/check', [ParticipantFavoriteController::class, 'checkBulk']);
    });

    // 行動計測（会場入場・生体閲覧・当日アクセス）。副作用計測なので throttle で連打抑制。
    Route::middleware('throttle:60,1')->group(function () {
        Route::post('/track', [\App\Http\Controllers\Participant\TrackController::class, 'store']);
    });

    // 評価
    Route::get('/reviews/received', [\App\Http\Controllers\Participant\ReviewController::class, 'received']);
    Route::post('/reviews', [\App\Http\Controllers\Participant\ReviewController::class, 'store']);
    Route::get('/reviews/user/{userId}', [\App\Http\Controllers\Participant\ReviewController::class, 'summary']);

    // 設定
    Route::get('/settings', [ParticipantSettingsController::class, 'index']);
    Route::put('/settings/profile', [ParticipantSettingsController::class, 'updateProfile']);
    Route::put('/settings/notifications', [ParticipantSettingsController::class, 'updateNotificationSettings']);
    Route::post('/settings/notifications/test', [NotificationTestController::class, 'sendParticipantTest']);
    Route::post('/settings/profile/image', [ParticipantSettingsController::class, 'uploadProfileImage']);
    Route::delete('/settings/profile/image', [ParticipantSettingsController::class, 'deleteProfileImage']);

    // LINE連携
    Route::get('/settings/line/redirect',       [\App\Http\Controllers\Auth\LineAuthController::class, 'redirect']);
    Route::get('/settings/line/status',          [\App\Http\Controllers\Auth\LineAuthController::class, 'status']);
    Route::delete('/settings/line/unlink',       [\App\Http\Controllers\Auth\LineAuthController::class, 'unlink']);
    Route::get('/settings/line/notifications',   [\App\Http\Controllers\Participant\LineSettingsController::class, 'index']);
    Route::put('/settings/line/notifications',   [\App\Http\Controllers\Participant\LineSettingsController::class, 'update']);
});
