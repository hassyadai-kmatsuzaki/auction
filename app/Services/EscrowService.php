<?php

namespace App\Services;

use App\Models\EscrowTransaction;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EscrowService
{
    /**
     * 落札時にエスクロー取引を作成
     */
    public function createFromWonItem(WonItem $wonItem): EscrowTransaction
    {
        $wonItem->loadMissing('item.sellerProfile');

        $buyerId = $wonItem->winner_id;
        $sellerId = $wonItem->item->sellerProfile?->user_id;

        // FK制約違反を防ぐ: buyer/seller が存在しなければエラー
        if (!$buyerId || !User::where('id', $buyerId)->exists()) {
            throw new \RuntimeException('買い手ユーザーが存在しません (ID: ' . $buyerId . ')');
        }
        if (!$sellerId || !User::where('id', $sellerId)->exists()) {
            throw new \RuntimeException('出品者ユーザーが存在しません');
        }

        return EscrowTransaction::create([
            'won_item_id' => $wonItem->id,
            'buyer_id' => $buyerId,
            'seller_id' => $sellerId,
            'amount' => (int) $wonItem->total_amount,
            'status' => 'awaiting_payment',
        ]);
    }

    /**
     * 入金確認（エスクロー保持）
     */
    public function confirmPayment(EscrowTransaction $escrow): void
    {
        DB::transaction(function () use ($escrow) {
            $escrow->update([
                'status' => 'payment_held',
                'paid_at' => now(),
            ]);

            // won_item の支払いステータスも更新
            $escrow->wonItem->update(['payment_status' => 'paid']);
        });

        Log::channel('audit')->info('ESCROW_PAYMENT_CONFIRMED', [
            'escrow_id' => $escrow->id,
            'amount' => $escrow->amount,
            'buyer_id' => $escrow->buyer_id,
        ]);
    }

    /**
     * 出品者への支払いリリース（商品到着確認後）
     */
    public function releaseToSeller(EscrowTransaction $escrow): void
    {
        if ($escrow->status !== 'payment_held') {
            throw new \RuntimeException('エスクロー状態が不正です: ' . $escrow->status);
        }

        DB::transaction(function () use ($escrow) {
            $escrow->update([
                'status' => 'released_to_seller',
                'released_at' => now(),
            ]);

            // 配送完了ステータスに更新
            $escrow->wonItem->update(['delivery_status' => 'completed']);
        });

        Log::channel('audit')->info('ESCROW_RELEASED', [
            'escrow_id' => $escrow->id,
            'amount' => $escrow->amount,
            'seller_id' => $escrow->seller_id,
        ]);
    }

    /**
     * 買い手への返金
     */
    public function refund(EscrowTransaction $escrow, string $reason = ''): void
    {
        if (!in_array($escrow->status, ['payment_held', 'disputed'])) {
            throw new \RuntimeException('返金可能な状態ではありません: ' . $escrow->status);
        }

        DB::transaction(function () use ($escrow, $reason) {
            $escrow->update([
                'status' => 'refunded',
                'refunded_at' => now(),
                'notes' => $reason,
            ]);

            $escrow->wonItem->update(['payment_status' => 'refunded']);
        });

        Log::channel('audit')->info('ESCROW_REFUNDED', [
            'escrow_id' => $escrow->id,
            'amount' => $escrow->amount,
            'buyer_id' => $escrow->buyer_id,
            'reason' => $reason,
        ]);
    }

    /**
     * 紛争を開始
     */
    public function openDispute(EscrowTransaction $escrow, string $reason): void
    {
        $escrow->update([
            'status' => 'disputed',
            'notes' => $reason,
        ]);

        Log::channel('audit')->info('ESCROW_DISPUTED', [
            'escrow_id' => $escrow->id,
            'reason' => $reason,
        ]);
    }
}
