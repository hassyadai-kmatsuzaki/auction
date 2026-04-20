<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\Item;
use App\Models\LineAccount;
use App\Models\LineNotificationSetting;
use App\Models\WonItem;
use App\Services\LineFlexBuilder;
use App\Services\LineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class LineSettingsController extends Controller
{
    public function __construct(
        private readonly LineService $lineService,
        private readonly LineFlexBuilder $flex,
    ) {}

    /** 通知種別の定義 */
    private const NOTIFICATION_TYPES = [
        'auction_start'        => 'オークション開始通知',
        'won_item'             => '落札通知',
        'payment_reminder'     => '入金催促',
        'shipping_completed'   => '発送完了通知',
        'auction_preview'      => 'オークション予告（前日）',
        'bid_limit_reached'    => '指値発動通知',
        'new_auction'          => '新規オークション通知',
        'favorite_approaching' => 'お気に入り順番接近通知',
        'invoice_ready'        => '請求書発行通知（PDFダウンロードリンク付き）',
        // 出品者向け
        'item_sold'            => '出品商品の落札通知（出品者）',
        'payment_received'     => '入金確認通知（出品者）',
    ];

    /** タイプ別のテストメッセージ */
    private const TEST_MESSAGES = [
        'auction_start' => "🔔 [テスト] オークションが開始されました！\n【テスト】第99回メダカライブオークション\n今すぐ参加しましょう！",
        'won_item' => "🎉 [テスト] 落札おめでとうございます！\n【テスト】三色ラメ体外光\n¥15,000/匹\n合計: ¥16,500（税込）",
        'payment_reminder' => "⚠️ [テスト] 入金期限が近づいています\n【テスト】三色ラメ体外光\n期限まで24時間前",
        'shipping_completed' => "📦 [テスト] 発送が完了しました\n【テスト】三色ラメ体外光\n追跡番号: 1234-5678-9012",
        'auction_preview' => "📅 [テスト] 明日オークション開催\n【テスト】第99回メダカライブオークション",
        'bid_limit_reached' => "⚠️ [テスト] 上限価格に到達しました\n【テスト】三色ラメ体外光\n上限: ¥10,000\n現在価格: ¥10,500\n自動的に入札オフになりました",
        'new_auction' => "📢 [テスト] 新しいオークションが追加されました\n【テスト】第99回メダカライブオークション\n開催日: 未定",
        'favorite_approaching' => "⏰ [テスト] お気に入りの【テスト】三色ラメ体外光の出番まであと3つです！\n準備してください！",
        'invoice_ready' => "🧾 [テスト] 請求書が発行されました\n【テスト】第99回メダカライブオークション\n請求金額: ¥16,500（税込）\nPDF ダウンロードリンクをタップしてください。",
        'item_sold' => "🎉 [テスト] 出品した生体が落札されました！\n【テスト】三色ラメ体外光\n落札価格: ¥15,000/匹",
        'payment_received' => "💰 [テスト] 入金が確認されました\n【テスト】三色ラメ体外光\n発送をお願いします。",
    ];

    /** 通知設定一覧を取得 */
    public function index(): JsonResponse
    {
        $userId   = Auth::id();
        $settings = LineNotificationSetting::where('user_id', $userId)->get()->keyBy('notification_type');

        $result = [];
        foreach (self::NOTIFICATION_TYPES as $type => $label) {
            $setting = $settings->get($type);
            $result[] = [
                'type'       => $type,
                'label'      => $label,
                'is_enabled' => $setting ? $setting->is_enabled : true, // デフォルトON
            ];
        }

        return response()->json(['success' => true, 'data' => ['notifications' => $result]]);
    }

    /** 通知設定を一括更新 */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'settings'          => 'required|array',
            'settings.*.type'   => 'required|string|in:' . implode(',', array_keys(self::NOTIFICATION_TYPES)),
            'settings.*.is_enabled' => 'required|boolean',
        ]);

        $userId = Auth::id();

        foreach ($request->settings as $item) {
            LineNotificationSetting::updateOrCreate(
                ['user_id' => $userId, 'notification_type' => $item['type']],
                ['is_enabled' => $item['is_enabled']]
            );
        }

        return response()->json(['success' => true, 'message' => '通知設定を保存しました']);
    }

    /** LINEテスト通知を送信 */
    public function test(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'required|string|in:' . implode(',', array_keys(self::NOTIFICATION_TYPES)),
        ]);

        $userId = Auth::id();
        $type   = $request->input('type');

        $lineAccount = LineAccount::where('user_id', $userId)->where('is_active', true)->first();
        if (!$lineAccount) {
            return response()->json([
                'success' => false,
                'message' => 'LINE連携が必要です。先にLINEと連携してください。',
            ], 400);
        }

        $message = self::TEST_MESSAGES[$type] ?? "[テスト] " . (self::NOTIFICATION_TYPES[$type] ?? '通知');
        $flex    = $this->buildTestFlex($type);

        try {
            $success = $flex
                ? $this->lineService->pushFlex(
                    $lineAccount->line_user_id,
                    mb_substr($message, 0, 200),
                    $flex,
                  )
                : $this->lineService->pushText($lineAccount->line_user_id, $message);
            if (!$success) {
                return response()->json([
                    'success' => false,
                    'message' => 'LINEへの送信に失敗しました。設定をご確認ください。',
                ], 500);
            }

            Log::info('LINEテスト通知送信', ['user_id' => $userId, 'type' => $type]);

            return response()->json([
                'success' => true,
                'message' => 'LINEテスト通知を送信しました。',
            ]);
        } catch (\Throwable $e) {
            Log::error('LINEテスト通知エラー', ['user_id' => $userId, 'type' => $type, 'error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'LINEテスト通知の送信に失敗しました。',
            ], 500);
        }
    }

    /**
     * テスト通知用のダミー Flex を生成する。
     * DB保存しないモデルインスタンスを組み立てて LineFlexBuilder に通すことで、
     * 本番と同一の見た目を保ちつつ依存関係を最小化する。
     */
    private function buildTestFlex(string $type): ?array
    {
        $item = new Item();
        $item->id = 0;
        $item->species_name = '【テスト】三色ラメ体外光';
        $item->thumbnail_path = null;

        $wonItem = new WonItem();
        $wonItem->id = 0;
        $wonItem->winner_id = (int) Auth::id();
        $wonItem->winning_price = 15000;
        $wonItem->quantity = 1;
        $wonItem->total_amount = 16500;
        $wonItem->seller_amount = 12000;
        $wonItem->shipping_fee = 1500;
        $wonItem->shipping_name = '山田 太郎';
        $wonItem->shipping_prefecture = '東京都';
        $wonItem->shipping_city = '渋谷区';
        $wonItem->shipping_company = 'ヤマト運輸';
        $wonItem->tracking_number = '1234-5678-9012';
        $wonItem->payment_deadline = now()->addHours(24);
        $wonItem->setRelation('item', $item);

        $auction = new Auction();
        $auction->id = 0;
        $auction->title = '【テスト】第99回メダカライブオークション';
        $auction->event_date = now()->addDays(7);

        return match ($type) {
            'won_item'             => $this->flex->wonItem($wonItem),
            'payment_reminder'     => $this->flex->paymentReminder($wonItem, '24時間'),
            'shipping_completed'   => $this->flex->shippingCompleted($wonItem),
            'bid_limit_reached'    => $this->flex->bidLimitReached('【テスト】三色ラメ体外光', 10000, 10500),
            'auction_start'        => $this->flex->auctionStart($auction),
            'auction_preview'      => $this->flex->newAuction($auction, 'participant'),
            'new_auction'          => $this->flex->newAuction($auction, 'participant'),
            'favorite_approaching' => $this->flex->favoriteApproaching(0, '【テスト】三色ラメ体外光', 3, 'レーン1', $auction->title),
            'invoice_ready'        => $this->flex->invoiceReady(
                $auction,
                16500,
                (string) config('app.url'),
            ),
            'item_sold'            => $this->flex->itemSold($wonItem),
            'payment_received'     => $this->flex->sellerPaymentReceived($wonItem),
            default                => null,
        };
    }
}
