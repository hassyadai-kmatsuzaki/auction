<?php

namespace App\Services;

use App\Mail\AuctionStartNotificationMail;
use App\Mail\ItemSoldNotificationMail;
use App\Mail\NewAuctionNotificationMail;
use App\Mail\PaymentConfirmedMail;
use App\Mail\SellerPaymentReceivedMail;
use App\Mail\ShippingNotificationMail;
use App\Mail\WonItemNotificationMail;
use App\Jobs\SendLineNotificationJob;
use App\Models\Auction;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    // ─── LINE通知ヘルパー ────────────────────────────────────────

    /** LINE通知を非同期で送信 */
    private function sendLineNotification(int $userId, string $type, string $text): void
    {
        try {
            SendLineNotificationJob::dispatch($userId, $type, $text);
        } catch (\Exception $e) {
            Log::warning("LINE notification dispatch failed: {$type} user={$userId} - " . $e->getMessage());
        }
    }

    /**
     * 落札通知を送信（買受者向け）
     */
    public function sendWonItemNotification(WonItem $wonItem): bool
    {
        try {
            $user = $wonItem->user;
            if (!$user || !$user->email) {
                return false;
            }

            // 通知設定確認
            if (!$this->shouldSendParticipantNotification($user, 'email_won_item')) {
                Log::info('通知スキップ: 買受者が落札通知を無効化', ['user_id' => $user->id]);
                return false;
            }

            Mail::to($user->email)->queue(new WonItemNotificationMail($wonItem));

            // LINE通知
            $item = $wonItem->item;
            $lineText = "🎉 落札おめでとうございます！\n"
                . ($item ? $item->species_name : '商品') . "\n"
                . "¥" . number_format($wonItem->winning_price) . "/匹\n"
                . "合計: ¥" . number_format($wonItem->total_amount) . "（税込）";
            $this->sendLineNotification($user->id, 'won_item', $lineText);

            Log::info('落札通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('落札通知送信エラー', ['error' => $e->getMessage(), 'won_item_id' => $wonItem->id]);
            return false;
        }
    }

    /**
     * 入金確認通知を送信（買受者向け）
     */
    public function sendPaymentConfirmedNotification(WonItem $wonItem): bool
    {
        try {
            $user = $wonItem->user;
            if (!$user || !$user->email) {
                return false;
            }

            // 通知設定確認
            if (!$this->shouldSendParticipantNotification($user, 'email_payment_confirmed')) {
                Log::info('通知スキップ: 買受者が入金確認通知を無効化', ['user_id' => $user->id]);
                return false;
            }

            Mail::to($user->email)->queue(new PaymentConfirmedMail($wonItem));
            Log::info('入金確認通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('入金確認通知送信エラー', ['error' => $e->getMessage(), 'won_item_id' => $wonItem->id]);
            return false;
        }
    }

    /**
     * 発送通知を送信（買受者向け）
     */
    public function sendShippingNotification(WonItem $wonItem): bool
    {
        try {
            $user = $wonItem->user;
            if (!$user || !$user->email) {
                return false;
            }

            // 通知設定確認
            if (!$this->shouldSendParticipantNotification($user, 'email_shipping')) {
                Log::info('通知スキップ: 買受者が発送通知を無効化', ['user_id' => $user->id]);
                return false;
            }

            Mail::to($user->email)->queue(new ShippingNotificationMail($wonItem));
            Log::info('発送通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('発送通知送信エラー', ['error' => $e->getMessage(), 'won_item_id' => $wonItem->id]);
            return false;
        }
    }

    /**
     * 落札通知を送信（出品者向け）
     */
    public function sendItemSoldNotification(WonItem $wonItem): bool
    {
        try {
            $item = $wonItem->item;
            if (!$item || !$item->seller) {
                return false;
            }

            $seller = $item->seller;
            if (!$seller->email) {
                return false;
            }

            // 通知設定確認
            if (!$this->shouldSendSellerNotification($seller, 'email_item_sold')) {
                Log::info('通知スキップ: 出品者が落札通知を無効化', ['seller_id' => $seller->id]);
                return false;
            }

            Mail::to($seller->email)->queue(new ItemSoldNotificationMail($wonItem));
            Log::info('出品者向け落札通知送信', ['won_item_id' => $wonItem->id, 'seller_id' => $seller->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('出品者向け落札通知送信エラー', ['error' => $e->getMessage(), 'won_item_id' => $wonItem->id]);
            return false;
        }
    }

    /**
     * 入金確認・発送依頼通知を送信（出品者向け）
     */
    public function sendSellerPaymentReceivedNotification(WonItem $wonItem): bool
    {
        try {
            $item = $wonItem->item;
            if (!$item || !$item->seller) {
                return false;
            }

            $seller = $item->seller;
            if (!$seller->email) {
                return false;
            }

            // 通知設定確認
            if (!$this->shouldSendSellerNotification($seller, 'email_payment_received')) {
                Log::info('通知スキップ: 出品者が入金確認通知を無効化', ['seller_id' => $seller->id]);
                return false;
            }

            Mail::to($seller->email)->queue(new SellerPaymentReceivedMail($wonItem));
            Log::info('出品者向け入金確認通知送信', ['won_item_id' => $wonItem->id, 'seller_id' => $seller->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('出品者向け入金確認通知送信エラー', ['error' => $e->getMessage(), 'won_item_id' => $wonItem->id]);
            return false;
        }
    }

    /**
     * 新規オークション通知を送信
     */
    public function sendNewAuctionNotification(Auction $auction): int
    {
        $sentCount = 0;

        try {
            // 出品者に通知
            $sellers = User::whereHas('roles', function ($q) {
                $q->where('name', 'seller');
            })->where('is_active', true)->get();

            foreach ($sellers as $seller) {
                if ($this->shouldSendSellerNotification($seller, 'email_new_auction')) {
                    Mail::to($seller->email)->queue(new NewAuctionNotificationMail($auction, $seller));
                    $sentCount++;
                }
            }

            // 参加者に通知
            $participants = User::whereHas('roles', function ($q) {
                $q->where('name', 'participant');
            })->where('is_active', true)->get();

            foreach ($participants as $participant) {
                if ($this->shouldSendParticipantNotification($participant, 'email_new_auction')) {
                    Mail::to($participant->email)->queue(new NewAuctionNotificationMail($auction, $participant));
                    $sentCount++;
                }
            }

            Log::info('新規オークション通知送信', ['auction_id' => $auction->id, 'sent_count' => $sentCount]);
        } catch (\Exception $e) {
            Log::error('新規オークション通知送信エラー', ['error' => $e->getMessage(), 'auction_id' => $auction->id]);
        }

        return $sentCount;
    }

    /**
     * オークション開始通知を送信
     */
    public function sendAuctionStartNotification(Auction $auction): int
    {
        $sentCount = 0;

        try {
            // 参加者に通知
            $participants = User::whereHas('roles', function ($q) {
                $q->where('name', 'participant');
            })->where('is_active', true)->get();

            foreach ($participants as $participant) {
                if ($this->shouldSendParticipantNotification($participant, 'email_auction_start')) {
                    Mail::to($participant->email)->queue(new AuctionStartNotificationMail($auction, $participant));
                    $sentCount++;
                }
            }

            Log::info('オークション開始通知送信', ['auction_id' => $auction->id, 'sent_count' => $sentCount]);
        } catch (\Exception $e) {
            Log::error('オークション開始通知送信エラー', ['error' => $e->getMessage(), 'auction_id' => $auction->id]);
        }

        return $sentCount;
    }

    /**
     * 出品者の通知設定を確認
     */
    protected function shouldSendSellerNotification(User $seller, string $settingKey): bool
    {
        $profile = SellerProfile::where('user_id', $seller->id)->first();
        if (!$profile) {
            return true; // デフォルトは送信
        }

        $settings = $profile->notification_settings ?? [];
        return $settings[$settingKey] ?? true;
    }

    /**
     * 参加者の通知設定を確認
     */
    protected function shouldSendParticipantNotification(User $participant, string $settingKey): bool
    {
        $settings = $participant->notification_settings ?? [];
        return $settings[$settingKey] ?? true;
    }
}
