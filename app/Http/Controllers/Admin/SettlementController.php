<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\SellerProfile;
use App\Models\SellerSettlement;
use App\Models\WonItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * 管理者向け 出品者精算管理
 *
 * 精算レコードは初回参照時に WonItem から合成して作成される（lazy）。
 * 管理者が status を手動で更新することで精算状態を制御する。
 */
class SettlementController extends Controller
{
    /**
     * 精算一覧取得
     * GET /api/admin/settlements
     */
    public function index(Request $request)
    {
        $filters = [
            'status' => $request->input('status'),
            'auction_id' => $request->input('auction_id'),
            'seller_profile_id' => $request->input('seller_profile_id'),
        ];

        // DBに存在しない精算は WonItem から補完生成
        $this->syncMissingSettlements($filters['auction_id'] ?? null);

        $query = SellerSettlement::query()
            ->with(['auction:id,title,event_date,status', 'sellerProfile:id,seller_code,seller_name', 'paidBy:id,name']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['auction_id'])) {
            $query->where('auction_id', $filters['auction_id']);
        }
        if (!empty($filters['seller_profile_id'])) {
            $query->where('seller_profile_id', $filters['seller_profile_id']);
        }

        $settlements = $query->orderByDesc('id')->paginate($request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $settlements,
        ]);
    }

    /**
     * 精算詳細
     * GET /api/admin/settlements/{id}
     */
    public function show(int $id)
    {
        $settlement = SellerSettlement::with([
            'auction:id,title,event_date,status',
            'sellerProfile',
            'paidBy:id,name',
        ])->findOrFail($id);

        // 最新化
        $settlement->recalculateTotals();

        $wonItems = WonItem::query()
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->where('items.auction_id', $settlement->auction_id)
            ->where('items.seller_profile_id', $settlement->seller_profile_id)
            ->with(['item:id,item_number,species_name,quantity', 'winner:id,name'])
            ->select('won_items.*')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'settlement' => $settlement,
                'items' => $wonItems,
            ],
        ]);
    }

    /**
     * 精算ステータス更新
     * PATCH /api/admin/settlements/{id}
     */
    public function update(Request $request, int $id)
    {
        $v = Validator::make($request->all(), [
            'status' => 'sometimes|in:' . implode(',', SellerSettlement::STATUSES),
            'paid_at' => 'nullable|date',
            'scheduled_payment_date' => 'nullable|date',
            'payment_method' => 'nullable|string|max:50',
            'transaction_reference' => 'nullable|string|max:120',
            'note' => 'nullable|string',
        ]);

        if ($v->fails()) {
            return response()->json(['success' => false, 'errors' => $v->errors()], 422);
        }

        $settlement = SellerSettlement::findOrFail($id);

        DB::transaction(function () use ($settlement, $request) {
            $data = $request->only([
                'status', 'paid_at', 'scheduled_payment_date',
                'payment_method', 'transaction_reference', 'note',
            ]);

            // completed に遷移する場合、paid_at 未指定なら now
            if (($data['status'] ?? null) === SellerSettlement::STATUS_COMPLETED) {
                if (empty($settlement->paid_at) && empty($data['paid_at'])) {
                    $data['paid_at'] = now();
                }
                if (empty($settlement->paid_by)) {
                    $data['paid_by'] = Auth::id();
                }
            }

            // completed 以外に戻すときは paid_* をクリア（誤操作巻き戻し用）
            if (array_key_exists('status', $data) && $data['status'] !== SellerSettlement::STATUS_COMPLETED) {
                if (!$request->has('paid_at')) {
                    $data['paid_at'] = null;
                    $data['paid_by'] = null;
                }
            }

            $settlement->fill($data)->save();
        });

        $settlement->refresh()->load(['auction:id,title,event_date', 'sellerProfile:id,seller_code,seller_name', 'paidBy:id,name']);

        return response()->json([
            'success' => true,
            'message' => '精算情報を更新しました。',
            'data' => $settlement,
        ]);
    }

    /**
     * 精算を「完了」にする簡易エンドポイント
     * POST /api/admin/settlements/{id}/mark-paid
     */
    public function markPaid(Request $request, int $id)
    {
        $v = Validator::make($request->all(), [
            'paid_at' => 'nullable|date',
            'payment_method' => 'nullable|string|max:50',
            'transaction_reference' => 'nullable|string|max:120',
            'note' => 'nullable|string',
        ]);
        if ($v->fails()) {
            return response()->json(['success' => false, 'errors' => $v->errors()], 422);
        }

        $settlement = SellerSettlement::findOrFail($id);
        $settlement->fill([
            'status' => SellerSettlement::STATUS_COMPLETED,
            'paid_at' => $request->input('paid_at', now()),
            'paid_by' => Auth::id(),
            'payment_method' => $request->input('payment_method', $settlement->payment_method),
            'transaction_reference' => $request->input('transaction_reference', $settlement->transaction_reference),
            'note' => $request->input('note', $settlement->note),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => '精算を完了扱いにしました。',
            'data' => $settlement->fresh(['paidBy:id,name']),
        ]);
    }

    /**
     * 金額サマリを WonItem から再集計
     * POST /api/admin/settlements/{id}/recalculate
     */
    public function recalculate(int $id)
    {
        $settlement = SellerSettlement::findOrFail($id);
        $settlement->recalculateTotals();

        return response()->json([
            'success' => true,
            'message' => '金額を再集計しました。',
            'data' => $settlement->fresh(),
        ]);
    }

    /**
     * 指定オークション（または全件）で、WonItem がある (auction, seller) のうち
     * seller_settlements 未作成のものを新規作成する。
     */
    private function syncMissingSettlements(?int $auctionId): void
    {
        $missingQuery = WonItem::query()
            ->join('items', 'won_items.item_id', '=', 'items.id')
            ->whereNotNull('items.seller_profile_id')
            ->when($auctionId, fn ($q) => $q->where('items.auction_id', $auctionId))
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('seller_settlements')
                    ->whereColumn('seller_settlements.auction_id', 'items.auction_id')
                    ->whereColumn('seller_settlements.seller_profile_id', 'items.seller_profile_id');
            })
            ->select('items.auction_id', 'items.seller_profile_id')
            ->groupBy('items.auction_id', 'items.seller_profile_id');

        foreach ($missingQuery->get() as $row) {
            $settlement = SellerSettlement::create([
                'auction_id' => $row->auction_id,
                'seller_profile_id' => $row->seller_profile_id,
                'status' => SellerSettlement::STATUS_PENDING,
            ]);
            $settlement->recalculateTotals();
        }
    }
}
