<?php

namespace App\Services;

use App\Mail\AuctionStartNotificationMail;
use App\Mail\BidLimitReachedMail;
use App\Mail\FavoriteApproachingMail;
use App\Mail\ItemSoldNotificationMail;
use App\Mail\NewAuctionNotificationMail;
use App\Mail\PaymentConfirmedMail;
use App\Mail\PaymentReminderMail;
use App\Mail\SellerAuctionStartMail;
use App\Mail\SellerPaymentReceivedMail;
use App\Mail\ShippingNotificationMail;
use App\Mail\WonItemNotificationMail;
use App\Models\Auction;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LINE通知ヘルパー
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private function sendLine(int $userId, string $type, string $text): void
    {
        try {
            $lineService = app(LineService::class);
            $sent = $lineService->notify($userId, $type, $text);
            Log::info("LINE notification: type={$type}, user={$userId}, sent=" . ($sent ? 'true' : 'false'));
        } catch (\Exception $e) {
            Log::warning("LINE notification failed: {$type} user={$userId} - " . $e->getMessage());
        }
    }

    /** 出品者のUser IDを取得（SellerProfile経由） */
    private function getSellerUserId($item): ?int
    {
        if (!$item) return null;
        $seller = $item->seller;
        if (!$seller) return null;
        return $seller->user_id ?? $seller->id ?? null;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 参加者（買受者）向け通知
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /** ① 落札通知（参加者向け） */
    public function sendWonItemNotification(WonItem $wonItem): bool
    {
        try {
            $user = $wonItem->user;
            if (!$user || !$user->email) return false;
            if (!$this->shouldSendParticipantNotification($user, 'email_won_item')) return false;

            Mail::to($user->email)->queue(new WonItemNotificationMail($wonItem));

            $item = $wonItem->item;
            $this->sendLine($user->id, 'won_item',
                "🎉 落札おめでとうございます！\n"
                . ($item ? $item->species_name : '商品') . "\n"
                . "¥" . number_format($wonItem->winning_price) . "/匹\n"
                . "合計: ¥" . number_format($wonItem->total_amount) . "（税込）"
            );

            Log::info('落札通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('落札通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /** ② 入金確認通知（参加者向け） */
    public function sendPaymentConfirmedNotification(WonItem $wonItem): bool
    {
        try {
            $user = $wonItem->user;
            if (!$user || !$user->email) return false;
            if (!$this->shouldSendParticipantNotification($user, 'email_payment_confirmed')) return false;

            Mail::to($user->email)->queue(new PaymentConfirmedMail($wonItem));

            $this->sendLine($user->id, 'payment_reminder',
                "✅ 入金が確認されました\n"
                . ($wonItem->item ? $wonItem->item->species_name : '商品') . "\n"
                . "発送をお待ちください。"
            );

            Log::info('入金確認通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('入金確認通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /** ③ 発送完了通知（参加者向け） */
    public function sendShippingNotification(WonItem $wonItem): bool
    {
        try {
            $user = $wonItem->user;
            if (!$user || !$user->email) return false;
            if (!$this->shouldSendParticipantNotification($user, 'email_shipping')) return false;

            Mail::to($user->email)->queue(new ShippingNotificationMail($wonItem));

            $trackingInfo = $wonItem->tracking_number ? "\n追跡番号: {$wonItem->tracking_number}" : '';
            $this->sendLine($user->id, 'shipping_completed',
                "📦 発送が完了しました\n"
                . ($wonItem->item ? $wonItem->item->species_name : '商品')
                . $trackingInfo
            );

            Log::info('発送通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('発送通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /** ④ 指値発動通知（参加者向け） */
    public function sendBidLimitReachedNotification(int $userId, string $speciesName, float $limitPrice, float $currentPrice): void
    {
        try {
            $user = User::find($userId);
            if ($user && $user->email) {
                Mail::to($user->email)->queue(new BidLimitReachedMail(
                    $speciesName, $limitPrice, $currentPrice, $user->name ?? ''
                ));
            }
        } catch (\Exception $e) {
            Log::warning("指値発動メール送信エラー: " . $e->getMessage());
        }

        $this->sendLine($userId, 'bid_limit_reached',
            "⚠️ 上限価格に到達しました\n"
            . "{$speciesName}\n"
            . "上限: ¥" . number_format($limitPrice) . "\n"
            . "現在価格: ¥" . number_format($currentPrice) . "\n"
            . "自動的に入札オフになりました"
        );
    }

    /** ⑤ オークション開始通知（参加者向け） */
    public function sendAuctionStartNotification(Auction $auction): int
    {
        $sentCount = 0;
        try {
            $participants = User::whereHas('roles', fn($q) => $q->where('name', 'participant'))
                ->where('is_active', true)->get();

            foreach ($participants as $participant) {
                if ($this->shouldSendParticipantNotification($participant, 'email_auction_start')) {
                    Mail::to($participant->email)->queue(new AuctionStartNotificationMail($auction, $participant));
                    $sentCount++;
                }

                $this->sendLine($participant->id, 'auction_start',
                    "🔔 オークションが開始されました！\n"
                    . $auction->title . "\n"
                    . "今すぐ参加しましょう！"
                );
            }

            Log::info('オークション開始通知送信', ['auction_id' => $auction->id, 'sent_count' => $sentCount]);
        } catch (\Exception $e) {
            Log::error('オークション開始通知送信エラー', ['error' => $e->getMessage()]);
        }
        return $sentCount;
    }

    /** ⑥ 新規オークション通知（参加者 + 出品者） */
    public function sendNewAuctionNotification(Auction $auction): int
    {
        $sentCount = 0;
        try {
            $sellers = User::whereHas('roles', fn($q) => $q->where('name', 'seller'))
                ->where('is_active', true)->get();
            foreach ($sellers as $seller) {
                if ($this->shouldSendSellerNotification($seller, 'email_new_auction')) {
                    Mail::to($seller->email)->queue(new NewAuctionNotificationMail($auction, $seller));
                    $sentCount++;
                }
                $this->sendLine($seller->id, 'new_auction',
                    "📢 新しいオークションが追加されました\n" . $auction->title
                );
            }

            $participants = User::whereHas('roles', fn($q) => $q->where('name', 'participant'))
                ->where('is_active', true)->get();
            foreach ($participants as $participant) {
                if ($this->shouldSendParticipantNotification($participant, 'email_new_auction')) {
                    Mail::to($participant->email)->queue(new NewAuctionNotificationMail($auction, $participant));
                    $sentCount++;
                }
                $this->sendLine($participant->id, 'new_auction',
                    "📢 新しいオークションが追加されました\n"
                    . $auction->title . "\n"
                    . "開催日: " . ($auction->event_date ? $auction->event_date->format('Y/m/d') : '未定')
                );
            }

            Log::info('新規オークション通知送信', ['auction_id' => $auction->id, 'sent_count' => $sentCount]);
        } catch (\Exception $e) {
            Log::error('新規オークション通知送信エラー', ['error' => $e->getMessage()]);
        }
        return $sentCount;
    }

    /** ⑦ 入金催促通知（参加者向け） — 呼び出し元で期限前に実行する */
    public function sendPaymentReminderNotification(WonItem $wonItem, string $urgency = '24時間前'): void
    {
        try {
            $user = $wonItem->user;
            if (!$user) return;

            // メール
            if ($user->email) {
                Mail::to($user->email)->queue(new PaymentReminderMail($wonItem, $urgency));
            }

            // LINE
            $this->sendLine($user->id, 'payment_reminder',
                "⚠️ 入金期限が近づいています\n"
                . ($wonItem->item ? $wonItem->item->species_name : '商品') . "\n"
                . "期限まで{$urgency}\n"
                . "期限: " . ($wonItem->payment_deadline ? $wonItem->payment_deadline->format('m/d H:i') : '未定')
            );

            Log::info('入金催促通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
        } catch (\Exception $e) {
            Log::warning("入金催促通知エラー: " . $e->getMessage());
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 出品者向け通知
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /** ⑧ 落札通知（出品者向け） */
    public function sendItemSoldNotification(WonItem $wonItem): bool
    {
        try {
            $item = $wonItem->item;
            if (!$item || !$item->seller) return false;
            $seller = $item->seller;
            if (!$seller->email) return false;
            if (!$this->shouldSendSellerNotification($seller, 'email_item_sold')) return false;

            Mail::to($seller->email)->queue(new ItemSoldNotificationMail($wonItem));

            // 出品者にもLINE通知
            $sellerUserId = $this->getSellerUserId($item);
            if ($sellerUserId) {
                $this->sendLine($sellerUserId, 'won_item',
                    "🎉 出品した生体が落札されました！\n"
                    . $item->species_name . "\n"
                    . "落札価格: ¥" . number_format($wonItem->winning_price) . "/匹"
                );
            }

            Log::info('出品者向け落札通知送信', ['won_item_id' => $wonItem->id, 'seller_id' => $seller->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('出品者向け落札通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /** ⑨ 入金確認・発送依頼通知（出品者向け） */
    public function sendSellerPaymentReceivedNotification(WonItem $wonItem): bool
    {
        try {
            $item = $wonItem->item;
            if (!$item || !$item->seller) return false;
            $seller = $item->seller;
            if (!$seller->email) return false;
            if (!$this->shouldSendSellerNotification($seller, 'email_payment_received')) return false;

            Mail::to($seller->email)->queue(new SellerPaymentReceivedMail($wonItem));

            $sellerUserId = $this->getSellerUserId($item);
            if ($sellerUserId) {
                $this->sendLine($sellerUserId, 'won_item',
                    "💰 入金が確認されました\n"
                    . $item->species_name . "\n"
                    . "発送をお願いします。"
                );
            }

            Log::info('出品者向け入金確認通知送信', ['won_item_id' => $wonItem->id, 'seller_id' => $seller->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('出品者向け入金確認通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /** ⑩ オークション開始通知（出品者向け） */
    public function sendSellerAuctionStartNotification(Auction $auction): void
    {
        try {
            $sellers = User::whereHas('roles', fn($q) => $q->where('name', 'seller'))
                ->where('is_active', true)->get();
            foreach ($sellers as $seller) {
                // メール
                if ($seller->email && $this->shouldSendSellerNotification($seller, 'email_auction_start')) {
                    Mail::to($seller->email)->queue(new SellerAuctionStartMail($auction, $seller->name ?? ''));
                }
                // LINE
                $this->sendLine($seller->id, 'auction_start',
                    "🔔 出品した生体のオークションが開始されました\n" . $auction->title
                );
            }
        } catch (\Exception $e) {
            Log::warning("出品者オークション開始通知エラー: " . $e->getMessage());
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 通知設定チェック
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    protected function shouldSendSellerNotification(User $seller, string $settingKey): bool
    {
        $profile = SellerProfile::where('user_id', $seller->id)->first();
        if (!$profile) return true;
        $settings = $profile->notification_settings ?? [];
        return $settings[$settingKey] ?? true;
    }

    protected function shouldSendParticipantNotification(User $participant, string $settingKey): bool
    {
        $settings = $participant->notification_settings ?? [];
        return $settings[$settingKey] ?? true;
    }
}
