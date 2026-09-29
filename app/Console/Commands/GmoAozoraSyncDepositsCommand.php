<?php

namespace App\Console\Commands;

use App\Jobs\ProcessGmoDepositNotificationJob;
use App\Models\SystemSetting;
use App\Services\GmoAozora\GmoAozoraApiException;
use App\Services\GmoAozora\GmoAozoraClient;
use App\Services\GmoAozora\GmoAozoraOAuthService;
use App\Services\GmoAozora\GmoDepositIngestService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * 振込入金口座の入金明細を API で取得し、Webhook で届いていない明細を取り込む（取りこぼし対策）。
 *
 * 仕様上 Webhook は「配信停止中・トークン失効中・障害時」に明細が届かない/削除されるため、
 * 入金明細照会 API（GET /va/deposit-transactions）を定期的に叩いて差分を補完する。
 * さらに配信停止中に溜まった未送信明細（/webhooks/v1/unsentlist）も取り込む。
 *
 *   php artisan gmo-aozora:sync-deposits [--days=2]
 */
class GmoAozoraSyncDepositsCommand extends Command
{
    protected $signature = 'gmo-aozora:sync-deposits {--days=2 : 何日前から照会するか}';
    protected $description = 'GMOあおぞら 振込入金口座の入金明細を照会して未取込分を登録する';

    public function handle(GmoAozoraOAuthService $oauth, GmoAozoraClient $client, GmoDepositIngestService $ingest): int
    {
        if (!SystemSetting::get('gmo_aozora_webhook_enabled', false)) {
            $this->line('gmo_aozora_webhook_enabled=OFF のためスキップ');
            return self::SUCCESS;
        }
        if (!$oauth->token()) {
            $this->line('トークン未取得のためスキップ');
            return self::SUCCESS;
        }

        $days = max(0, (int) $this->option('days'));
        $dateFrom = now()->subDays($days)->toDateString();
        $dateTo   = now()->toDateString();
        $ingested = 0;

        try {
            // 1. 入金明細照会（ページング）
            $raId = $client->resolveRaAccountId();
            $next = null;
            do {
                $data = $client->vaDepositTransactions($raId, null, $dateFrom, $dateTo, $next);
                foreach ($data['vaTransactions'] ?? [] as $tx) {
                    if ($n = $ingest->ingestSyncedTransaction($tx)) {
                        ProcessGmoDepositNotificationJob::dispatch($n->id);
                        $ingested++;
                    }
                }
                $next = !empty($data['hasNext']) ? ($data['nextItemKey'] ?? null) : null;
            } while ($next);

            // 2. 配信停止中の未送信明細（取得すると配信済み扱いになる）
            $unsent = $client->webhookUnsentList();
            foreach ($unsent['messages'] ?? [] as $message) {
                $n = $ingest->ingestWebhook($message, json_encode($message, JSON_UNESCAPED_UNICODE));
                if ($n) {
                    ProcessGmoDepositNotificationJob::dispatch($n->id);
                    $ingested++;
                }
            }
        } catch (GmoAozoraApiException $e) {
            $this->error('同期失敗: ' . $e->getMessage());
            Log::error('GMO Aozora deposit sync failed', $e->toArray());
            return self::FAILURE;
        }

        $this->info(sprintf('%s〜%s: 新規取込 %d 件', $dateFrom, $dateTo, $ingested));
        return self::SUCCESS;
    }
}
