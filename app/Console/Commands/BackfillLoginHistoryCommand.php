<?php

namespace App\Console\Commands;

use App\Models\ActivityEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ログイン計測（activity_events.login）開始前のログイン履歴を遡って埋める運用コマンド。
 *
 * 対象ユーザー: 入札・指値・お気に入り・行動計測のいずれかが残っているユーザー。
 * 入れるもの（いずれも meta.backfilled=true を付けて本物の記録と区別する）:
 *   ① source=token … personal_access_tokens(auth-token) の created_at。ログイン時に発行されるので
 *                     実際のログイン日時。ログアウト等で消えたトークンの分は復元できない。IP/UA なし。
 *   ② source=bid   … 手動入札（bid_events / bid_events_archive の join/leave 等で IP あり）の
 *                     1ユーザー1日の最初の1件。「この時点でログイン中だった」推定。①がある日は入れない。
 *
 * 対象期間は --before（既定: 本物のログイン記録の最古日時）より前だけ。
 * dedup_key（bf:tok:{token_id} / bf:bid:{user}:{Ymd}）で重複排除するので再実行しても増えない。
 *
 * 使用例:
 *   sudo -u ec2-user php artisan activity:backfill-logins --dry-run
 *   sudo -u ec2-user php artisan activity:backfill-logins
 */
class BackfillLoginHistoryCommand extends Command
{
    protected $signature = 'activity:backfill-logins
        {--before= : この日時より前を対象にする（既定: 計測済みログインの最古日時）}
        {--dry-run : 書き込まずに件数だけ出力}';

    protected $description = 'ログイン計測開始前のログイン履歴をトークン・入札記録から遡って登録する';

    /** 自動入札（指値発動）が記録する UA。本人操作ではないので除外する。 */
    private const AUTO_BID_UA = 'auto-bid-from-limit';

    /** 本人操作で記録される入札イベント（win/lose/auto_raise はシステム記録） */
    private const MANUAL_BID_TYPES = ['join', 'leave', 'price_accept', 'manual_raise'];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $before = $this->resolveBefore();
        if (! $before) {
            $this->error('計測済みのログイン記録が無いため対象期間を決められません。--before= を指定してください。');
            return self::INVALID;
        }
        $this->info("対象期間: {$before->toDateTimeString()} より前");

        $userIds = $this->targetUserIds();
        $this->line('対象ユーザー: ' . count($userIds) . ' 人');

        $tokenRows = $this->tokenRows($userIds, $before);
        $bidRows = $this->bidRows($before, $tokenRows);

        $this->line('① トークン（確定）: ' . count($tokenRows) . ' 件 / ' . count(array_unique(array_column($tokenRows, 'user_id'))) . ' 人');
        $this->line('② 入札（推定）    : ' . count($bidRows) . ' 件 / ' . count(array_unique(array_column($bidRows, 'user_id'))) . ' 人');

        if ($dryRun) {
            $this->warn('--dry-run のため書き込みはしていません。');
            return self::SUCCESS;
        }

        $inserted = 0;
        foreach (array_chunk(array_merge($tokenRows, $bidRows), 500) as $chunk) {
            $inserted += DB::table('activity_events')->insertOrIgnore($chunk);
        }

        $skipped = count($tokenRows) + count($bidRows) - $inserted;
        $this->info("登録: {$inserted} 件（登録済みのためスキップ: {$skipped} 件）");

        return self::SUCCESS;
    }

    private function resolveBefore(): ?Carbon
    {
        if ($this->option('before')) {
            return Carbon::parse($this->option('before'));
        }

        $first = ActivityEvent::query()
            ->where('event_type', ActivityEvent::LOGIN)
            ->where(fn ($q) => $q->whereNull('dedup_key')->orWhere('dedup_key', 'not like', 'bf:%'))
            ->min('created_at');

        return $first ? Carbon::parse($first) : null;
    }

    /** @return array<int, int> */
    private function targetUserIds(): array
    {
        $ids = collect();

        foreach (['bid_events', 'bid_events_archive'] as $table) {
            if (Schema::hasTable($table)) {
                $ids = $ids->merge($this->manualBidQuery($table)->distinct()->pluck('user_id'));
            }
        }
        foreach (['bid_limit_prices', 'bid_limit_prices_archive', 'favorites'] as $table) {
            if (Schema::hasTable($table)) {
                $ids = $ids->merge(DB::table($table)->distinct()->pluck('user_id'));
            }
        }
        $ids = $ids->merge(
            DB::table('activity_events')->where('event_type', '!=', ActivityEvent::LOGIN)->distinct()->pluck('user_id')
        );

        // 削除済みユーザーは activity_events の FK に入れられないので落とす
        $unique = $ids->map(fn ($id) => (int) $id)->unique()->values()->all();

        return User::query()->whereIn('id', $unique)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function manualBidQuery(string $table)
    {
        return DB::table($table)
            ->whereIn('event_type', self::MANUAL_BID_TYPES)
            ->whereNotNull('ip_address')
            ->where(fn ($q) => $q->whereNull('user_agent')->orWhere('user_agent', '!=', self::AUTO_BID_UA));
    }

    /**
     * ① ログイン時発行トークンの作成日時。
     *
     * @param array<int, int> $userIds
     */
    private function tokenRows(array $userIds, Carbon $before): array
    {
        $rows = [];

        foreach (array_chunk($userIds, 1000) as $chunk) {
            $tokens = DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('name', 'auth-token')
                ->whereIn('tokenable_id', $chunk)
                ->where('created_at', '<', $before)
                ->get(['id', 'tokenable_id', 'created_at']);

            foreach ($tokens as $t) {
                $at = Carbon::parse($t->created_at);
                $rows[] = $this->row((int) $t->tokenable_id, $at, 'token', "bf:tok:{$t->id}", null, null, ['token_id' => (int) $t->id]);
            }
        }

        return $rows;
    }

    /**
     * ② 手動入札の 1ユーザー1日の最初の1件。①がある日は入れない。
     */
    private function bidRows(Carbon $before, array $tokenRows): array
    {
        $tokenDays = [];
        foreach ($tokenRows as $r) {
            $tokenDays[$r['user_id'] . ':' . $r['event_date']] = true;
        }

        // ユーザー×日 → 最小 id（archive は元 id を保持するので両表で id 順＝時系列）
        $firstIds = [];
        foreach (['bid_events', 'bid_events_archive'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            $groups = $this->manualBidQuery($table)
                ->where('created_at', '<', $before)
                ->selectRaw('user_id, DATE(created_at) as d, MIN(id) as first_id')
                ->groupBy('user_id', DB::raw('DATE(created_at)'))
                ->get();

            foreach ($groups as $g) {
                $key = $g->user_id . ':' . $g->d;
                if (! isset($firstIds[$key]) || $g->first_id < $firstIds[$key]['id']) {
                    $firstIds[$key] = ['id' => (int) $g->first_id, 'table' => $table];
                }
            }
        }

        $validUsers = array_flip(User::query()
            ->whereIn('id', array_unique(array_map(fn ($k) => (int) explode(':', $k)[0], array_keys($firstIds))))
            ->pluck('id')->map(fn ($id) => (int) $id)->all());

        $byTable = [];
        foreach ($firstIds as $key => $v) {
            if (isset($tokenDays[$key])) {
                continue;
            }
            $byTable[$v['table']][] = $v['id'];
        }

        $rows = [];
        foreach ($byTable as $table => $ids) {
            foreach (array_chunk($ids, 1000) as $chunk) {
                $events = DB::table($table)->whereIn('id', $chunk)
                    ->get(['id', 'user_id', 'ip_address', 'user_agent', 'created_at']);

                foreach ($events as $e) {
                    if (! isset($validUsers[(int) $e->user_id])) {
                        continue;
                    }
                    $at = Carbon::parse($e->created_at);
                    $rows[] = $this->row(
                        (int) $e->user_id,
                        $at,
                        'bid',
                        "bf:bid:{$e->user_id}:{$at->format('Ymd')}",
                        $e->ip_address,
                        $e->user_agent,
                        ['bid_event_id' => (int) $e->id]
                    );
                }
            }
        }

        return $rows;
    }

    private function row(int $userId, Carbon $at, string $source, string $dedupKey, ?string $ip, ?string $ua, array $extraMeta): array
    {
        return [
            'user_id'    => $userId,
            'event_type' => ActivityEvent::LOGIN,
            'meta'       => json_encode(['backfilled' => true, 'source' => $source] + $extraMeta),
            'event_date' => $at->toDateString(),
            'dedup_key'  => $dedupKey,
            'ip_address' => $ip,
            'user_agent' => $ua !== null ? mb_substr($ua, 0, 500) : null,
            'created_at' => $at->toDateTimeString(),
        ];
    }
}
