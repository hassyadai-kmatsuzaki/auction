<?php

namespace App\Jobs;

use App\Mail\SellerExhibitCodeNotificationMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\LineNotificationLog;
use App\Models\SellerProfile;
use App\Services\LineFlexBuilder;
use App\Services\LineService;
use App\Services\NotificationService;
use App\Services\TestModeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * 出品ID発行通知を出品者向けに「出品者×オークション」単位で1通にまとめて送信する。
 *
 * - レーン割当（assignItem / autoAssign）で出品IDが発行されると {@see dispatchIfNotPending} がキューに乗せる。
 * - 60秒間のデバウンスウィンドウを設け、その間の同一 seller × auction の通知は1ジョブにまとめる。
 * - 「未通知」判定は line_notification_logs に payload['item_id'] を残して二重送信を防ぐ。
 * - メール / LINE 双方を送る。LINE 未連携の出品者にはメールだけ届く。
 */
class NotifyExhibitCodesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    /** デバウンス用ウィンドウ（秒） */
    public const DEBOUNCE_SECONDS = 60;

    public const NOTIFICATION_TYPE = 'exhibit_code_issued';

    public function __construct(
        public int $sellerProfileId,
        public int $auctionId,
    ) {
        $this->onQueue('notify');
        $this->delay(now()->addSeconds(self::DEBOUNCE_SECONDS));
    }

    /**
     * 既に同一 seller × auction のジョブがウィンドウ内なら追加 dispatch しない。
     * Cache::add は SETNX 相当で、競合した場合は false が返る。
     */
    public static function dispatchIfNotPending(int $sellerProfileId, int $auctionId): void
    {
        $key = self::debounceKey($sellerProfileId, $auctionId);
        // ウィンドウは 60秒 + ジョブ実行の遅延に多少の余裕を持たせる
        $added = Cache::add($key, 1, self::DEBOUNCE_SECONDS + 30);
        if (! $added) {
            return; // 既にデバウンスウィンドウ内
        }

        try {
            self::dispatch($sellerProfileId, $auctionId);
        } catch (\Throwable $e) {
            // 失敗時はロックを消して次回再 dispatch を可能にする
            Cache::forget($key);
            Log::warning('NotifyExhibitCodesJob dispatch failed: ' . $e->getMessage(), [
                'seller_profile_id' => $sellerProfileId,
                'auction_id' => $auctionId,
            ]);
        }
    }

    private static function debounceKey(int $sellerProfileId, int $auctionId): string
    {
        return "exhibit_code:notify:debounce:{$sellerProfileId}:{$auctionId}";
    }

    public function handle(
        LineService $line,
        LineFlexBuilder $flex,
        TestModeService $testMode,
    ): void {
        // 実行時にロックを開放（次回以降の発行で再度 dispatch できるように）
        Cache::forget(self::debounceKey($this->sellerProfileId, $this->auctionId));

        $auction = Auction::find($this->auctionId);
        if (! $auction) {
            Log::warning('NotifyExhibitCodesJob: auction not found', ['auction_id' => $this->auctionId]);
            return;
        }

        $sellerProfile = SellerProfile::with('user')->find($this->sellerProfileId);
        if (! $sellerProfile || ! $sellerProfile->user) {
            Log::warning('NotifyExhibitCodesJob: seller profile or user not found', [
                'seller_profile_id' => $this->sellerProfileId,
            ]);
            return;
        }

        $user = $sellerProfile->user;

        // 承認/有効性チェック（停止アカウントには送らない）
        if (! $user->is_active || $user->status !== 'approved') {
            return;
        }

        // テストモード ON 中は is_test=true ユーザー以外には飛ばさない
        if (! $testMode->shouldNotifyForAuction($user, $auction)) {
            return;
        }

        // 当該 seller × auction の出品IDのうち「まだ通知していないもの」を抽出
        $candidates = Item::where('auction_id', $this->auctionId)
            ->where('seller_profile_id', $this->sellerProfileId)
            ->whereNotNull('exhibit_code')
            ->orderBy('exhibit_code')
            ->get(['id', 'item_number', 'exhibit_code', 'species_name']);

        if ($candidates->isEmpty()) {
            return;
        }

        $alreadyNotifiedItemIds = $this->fetchAlreadyNotifiedItemIds($user->id);
        $pending = $candidates->reject(fn ($item) => in_array($item->id, $alreadyNotifiedItemIds, true))->values();

        if ($pending->isEmpty()) {
            return;
        }

        $items = $pending->map(fn ($item) => [
            'id'           => $item->id,
            'exhibit_code' => $item->exhibit_code,
            'item_number'  => $item->item_number,
            'species_name' => $item->species_name,
        ])->toArray();

        // メール送信
        $this->sendMail($auction, $user, $items);

        // LINE 送信
        $this->sendLine($auction, $user, $items, $line, $flex);

        // 送信済みとして記録
        $this->recordNotified($user->id, $items);
    }

    /**
     * @return array<int>
     */
    private function fetchAlreadyNotifiedItemIds(int $userId): array
    {
        $logs = LineNotificationLog::where('user_id', $userId)
            ->where('notification_type', self::NOTIFICATION_TYPE)
            ->get(['message_payload']);

        $ids = [];
        foreach ($logs as $log) {
            $payload = $log->message_payload;
            if (is_string($payload)) {
                $payload = json_decode($payload, true);
            }
            $itemIds = data_get($payload, 'item_ids', []);
            if (is_array($itemIds)) {
                foreach ($itemIds as $id) {
                    $ids[] = (int) $id;
                }
            }
        }
        return $ids;
    }

    private function sendMail(Auction $auction, $user, array $items): void
    {
        try {
            if (! $user->email) return;

            $sellerName = $user->name ?? 'お取引者';
            Mail::to($user->email)->queue(new SellerExhibitCodeNotificationMail(
                auction:    $auction,
                sellerName: $sellerName,
                items:      $items,
            ));
        } catch (\Throwable $e) {
            Log::error('SellerExhibitCodeNotificationMail send failed: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'auction_id' => $auction->id,
            ]);
        }
    }

    private function sendLine(Auction $auction, $user, array $items, LineService $line, LineFlexBuilder $flex): void
    {
        try {
            $flexContent = $flex->exhibitCodeIssued($auction, $items);
            $altText = '出品ID発行: ' . $auction->title . '（' . count($items) . '件）';
            $line->notify($user->id, self::NOTIFICATION_TYPE, $altText, $flexContent);
        } catch (\Throwable $e) {
            Log::error('exhibit_code LINE notify failed: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'auction_id' => $auction->id,
            ]);
        }
    }

    /**
     * メール/LINE のどちらの経路でも、当該 item_ids を「通知済み」として line_notification_logs に1行残す。
     * （LINE 未連携ユーザー向けにも記録するためメール送信時にも書く）
     */
    private function recordNotified(int $userId, array $items): void
    {
        try {
            LineNotificationLog::create([
                'user_id'           => $userId,
                'notification_type' => self::NOTIFICATION_TYPE,
                'line_user_id'      => '',
                'message_payload'   => [
                    'item_ids' => array_map(fn ($i) => (int) $i['id'], $items),
                    'exhibit_codes' => array_map(fn ($i) => $i['exhibit_code'], $items),
                    'auction_id' => $this->auctionId,
                ],
                'status'        => 'sent',
                'error_message' => null,
                'sent_at'       => now(),
                'created_at'    => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to record exhibit_code notification log: ' . $e->getMessage());
        }
    }
}
