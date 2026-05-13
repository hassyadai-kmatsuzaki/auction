<?php

namespace Database\Seeders;

use App\Models\Auction;
use App\Models\Lane;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * E2E 用のテストオークションを 1 件と lanes を作成する seeder。
 *
 * 本番 DB に対して安全に流せるよう、以下を遵守する:
 *   - is_test = true 固定（テストユーザーにしか可視/通知されない）
 *   - 既存の同一 title + event_date のテストオークションがあれば「再利用」する
 *     （重複作成を避ける。lanes も不足分のみ補う）
 *   - status は 'scheduled' で投入し、当日 admin から live にしてもらう運用
 *   - DatabaseSeeder からは呼ばない。明示起動のみ:
 *       sudo -u ec2-user php artisan db:seed --class=E2EAuctionSeeder
 *
 * 仕上がる状態:
 *   - auctions: is_test=true / status='scheduled' / lane_count=2 / use_custom_settings=true
 *   - custom_auction_settings.bid_countdown_seconds = 5（落札カウントダウン5秒）
 *   - lanes: 2件 (lane_number=1,2 / lane_name="レーンA"/"レーンB" / status='waiting')
 *
 * 環境変数:
 *   E2E_AUCTION_TITLE         … タイトル (default "E2Eテストオークション")
 *   E2E_AUCTION_EVENT_DATE    … 開催日 YYYY-MM-DD (default "2026-05-15")
 *   E2E_AUCTION_START_TIME    … 開始時刻 HH:MM:SS (default "13:00:00")
 *   E2E_AUCTION_LANE_COUNT    … レーン数 (default 2)
 *   E2E_AUCTION_BID_COUNTDOWN … 落札カウントダウン秒数 (default 5)
 *   E2E_AUCTION_CREATED_BY    … 作成者 user_id (default null → admin ロールの最若番)
 */
class E2EAuctionSeeder extends Seeder
{
    public function run(): void
    {
        $title          = (string) env('E2E_AUCTION_TITLE', 'E2Eテストオークション');
        $eventDate      = (string) env('E2E_AUCTION_EVENT_DATE', '2026-05-15');
        $startTime      = (string) env('E2E_AUCTION_START_TIME', '13:00:00');
        $laneCount      = (int) env('E2E_AUCTION_LANE_COUNT', 2);
        $bidCountdown   = (float) env('E2E_AUCTION_BID_COUNTDOWN', 5);
        $createdByEnv   = env('E2E_AUCTION_CREATED_BY');
        $createdBy      = $createdByEnv !== null && $createdByEnv !== ''
            ? (int) $createdByEnv
            : $this->resolveAdminUserId();

        if ($laneCount < 1 || $laneCount > 6) {
            throw new RuntimeException('E2E_AUCTION_LANE_COUNT must be in 1..6');
        }

        $auction = Auction::where('title', $title)
            ->whereDate('event_date', $eventDate)
            ->where('is_test', true)
            ->first();

        $reused = (bool) $auction;

        DB::transaction(function () use (
            &$auction, $title, $eventDate, $startTime, $laneCount, $bidCountdown, $createdBy
        ) {
            $customAuctionSettings = [
                'bid_countdown_seconds'    => $bidCountdown,
                'freeze_countdown_seconds' => 1, // 誤タップ防止のフリーズ秒は既定値1秒のまま
            ];

            if (!$auction) {
                $auction = Auction::create([
                    'title'                    => $title,
                    'event_date'               => $eventDate,
                    'start_time'               => $startTime,
                    'status'                   => 'scheduled',
                    'is_test'                  => true,
                    'description'              => "E2E 動作確認用のテストオークション。\nis_test=true のテストユーザーにのみ表示されます。",
                    'lane_count'               => $laneCount,
                    'default_bid_increment'    => 100,
                    'countdown_seconds'        => (int) round($bidCountdown), // legacy 列、整数のみ
                    'deposit_required'         => false,
                    'payment_deadline_hours'   => 24,   // 「翌水曜23:59」仕様の方が優先されるので参考値
                    'shipping_deadline_hours'  => 48,
                    'use_custom_settings'      => true,
                    'custom_auction_settings'  => $customAuctionSettings,
                    'created_by'               => $createdBy,
                ]);
            } else {
                // 既存テストオークション: カウントダウン/レーン数だけ揃え直す（破壊的変更はしない）
                $auction->forceFill([
                    'start_time'              => $startTime,
                    'lane_count'              => $laneCount,
                    'use_custom_settings'     => true,
                    'custom_auction_settings' => $customAuctionSettings,
                    'is_test'                 => true,
                ])->save();
            }

            // lanes を必要数まで補う（不足分のみ追加）
            for ($n = 1; $n <= $laneCount; $n++) {
                Lane::firstOrCreate(
                    ['auction_id' => $auction->id, 'lane_number' => $n],
                    [
                        'lane_name' => $this->laneNameFor($n),
                        'status'    => 'waiting',
                    ]
                );
            }
        });

        $this->command->info(sprintf(
            'E2EAuctionSeeder: %s auction_id=%d (title=%s, date=%s %s, lanes=%d, bid_countdown=%s sec)',
            $reused ? 'reused' : 'created',
            $auction->id,
            $title,
            $eventDate,
            $startTime,
            $laneCount,
            $bidCountdown
        ));
        $this->command->info('-> 続けて E2EItemSeeder に渡す:');
        $this->command->info(sprintf('   E2E_ITEM_AUCTION_ID=%d', $auction->id));
    }

    /**
     * レーン番号→レーン名。A,B,C,...
     */
    private function laneNameFor(int $laneNumber): string
    {
        $label = chr(ord('A') + $laneNumber - 1); // 1=A, 2=B, ...
        return sprintf('レーン%s', $label);
    }

    /**
     * admin ロールの最若番 user_id を返す。created_by 未指定時のフォールバック。
     */
    private function resolveAdminUserId(): int
    {
        $admin = User::whereHas('roles', fn ($q) => $q->where('name', 'admin'))
            ->orderBy('id')
            ->first();
        if (!$admin) {
            throw new RuntimeException(
                'admin ユーザーが見つかりません。E2E_AUCTION_CREATED_BY=<user_id> を明示指定してください。'
            );
        }
        return $admin->id;
    }
}
