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
use App\Mail\ShippingFeeFinalizedMail;
use App\Mail\ShippingNotificationMail;
use App\Mail\WonItemNotificationMail;
use App\Jobs\SendLineNotificationJob;
use App\Services\LineFlexBuilder;
use App\Models\Auction;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    private LineFlexBuilder $flex;

    public function __construct(?LineFlexBuilder $flex = null)
    {
        $this->flex = $flex ?? app(LineFlexBuilder::class);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LINE通知ヘルパー
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private function sendLine(int $userId, string $type, string $text, ?array $flexContent = null): void
    {
        try {
            SendLineNotificationJob::dispatch($userId, $type, $text, $flexContent);
        } catch (\Exception $e) {
            Log::warning("LINE notification dispatch failed: {$type} user={$userId} - " . $e->getMessage());
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
                . "合計: ¥" . number_format($wonItem->total_amount) . "（税込）",
                $this->flex->wonItem($wonItem),
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
                . "発送をお待ちください。",
                $this->flex->paymentConfirmed($wonItem),
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
                . $trackingInfo,
                $this->flex->shippingCompleted($wonItem),
            );

            Log::info('発送通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
            return true;
        } catch (\Exception $e) {
            Log::error('発送通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * ③-2 送料確定通知（参加者向け）
     *
     * 管理者が送料を承認（手動/自動問わず）したタイミングで送信する。
     * 同一発送単位（オークション×落札者）の全 WonItem をまとめて 1 通で通知する。
     *
     * @param \Illuminate\Support\Collection<int, WonItem> $wonItems
     */
    public function sendShippingFeeFinalizedNotification($wonItems): bool
    {
        try {
            if (!$wonItems || $wonItems->isEmpty()) return false;

            $first = $wonItems->first();
            $user = $first->user;
            if (!$user || !$user->email) return false;
            // 既存の email_shipping 設定で配送関連通知をまとめて制御する
            if (!$this->shouldSendParticipantNotification($user, 'email_shipping')) return false;

            Mail::to($user->email)->queue(new ShippingFeeFinalizedMail($wonItems));

            $totalFee = (int) $wonItems->sum('shipping_fee');
            $itemsLine = $wonItems->map(fn ($wi) => ($wi->item->species_name ?? '商品'))->unique()->implode('、');
            $this->sendLine($user->id, 'shipping_fee_finalized',
                "💡 送料が確定しました\n"
                . "商品: {$itemsLine}\n"
                . "送料合計: ¥" . number_format($totalFee),
                null,
            );

            Log::info('送料確定通知送信', [
                'winner_id' => $user->id,
                'won_item_ids' => $wonItems->pluck('id')->toArray(),
                'total_shipping_fee' => $totalFee,
            ]);
            return true;
        } catch (\Exception $e) {
            Log::error('送料確定通知送信エラー', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /** ④ 指値発動通知（参加者向け） */
    public function sendBidLimitReachedNotification(int $userId, string $speciesName, float $limitPrice, float $currentPrice): void
    {
        try {
            $user = User::find($userId);
            if ($user && $user->email && $this->shouldSendParticipantNotification($user, 'email_bid_limit_reached')) {
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
            . "自動的に入札オフになりました",
            $this->flex->bidLimitReached($speciesName, $limitPrice, $currentPrice),
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
                    . "今すぐ参加しましょう！",
                    $this->flex->auctionStart($auction),
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
                    "📢 新しいオークションが追加されました\n" . $auction->title,
                    $this->flex->newAuction($auction, 'seller'),
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
                    . "開催日: " . ($auction->event_date ? $auction->event_date->format('Y/m/d') : '未定'),
                    $this->flex->newAuction($auction, 'participant'),
                );
            }

            Log::info('新規オークション通知送信', ['auction_id' => $auction->id, 'sent_count' => $sentCount]);
        } catch (\Exception $e) {
            Log::error('新規オークション通知送信エラー', ['error' => $e->getMessage()]);
        }
        return $sentCount;
    }

    /** ⑦ お気に入り順番接近通知（参加者向け） */
    public function sendFavoriteApproachingNotification(int $userId, string $speciesName, int $aheadCount, string $laneName, string $auctionTitle, ?int $auctionId = null): void
    {
        try {
            $user = User::find($userId);
            if ($user && $user->email && $this->shouldSendParticipantNotification($user, 'email_auction_start')) {
                Mail::to($user->email)->queue(new FavoriteApproachingMail(
                    $speciesName, $aheadCount, $laneName, $auctionTitle, $user->name ?? ''
                ));
            }
        } catch (\Exception $e) {
            Log::warning("Favorite approaching mail error: user={$userId} - " . $e->getMessage());
        }

        $this->sendLine($userId, 'favorite_approaching',
            "⏰ お気に入りの{$speciesName}の出番まであと{$aheadCount}つです！\n"
            . "{$laneName} / {$auctionTitle}\n"
            . "準備してください！",
            $this->flex->favoriteApproaching($auctionId ?? 0, $speciesName, $aheadCount, $laneName, $auctionTitle),
        );
    }

    /** ⑧ 入金催促通知（参加者向け） — 呼び出し元で期限前に実行する */
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
                . "期限: " . ($wonItem->payment_deadline ? $wonItem->payment_deadline->format('m/d H:i') : '未定'),
                $this->flex->paymentReminder($wonItem, $urgency),
            );

            Log::info('入金催促通知送信', ['won_item_id' => $wonItem->id, 'user_id' => $user->id]);
        } catch (\Exception $e) {
            Log::warning("入金催促通知エラー: " . $e->getMessage());
        }
    }

    /**
     * ⑨ 請求書発行通知（オークション終了時、落札者全員に送信）
     *
     * 落札者単位で集約し、LINE Flex に PDF ダウンロード用 signed URL（30日有効）を添付する。
     */
    public function sendInvoiceReadyNotification(Auction $auction): int
    {
        $sentCount = 0;

        try {
            // このオークションで発生した落札を落札者単位に集約
            $winners = WonItem::query()
                ->whereHas('item', fn ($q) => $q->where('auction_id', $auction->id))
                ->with(['winner', 'item'])
                ->get()
                ->groupBy('winner_id');

            foreach ($winners as $winnerId => $items) {
                $winner = $items->first()->winner;
                if (!$winner) continue;

                $totalAmount = (int) $items->sum(fn ($w) => (int) $w->total_amount + (int) ($w->shipping_fee ?? 0));

                $pdfUrl = \Illuminate\Support\Facades\URL::temporarySignedRoute(
                    'line.invoice.download',
                    now()->addDays(30),
                    ['auctionId' => $auction->id, 'winnerId' => (int) $winnerId],
                );

                $this->sendLine((int) $winnerId, 'invoice_ready',
                    "🧾 請求書が発行されました\n"
                    . ($auction->title ?? '') . "\n"
                    . "請求金額: ¥" . number_format($totalAmount) . "（税込）\n"
                    . "下記リンクからPDFをダウンロードできます。\n"
                    . $pdfUrl,
                    $this->flex->invoiceReady($auction, $totalAmount, $pdfUrl),
                );

                $sentCount++;
            }

            Log::info('請求書発行LINE通知', ['auction_id' => $auction->id, 'winners' => $sentCount]);
        } catch (\Exception $e) {
            Log::error('請求書発行LINE通知エラー', ['auction_id' => $auction->id, 'error' => $e->getMessage()]);
        }

        return $sentCount;
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
                $this->sendLine($sellerUserId, 'item_sold',
                    "🎉 出品した生体が落札されました！\n"
                    . $item->species_name . "\n"
                    . "落札価格: ¥" . number_format($wonItem->winning_price) . "/匹",
                    $this->flex->itemSold($wonItem),
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
                $this->sendLine($sellerUserId, 'payment_received',
                    "💰 入金が確認されました\n"
                    . $item->species_name . "\n"
                    . "発送をお願いします。",
                    $this->flex->sellerPaymentReceived($wonItem),
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
                    "🔔 出品した生体のオークションが開始されました\n" . $auction->title,
                    $this->flex->sellerAuctionStart($auction),
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
