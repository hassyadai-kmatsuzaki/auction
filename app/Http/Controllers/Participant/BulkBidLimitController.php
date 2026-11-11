<?php

namespace App\Http\Controllers\Participant;

use App\Actions\Bid\SetBidLimitAction;
use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\BidLimitPrice;
use App\Models\Item;
use App\Models\SpeciesType;
use App\Services\TestModeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

/**
 * スタート価格別の一括指値（表示スイッチ bulk_bid_limit・OFF の間は 404）
 *
 * ■ 本番安全の前提:
 *   - 受け付けるのは開催前（auction=scheduled）かつ出品中（item=registered）の生体だけ。
 *     registered の指値は保存のみでライブの入札処理・ロックに触れない。
 *   - 全件を先に検証し、1件でも不正なら何も保存しない。
 *   - 保存は既存の SetBidLimitAction を1件ずつ呼ぶ（items 先行ロックの手順を守る）。
 *   - グループの金額は保存しない（画面上の下書き）。保存されるのは生体ごとの指値。
 */
class BulkBidLimitController extends Controller
{
    /** 1回の確定で受け付ける件数の上限 */
    public const MAX_ITEMS = 500;

    public function __construct(
        private readonly SetBidLimitAction $setLimitAction,
        private readonly TestModeService  $testMode,
    ) {}

    /**
     * 一括指値の対象生体（自分の出品・落札済・取下げを除く）と、各生体の入札単位・現在の指値
     * GET /api/participant/auctions/{auctionId}/bulk-bid-limits
     */
    public function index(int $auctionId): JsonResponse
    {
        abort_unless(config('features.bulk_bid_limit'), 404);

        $auction = $this->visibleAuctionOrNull($auctionId);
        if (!$auction) {
            return response()->json(['success' => false, 'message' => 'オークションが見つかりません。'], 404);
        }

        $userId = Auth::id();
        $items  = $this->eligibleItemsQuery($auction, $userId)
            ->orderBy('item_number')
            ->orderBy('id')
            ->get(['id', 'item_number', 'exhibit_code', 'species_name', 'quantity', 'start_price', 'species_type_id']);

        $limits = BidLimitPrice::where('user_id', $userId)
            ->whereIn('item_id', $items->pluck('id'))
            ->get()
            ->keyBy('item_id');

        return response()->json(['success' => true, 'data' => [
            'auction' => ['id' => $auction->id, 'title' => $auction->title, 'status' => $auction->status],
            'is_open' => $this->isOpen($auction),
            // 受付締切（開始の N 分前）。画面の案内文に使う
            'closes_at'     => $this->closesAt($auction)->toIso8601String(),
            'close_minutes' => $this->closeMinutes(),
            // 開催ごとの「金額帯別上昇幅テーブル」（管理画面の設定どおり）。画面の「入札単位」表と
            // 価格帯をまたぐ上乗せ計算に使う。テーブル未設定の回は空配列＋ rate/min にフォールバック
            'increment_tiers' => $this->incrementTiers($auction),
            'increment_rate'  => (float) $auction->getPriceIncrementRate(),
            'increment_min'   => (int) $auction->getPriceIncrementMin(),
            'items'   => $items->map(fn (Item $item) => [
                'id'           => $item->id,
                'item_number'  => $item->item_number,
                'exhibit_code' => $item->exhibit_code,
                'species_name' => $item->species_name,
                'quantity'     => $item->quantity,
                'start_price'  => (int) floor($item->start_price),
                'unit'         => $auction->calculatePriceIncrement((int) floor($item->start_price)),
                'limit_price'  => ($l = $limits->get($item->id)) ? (int) floor($l->limit_price) : null,
                // メダカ（デフォルト種別）以外＝金魚・エビ等。画面では「その他」タブにまとめ、一括入札の対象外
                'is_other'     => $this->isOtherSpecies($item),
            ])->values(),
        ]]);
    }

    /**
     * 一括確定
     * POST /api/participant/auctions/{auctionId}/bulk-bid-limits
     * { "limits": [ { "item_id": 1, "limit_price": 3000 }, ... ] }
     */
    public function store(Request $request, int $auctionId): JsonResponse
    {
        abort_unless(config('features.bulk_bid_limit'), 404);

        $validator = Validator::make($request->all(), [
            'limits'               => 'required|array|min:1|max:' . self::MAX_ITEMS,
            'limits.*.item_id'     => 'required|integer|distinct',
            'limits.*.limit_price' => 'required|integer|min:1|max:' . SetBidLimitAction::MAX_LIMIT_PRICE,
        ], [
            'limits.max'                => '一度に確定できるのは' . self::MAX_ITEMS . '点までです。',
            'limits.*.item_id.distinct' => '同じ生体が重複しています。',
            'limits.*.limit_price.max'  => '上限価格は¥' . number_format(SetBidLimitAction::MAX_LIMIT_PRICE) . '以下を指定してください。',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $auction = $this->visibleAuctionOrNull($auctionId);
        if (!$auction) {
            return response()->json(['success' => false, 'message' => 'オークションが見つかりません。'], 404);
        }
        if (!$this->isOpen($auction)) {
            return response()->json(['success' => false, 'message' => $this->closedMessage($auction)], 422);
        }

        $userId = Auth::id();
        $prices = collect($request->input('limits'))
            ->mapWithKeys(fn ($l) => [(int) $l['item_id'] => (int) $l['limit_price']]);

        $items = $this->eligibleItemsQuery($auction, $userId)
            ->whereIn('id', $prices->keys())
            ->get()
            ->keyBy('id');

        // ── 先に全件検証（1件でも不正なら何も保存しない） ──
        $errors = [];
        foreach ($prices as $itemId => $price) {
            $item = $items->get($itemId);
            if (!$item) {
                $errors[] = ['item_id' => $itemId, 'message' => 'この生体は一括入札の対象外です。'];
                continue;
            }
            if ($this->isOtherSpecies($item)) {
                $errors[] = ['item_id' => $itemId, 'message' => 'その他の種別は一括入札の対象外です。上限設定から個別に入札してください。'];
                continue;
            }
            $start = (int) floor($item->start_price);
            // 個別の上限設定（BidLimitController）と同じく 1円単位で受け付ける。開始価格未満だけ拒否
            if ($price < $start) {
                $errors[] = ['item_id' => $itemId, 'message' => '開始価格（¥' . number_format($start) . '）未満です。'];
            }
        }
        if ($errors) {
            return response()->json([
                'success' => false,
                'message' => '入力内容に誤りがあるため、確定していません。',
                'data'    => ['errors' => $errors],
            ], 422);
        }

        // ── 保存（既存の1件ずつの処理をそのまま使う） ──
        $saved  = [];
        $failed = [];
        foreach ($prices as $itemId => $price) {
            // 一括はお気に入り自動登録なし（11/9 フィードバック）
            $result = $this->setLimitAction->execute($items->get($itemId), $userId, (float) $price, autoFavorite: false);
            if ($result->success) {
                $saved[] = $itemId;
            } else {
                $failed[] = ['item_id' => $itemId, 'message' => $result->message];
            }
        }

        return response()->json([
            'success' => empty($failed),
            'message' => empty($failed)
                ? count($saved) . '点の事前入札を確定しました。'
                : count($saved) . '点を確定、' . count($failed) . '点は確定できませんでした。',
            'data'    => ['saved_item_ids' => $saved, 'errors' => $failed],
        ], empty($failed) ? 200 : 207);
    }

    /**
     * 金額帯別上昇幅テーブルを from_price 昇順に整形（to_price は null=上限なし）
     */
    private function incrementTiers(Auction $auction): array
    {
        $tiers = collect($auction->getPriceIncrementTiers())
            ->map(fn ($t) => [
                'from_price'       => (int) ($t['from_price'] ?? 0),
                'to_price'         => isset($t['to_price']) && $t['to_price'] !== '' ? (int) $t['to_price'] : null,
                'increment_amount' => (int) ($t['increment_amount'] ?? 0),
            ])
            ->filter(fn ($t) => $t['increment_amount'] > 0)
            ->sortBy('from_price')
            ->values();
        return $tiers->all();
    }

    private ?int $defaultSpeciesTypeId = null;

    /**
     * 種別がデフォルト（メダカ）以外か。種別未設定（NULL）はメダカ扱い
     */
    private function isOtherSpecies(Item $item): bool
    {
        if ($item->species_type_id === null) {
            return false;
        }
        $this->defaultSpeciesTypeId ??= (int) SpeciesType::where('is_default', true)->value('id');
        return (int) $item->species_type_id !== $this->defaultSpeciesTypeId;
    }

    /** 受付締切は開始の N 分前（config features.bulk_bid_limit_close_minutes、既定 5） */
    private function closeMinutes(): int
    {
        return max(0, (int) config('features.bulk_bid_limit_close_minutes', 5));
    }

    private function closesAt(Auction $auction): \Carbon\Carbon
    {
        return $auction->event_date_time->copy()->subMinutes($this->closeMinutes());
    }

    /** 開催前（scheduled）かつ締切前なら受付中 */
    private function isOpen(Auction $auction): bool
    {
        return $auction->status === 'scheduled' && now()->lt($this->closesAt($auction));
    }

    private function closedMessage(Auction $auction): string
    {
        if ($auction->status === 'scheduled') {
            return 'まとめて事前入札の受付はオークション開始' . $this->closeMinutes() . '分前に終了しました。1点ずつの上限設定は開始までできます。';
        }
        return '事前入札の受付は終了しました。';
    }

    private function visibleAuctionOrNull(int $auctionId): ?Auction
    {
        $q = Auction::query()->where('id', $auctionId)->where('status', '!=', 'preparing');
        $this->testMode->applyToAuctionQuery($q);
        return $q->first();
    }

    /**
     * 一括指値の対象: 出品中（registered）のみ。落札済・不成立・取下げ・ライブ中と自分の出品は含めない
     */
    private function eligibleItemsQuery(Auction $auction, int $userId)
    {
        $q = Item::query()
            ->where('auction_id', $auction->id)
            ->where('status', 'registered')
            ->whereDoesntHave('sellerProfile', fn ($s) => $s->where('user_id', $userId));
        $this->testMode->applyToItemQuery($q);
        return $q;
    }
}
