<?php

namespace App\Jobs;

use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * EmailCampaign を実際に展開・配送開始する Job。
 *
 * 1. target_type に応じて宛先 User をクエリで取得（バウンス/苦情/opt-out は除外）
 * 2. email_campaign_recipients テーブルへ chunk(500) で展開
 * 3. 各レコードを SendCampaignEmailJob として notify キューへ投入
 * 4. campaign.status を sending、started_at を now() に更新
 *
 * Controller から store() 時に dispatch される。重い展開処理を 1 リクエストでやらないよう Job 化。
 */
class DispatchEmailCampaignJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 600;

    public function __construct(public int $campaignId)
    {
        $this->onQueue('notify');
    }

    public function handle(): void
    {
        $campaign = EmailCampaign::find($this->campaignId);
        if (!$campaign) return;

        if ($campaign->status !== 'queued') {
            Log::info('DispatchEmailCampaignJob: status is not queued, skip', [
                'campaign_id' => $campaign->id,
                'status' => $campaign->status,
            ]);
            return;
        }

        $campaign->update([
            'status' => 'sending',
            'started_at' => now(),
        ]);

        // ── Phase 1: 受信者を全件 insert する（dispatch はまだしない） ──
        // 先に dispatch すると、worker が完走しても total_recipients=0 のままで
        // 完了判定が走らないレースが起きるため、必ず total を確定させてから dispatch する。
        $query = $this->buildRecipientQuery($campaign);
        $query->select(['id', 'email'])->orderBy('id')->chunk(500, function ($users) use ($campaign) {
            $rows = [];
            foreach ($users as $u) {
                $rows[] = [
                    'email_campaign_id' => $campaign->id,
                    'user_id' => $u->id,
                    'email' => $u->email,
                    'status' => 'queued',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            // ユニークキー (campaign_id, user_id) で衝突したら無視（manual で重複指定された場合）
            EmailCampaignRecipient::insertOrIgnore($rows);
        });

        // ── Phase 2: total_recipients を確定 ──
        $totalQueued = EmailCampaignRecipient::where('email_campaign_id', $campaign->id)
            ->where('status', 'queued')
            ->count();

        $campaign->update([
            'total_recipients' => $totalQueued,
        ]);

        if ($totalQueued === 0) {
            $campaign->update([
                'status' => 'sent',
                'completed_at' => now(),
            ]);
            Log::info('DispatchEmailCampaignJob: no recipients, completed immediately', ['campaign_id' => $campaign->id]);
            return;
        }

        // ── Phase 3: 全件分の SendCampaignEmailJob を dispatch ──
        EmailCampaignRecipient::where('email_campaign_id', $campaign->id)
            ->where('status', 'queued')
            ->orderBy('id')
            ->chunkById(500, function ($recipients) {
                foreach ($recipients as $r) {
                    SendCampaignEmailJob::dispatch($r->id);
                }
            });

        // 念のため: dispatch の途中/直後に最終 worker が完走している可能性があるので、
        // ここでも完了判定を呼んでおく。SendCampaignEmailJob 側にも同じ判定が入っている。
        SendCampaignEmailJob::markCampaignCompletedIfDone($campaign->id);

        Log::info('DispatchEmailCampaignJob: dispatched', [
            'campaign_id' => $campaign->id,
            'total_queued' => $totalQueued,
        ]);
    }

    /**
     * target_type ごとの宛先クエリを組み立てる。
     * いずれも `mailable` スコープでバウンス/苦情/opt-out を除外する。
     */
    private function buildRecipientQuery(EmailCampaign $campaign)
    {
        $base = User::query()->approved()->mailable();

        return match ($campaign->target_type) {
            'all' => $base,
            'manual' => $base->whereIn('id', $campaign->target_user_ids ?? []),
            'filter' => $this->applyFilters($base, $campaign->target_filter ?? []),
            default => $base->whereRaw('1=0'), // 不明な type なら 0 件にして安全側
        };
    }

    /**
     * target_filter のキーをクエリに反映する。
     *
     * 対応キー:
     * - role: 'admin' | 'seller' | 'buyer' （単数 or 配列）
     * - has_won: true なら won_items が 1 件以上ある人だけ
     * - last_login_after: 'YYYY-MM-DD' 以降にログインした人
     * - last_login_before: 'YYYY-MM-DD' より前のログイン（休眠ユーザー再アクティベート向け）
     * - bank_transfer_unconfirmed: true なら振込未確認ユーザーだけ
     */
    private function applyFilters($query, array $filters)
    {
        if (!empty($filters['role'])) {
            $roles = (array) $filters['role'];
            $query->whereHas('roles', fn ($q) => $q->whereIn('name', $roles));
        }
        if (!empty($filters['has_won'])) {
            $query->whereExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('won_items')
                  ->whereColumn('won_items.user_id', 'users.id');
            });
        }
        if (!empty($filters['last_login_after'])) {
            $query->where('last_login_at', '>=', $filters['last_login_after']);
        }
        if (!empty($filters['last_login_before'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('last_login_at', '<', $filters['last_login_before'])
                  ->orWhereNull('last_login_at');
            });
        }
        if (!empty($filters['bank_transfer_unconfirmed'])) {
            $query->where('payment_method_preference', 'bank_transfer')
                  ->whereNull('bank_transfer_confirmed_at');
        }
        return $query;
    }
}
