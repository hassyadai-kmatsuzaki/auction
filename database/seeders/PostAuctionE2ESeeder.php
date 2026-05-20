<?php

namespace Database\Seeders;

use App\Actions\Auction\FinishAuctionAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerSettlement;
use App\Models\User;
use App\Models\WonItem;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * E2E 用に「落札後」の状態を一括投入する seeder。
 *
 * 前提:
 *   - E2EAuctionSeeder + E2ESellerSeeder + E2EItemSeeder + E2EBidderSeeder が
 *     既に走っており、対象 auction が is_test=true / status='scheduled' or 'preparing' /
 *     items.status='registered' / lanes 割当済みであること。
 *
 * 仕上がる状態:
 *   - auction.status = 'finished' / end_time 打刻
 *   - lanes.status = 'finished'
 *   - 既定 90% の items が 'sold'、残り 10% が 'unsold'
 *   - sold な item ごとに won_items が 1 行（winner は is_test=true な bidder からラウンドロビン）
 *   - won_items.payment/delivery_status は決定論的に 3 バケットへ分散
 *       (sold_index-1) % 3 == 0  → pending  / pending
 *       (sold_index-1) % 3 == 1  → paid     / preparing
 *       (sold_index-1) % 3 == 2  → confirmed/ preparing
 *     さらに各レーンで最後に sold した 1 件を shipped へ上書き
 *   - shipping_fee は FinishAuctionAction::calculateShippingForAuction()
 *     を通して新配送ロジック経由で算出
 *   - seller_settlements は (auction_id, seller_profile_id) ごとに pending を firstOrCreate し
 *     recalculateTotals() で合計を埋める
 *   - auction_seller_shipments は意図的に空のまま（伝票登録 UI 検証用）
 *
 * 安全性:
 *   - 対象 auction が is_test=false なら abort
 *   - 既存 won_items が 1 件でもあれば abort（再実行で破壊しない）
 *   - winners は users.is_test=true / status='approved' / is_active=true に限定
 *   - 1 won_item = 1 transaction
 *
 * 明示起動のみ:
 *   sudo -u ec2-user E2E_POST_AUCTION_ID=<auction_id> \
 *       php artisan db:seed --class=PostAuctionE2ESeeder
 *
 * 環境変数:
 *   E2E_POST_AUCTION_ID                   … 対象 auction_id（必須）
 *   E2E_POST_SOLD_RATIO                   … 何%を sold にするか 0〜1 (default 0.9)
 *   E2E_POST_BIDDER_EMAIL_PREFIX          … E2EBidderSeeder と同じ prefix (default "e2e-bidder")
 *   E2E_POST_BIDDER_EMAIL_DOMAIN          … E2EBidderSeeder と同じ domain (default "medaka-test.local")
 */
class PostAuctionE2ESeeder extends Seeder
{
    public function run(): void
    {
        $auctionIdRaw = env('E2E_POST_AUCTION_ID');
        if ($auctionIdRaw === null || $auctionIdRaw === '') {
            throw new RuntimeException('E2E_POST_AUCTION_ID is required.');
        }
        $auctionId   = (int) $auctionIdRaw;
        $soldRatio   = (float) env('E2E_POST_SOLD_RATIO', 0.9);
        $emailPrefix = (string) env('E2E_POST_BIDDER_EMAIL_PREFIX', 'e2e-bidder');
        $emailDomain = (string) env('E2E_POST_BIDDER_EMAIL_DOMAIN', 'medaka-test.local');

        if ($soldRatio < 0 || $soldRatio > 1) {
            throw new RuntimeException('E2E_POST_SOLD_RATIO must be in [0, 1]');
        }

        $auction = Auction::find($auctionId);
        if (!$auction) {
            throw new RuntimeException("auction_id={$auctionId} が見つかりません。");
        }
        if (!$auction->is_test) {
            throw new RuntimeException(
                "auction_id={$auctionId} は is_test=false です。本番事故防止のため abort します。"
            );
        }

        // 既存の won_items を一切壊さないため、対象 auction に紐づく won_items が
        // 1 件でもあれば abort（再実行は明示的な手動クリアを要する）
        $existingWon = WonItem::whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))->count();
        if ($existingWon > 0) {
            throw new RuntimeException(sprintf(
                'auction_id=%d には既に won_items が %d 件あります。手動で削除してから再実行してください。',
                $auctionId, $existingWon
            ));
        }

        $items = Item::where('auction_id', $auctionId)
            ->orderBy('item_number')
            ->get();
        if ($items->isEmpty()) {
            throw new RuntimeException(
                "auction_id={$auctionId} に items がありません。先に E2EItemSeeder を実行してください。"
            );
        }

        $bidders = $this->resolveTestBidders($emailPrefix, $emailDomain);
        if ($bidders->isEmpty()) {
            throw new RuntimeException(
                "is_test=true な落札候補ユーザーがいません。先に E2EBidderSeeder を実行してください。"
            );
        }

        // ── 1. sold/unsold 振り分け（決定論的: item_number % 10 == 0 を unsold 優先） ──
        $soldItems   = [];
        $unsoldItems = [];
        $targetSold  = (int) round($items->count() * $soldRatio);

        foreach ($items as $item) {
            // item_number % 10 == 0 は unsold 寄りにしたい。それ以外は sold 候補。
            // ただし最終的に soldCount が targetSold ぴったりになるよう、後段で調整する。
            if ($item->item_number % 10 === 0) {
                $unsoldItems[] = $item;
            } else {
                $soldItems[] = $item;
            }
        }

        // sold が多すぎる場合は item_number 降順で unsold へ移す
        while (count($soldItems) > $targetSold) {
            $moved = array_pop($soldItems);
            $unsoldItems[] = $moved;
        }
        // sold が足りない場合は unsold から item_number 昇順で sold へ戻す（item_number % 10 == 0 のもの）
        usort($unsoldItems, fn ($a, $b) => $a->item_number <=> $b->item_number);
        while (count($soldItems) < $targetSold && !empty($unsoldItems)) {
            $moved = array_shift($unsoldItems);
            $soldItems[] = $moved;
        }
        usort($soldItems, fn ($a, $b) => $a->item_number <=> $b->item_number);

        // ── 2. auction を finished に揃える（events 発火は不要） ──
        DB::transaction(function () use ($auction, $unsoldItems) {
            $unsoldIds = array_map(fn ($i) => $i->id, $unsoldItems);
            if (!empty($unsoldIds)) {
                Item::whereIn('id', $unsoldIds)->update(['status' => 'unsold']);
            }
            Lane::where('auction_id', $auction->id)->update([
                'status'          => 'finished',
                'current_item_id' => null,
            ]);
            $auction->forceFill([
                'status'   => 'finished',
                'end_time' => $auction->end_time ?? now()->format('H:i:s'),
            ])->save();
        });

        // ── 3. sold 1件ごとに won_item を作成（FinalizeBidAction と同じ計算式） ──
        $paymentDeadline = now()->next(Carbon::WEDNESDAY)->endOfDay();
        $createdWon      = 0;

        foreach ($soldItems as $idx => $item) {
            $winner = $bidders[$idx % $bidders->count()];

            $finalPrice    = (float) $item->current_price;
            $quantity      = (int) $item->quantity;
            $totalBase     = $finalPrice * $quantity;
            $feeSettings   = $auction->getFeeSettings();
            $commissionRate = (float) $feeSettings['buyer_commission_rate'];
            $commissionAmt = (float) $auction->calculateBuyerCommission($totalBase);
            $totalAmount   = $totalBase + $commissionAmt;
            $sellerAmt     = $totalBase - (float) $auction->calculateSellerCommission($totalBase);

            // 状態バケットの決定 (sold_index は 1 始まりで連番)
            $soldIndex = $idx + 1;
            $bucket    = ($soldIndex - 1) % 3; // 0=pending, 1=paid, 2=confirmed
            $stateOverride = $this->resolveStateOverride($bucket, $paymentDeadline);

            DB::transaction(function () use (
                $item, $winner, $finalPrice, $quantity, $totalAmount,
                $commissionRate, $commissionAmt, $sellerAmt,
                $stateOverride, $paymentDeadline
            ) {
                Item::where('id', $item->id)->update(['status' => 'sold']);

                WonItem::create(array_merge([
                    'item_id'           => $item->id,
                    'winner_id'         => $winner->id,
                    'winning_price'     => $finalPrice,
                    'quantity'          => $quantity,
                    'total_amount'      => $totalAmount,
                    'commission_rate'   => $commissionRate,
                    'commission_amount' => $commissionAmt,
                    'seller_amount'     => $sellerAmt,
                    'payment_deadline'  => $paymentDeadline,
                    // 落札者の登録住所をデフォルト配送先としてコピー
                    'shipping_postal_code'   => $winner->postal_code,
                    'shipping_prefecture'    => $winner->prefecture,
                    'shipping_city'          => $winner->city,
                    'shipping_address_line1' => $winner->address_line1,
                    'shipping_address_line2' => $winner->address_line2,
                    'shipping_name'          => $winner->name,
                    'shipping_phone'         => $winner->phone,
                ], $stateOverride));
            });

            $createdWon++;
        }

        // ── 4. 各レーン末尾 1 件を shipped に上書き（ヤマト運輸の架空伝票） ──
        $shippedCount = $this->markLastSoldPerLaneAsShipped($auctionId);

        // ── 5. 新配送ロジックを実コード経由で叩く ──
        // FinishAuctionAction::calculateShippingForAuction() は例外を catch して
        // Log::warning だけして抜ける実装になっているため、計算失敗を気付けるよう
        // 直後に shipping_calculated_at の到達率を自前で検証する。
        app(FinishAuctionAction::class)->calculateShippingForAuction($auction->fresh());

        $missingShipping = WonItem::query()
            ->whereHas('item', fn ($q) => $q->where('auction_id', $auctionId))
            ->whereNull('shipping_calculated_at')
            ->count();
        if ($missingShipping > 0) {
            $this->command->warn(sprintf(
                '⚠ %d 件の won_items で shipping_calculated_at が null です。配送料計算が失敗した可能性があります。'
                . ' 確認ポイント: prefecture_regions が seed 済みか / SystemSetting に送料系設定があるか / storage/logs/laravel.log に warning が無いか',
                $missingShipping
            ));
        }

        // ── 6. seller_settlements を pending で確定 + 合計再計算 ──
        $sellerProfileIds = Item::where('auction_id', $auctionId)
            ->whereNotNull('seller_profile_id')
            ->distinct()
            ->pluck('seller_profile_id');
        $settlementCount = 0;
        foreach ($sellerProfileIds as $spid) {
            $settlement = SellerSettlement::firstOrCreate(
                ['auction_id' => $auctionId, 'seller_profile_id' => $spid],
                ['status' => SellerSettlement::STATUS_PENDING],
            );
            $settlement->recalculateTotals();
            $settlementCount++;
        }

        $this->command->info(sprintf(
            'PostAuctionE2ESeeder: auction_id=%d / sold=%d / unsold=%d / won_items=%d / shipped=%d / settlements=%d',
            $auctionId,
            count($soldItems),
            count($unsoldItems),
            $createdWon,
            $shippedCount,
            $settlementCount
        ));
        $this->command->info('-> 確認 UI:');
        $this->command->info('   出品者: /seller/settlements , /seller/shipments');
        $this->command->info('   管理者: /admin/settlements , /admin/shipments');
        $this->command->info('   PDF:    /admin/documents/payment-notices (オークション=' . $auctionId . ')');
    }

    /**
     * 状態バケットに応じた payment/delivery 関連カラムの上書きを返す。
     *
     * @return array<string, mixed>
     */
    private function resolveStateOverride(int $bucket, Carbon $paymentDeadline): array
    {
        $now = now();

        return match ($bucket) {
            // pending / pending
            0 => [
                'payment_status'   => 'pending',
                'delivery_status'  => 'pending',
            ],
            // paid / preparing
            1 => [
                'payment_status'   => 'paid',
                'payment_method'   => 'bank_transfer',
                'paid_at'          => $now->copy()->subDay(),
                'delivery_status'  => 'preparing',
            ],
            // confirmed / preparing （= 入金確認済み、shipping_locked_at も打刻）
            2 => [
                'payment_status'        => 'confirmed',
                'payment_method'        => 'bank_transfer',
                'paid_at'               => $now->copy()->subDays(2),
                'payment_confirmed_at'  => $now->copy()->subDay(),
                'shipping_locked_at'    => $now->copy()->subDay(),
                'delivery_status'       => 'preparing',
            ],
            default => [],
        };
    }

    /**
     * 各レーンで最後に sold した won_item 1 件を shipped に上書きする。
     * 戻り値は更新件数。lanes が無い auction では 0 を返す。
     */
    private function markLastSoldPerLaneAsShipped(int $auctionId): int
    {
        $lanes = Lane::where('auction_id', $auctionId)->orderBy('lane_number')->get();
        if ($lanes->isEmpty()) {
            return 0;
        }

        $updated = 0;
        foreach ($lanes as $lane) {
            // lane_items 経由で、このレーンに属する sold な item の中で
            // sequence_order が最大のものを 1 件選ぶ
            $lastWon = WonItem::query()
                ->join('items', 'won_items.item_id', '=', 'items.id')
                ->join('lane_items', 'lane_items.item_id', '=', 'items.id')
                ->where('lane_items.lane_id', $lane->id)
                ->where('items.status', 'sold')
                ->orderByDesc('lane_items.sequence_order')
                ->select('won_items.*')
                ->first();

            if (!$lastWon) {
                continue;
            }

            $now = now();
            $lastWon->forceFill([
                'payment_status'        => 'confirmed',
                'payment_method'        => 'bank_transfer',
                'paid_at'               => $lastWon->paid_at ?? $now->copy()->subDays(3),
                'payment_confirmed_at'  => $lastWon->payment_confirmed_at ?? $now->copy()->subDays(2),
                'shipping_locked_at'    => $lastWon->shipping_locked_at ?? $now->copy()->subDays(2),
                'delivery_status'       => 'shipped',
                'shipping_company'      => 'ヤマト運輸',
                'tracking_number'       => sprintf('E2E-%04d-%04d', $auctionId, $lastWon->id),
                'shipped_at'            => $now,
            ])->save();

            $updated++;
        }

        return $updated;
    }

    /**
     * is_test=true / status=approved / is_active=true な E2EBidder を email 帯で絞って返す。
     * 候補が見つからなければ「is_test=true な participant 全員」にフォールバックする。
     */
    private function resolveTestBidders(string $emailPrefix, string $emailDomain): \Illuminate\Support\Collection
    {
        $query = User::query()
            ->where('is_test', true)
            ->where('status', 'approved')
            ->where('is_active', true)
            ->whereNotNull('prefecture'); // 住所必須（配送料計算が地域に依存するため）

        // まずは E2EBidderSeeder の email 帯で絞る
        $byPrefix = (clone $query)
            ->where('email', 'like', sprintf('%s%%@%s', $emailPrefix, $emailDomain))
            ->orderBy('id')
            ->get();

        if ($byPrefix->isNotEmpty()) {
            return $byPrefix;
        }

        // フォールバック: participant ロールを持つ is_test ユーザー全員
        return $query
            ->whereHas('roles', fn ($q) => $q->where('name', 'participant'))
            ->orderBy('id')
            ->get();
    }
}
