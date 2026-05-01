<?php

namespace App\Jobs;

use App\Mail\CampaignMail;
use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * キャンペーンの 1 受信者宛にメール送信する Job。
 *
 * SES の TPS 上限を超えないよう、グローバル RateLimiter('ses-send') を middleware で適用する。
 * 上限超過時は release() されてリトライされる。
 *
 * 失敗時は recipients 行を status=failed に更新するが、Job 自体は例外を投げない
 * （1 通の失敗でキャンペーン全体を止めないため）。
 */
class SendCampaignEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(public int $recipientId)
    {
        $this->onQueue('notify');
    }

    public function middleware(): array
    {
        return [(new RateLimited('ses-send'))->dontRelease()];
    }

    public function handle(): void
    {
        $recipient = EmailCampaignRecipient::with(['campaign', 'user'])->find($this->recipientId);
        if (!$recipient) return;

        // 二重送信防止: 既に sent / failed / skipped なら何もしない
        if ($recipient->status !== 'queued') return;

        $campaign = $recipient->campaign;
        $user = $recipient->user;

        if (!$campaign || $campaign->status === 'cancelled') {
            $recipient->update(['status' => 'skipped', 'error' => 'campaign cancelled']);
            return;
        }

        // 直前再チェック: 受信者が opt-out / バウンス / 苦情で除外されていないか
        if (!$user || !$user->canReceiveBulkEmail()) {
            $recipient->update([
                'status' => 'skipped',
                'error' => 'recipient opted out or bounced after recipient row was created',
            ]);
            $this->bumpFailed($campaign);
            return;
        }

        try {
            Mail::to($user->email)->send(new CampaignMail($campaign, $user));

            $recipient->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);
            DB::table('email_campaigns')->where('id', $campaign->id)->increment('sent_count');
            $this->markCampaignCompletedIfDone($campaign->id);
        } catch (\Throwable $e) {
            Log::error('SendCampaignEmailJob failed', [
                'recipient_id' => $recipient->id,
                'campaign_id' => $campaign->id,
                'error' => $e->getMessage(),
            ]);

            // 最後のリトライまで失敗したら failed として確定させる
            if ($this->attempts() >= $this->tries) {
                $recipient->update([
                    'status' => 'failed',
                    'error' => substr($e->getMessage(), 0, 1000),
                ]);
                $this->bumpFailed($campaign);
                $this->markCampaignCompletedIfDone($campaign->id);
                return;
            }

            throw $e; // リトライへ
        }
    }

    private function bumpFailed(EmailCampaign $campaign): void
    {
        DB::table('email_campaigns')->where('id', $campaign->id)->increment('failed_count');
    }

    /**
     * 自分が最後の 1 件だった場合にキャンペーンを sending → sent に遷移させる。
     *
     * 競合対策として WHERE で status='sending' AND sent+failed >= total を条件にした
     * 単一 UPDATE で行う。複数ワーカーが同時に最後の1件を処理しても、
     * 最初の UPDATE だけが 1 行更新を返し、残りは 0 行で no-op になる。
     */
    public static function markCampaignCompletedIfDone(int $campaignId): void
    {
        DB::table('email_campaigns')
            ->where('id', $campaignId)
            ->where('status', 'sending')
            ->where('total_recipients', '>', 0)
            ->whereRaw('(sent_count + failed_count) >= total_recipients')
            ->update([
                'status' => 'sent',
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
    }
}
