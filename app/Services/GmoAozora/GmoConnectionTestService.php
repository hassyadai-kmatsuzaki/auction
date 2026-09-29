<?php

namespace App\Services\GmoAozora;

use Illuminate\Support\Facades\Log;

/**
 * 接続試験: 申請済み4スコープを参照系 API で1回ずつ叩き、結果を配列で返す。
 *
 * GMO 側が「全スコープのログを確認する」ため、口座 / 振込・振替 / 総合振込 / 振込入金口座 のそれぞれで
 * 少なくとも1回は当方 client_id からのリクエストが到達している必要がある。
 * 送金系（/transfer/request, /bulktransfer/request）は資金移動を伴うため試験では叩かない。
 */
class GmoConnectionTestService
{
    public function __construct(private readonly GmoAozoraClient $client)
    {
    }

    /**
     * @return array{environment:string, ok:bool, results: array<int, array{scope:string, endpoint:string, ok:bool, status:int|null, summary:string, error:?array}>}
     */
    public function run(?string $dateFrom = null, ?string $dateTo = null): array
    {
        $dateTo   ??= now()->toDateString();
        $dateFrom ??= now()->subDays(30)->toDateString();

        $results = [];
        $accountId = null;
        $raId = null;

        // 1. 口座
        $results[] = $this->attempt('private:account', 'GET /accounts', function () use (&$accountId, &$raId) {
            $data = $this->client->accounts();
            $accounts = $data['accounts'] ?? [];
            foreach ($accounts as $a) {
                if (in_array($a['accountTypeCode'] ?? '', ['01', '02'], true)) {
                    $accountId ??= $a['accountId'] ?? null;
                }
            }
            $configured = (string) config('services.gmo_aozora.ra_account_id', '');
            $raId = $configured !== '' ? $configured : $accountId;
            return sprintf('%d口座（accountId=%s）', count($accounts), $accountId ?? '-');
        });

        if (!$accountId) {
            $accountId = (string) config('services.gmo_aozora.ra_account_id', '');
        }

        // 2. 振込/振替（参照）
        $results[] = $this->attempt('private:transfer', 'GET /transfer/status', function () use ($accountId, $dateFrom, $dateTo) {
            if (!$accountId) {
                throw new GmoAozoraApiException('accountId が取れていないため照会できません', 0, null, [], 'transferStatus');
            }
            $data = $this->client->transferStatus($accountId, $dateFrom, $dateTo);
            return sprintf('count=%s', $data['count'] ?? '0');
        });

        // 3. 総合振込（参照）
        $results[] = $this->attempt('private:bulk-transfer', 'GET /bulktransfer/status', function () use ($accountId, $dateFrom, $dateTo) {
            if (!$accountId) {
                throw new GmoAozoraApiException('accountId が取れていないため照会できません', 0, null, [], 'bulkTransferStatus');
            }
            $data = $this->client->bulkTransferStatus($accountId, $dateFrom, $dateTo);
            return sprintf('count=%s', $data['count'] ?? '0');
        });

        // 4. 振込入金口座（一覧 + 入金明細）
        $results[] = $this->attempt('private:virtual-account', 'POST /va/list', function () use ($raId) {
            $data = $this->client->vaList(array_filter(['raId' => $raId]));
            return sprintf('count=%s', $data['count'] ?? count($data['vAccounts'] ?? []));
        });
        $results[] = $this->attempt('private:virtual-account', 'GET /va/deposit-transactions', function () use ($raId, $dateFrom, $dateTo) {
            if (!$raId) {
                throw new GmoAozoraApiException('raId が取れていないため照会できません', 0, null, [], 'vaDepositTransactions');
            }
            $data = $this->client->vaDepositTransactions($raId, null, $dateFrom, $dateTo);
            return sprintf('count=%s', $data['count'] ?? count($data['vaTransactions'] ?? []));
        });

        $ok = collect($results)->every(fn ($r) => $r['ok']);

        Log::channel('audit')->info('GMO_AOZORA_CONNECTION_TEST', [
            'environment' => $this->client->environment(),
            'ok'          => $ok,
            'results'     => $results,
        ]);

        return [
            'environment' => $this->client->environment(),
            'ok'          => $ok,
            'results'     => $results,
        ];
    }

    private function attempt(string $scope, string $endpoint, callable $fn): array
    {
        try {
            $summary = $fn();
            return ['scope' => $scope, 'endpoint' => $endpoint, 'ok' => true, 'status' => 200, 'summary' => (string) $summary, 'error' => null];
        } catch (GmoAozoraApiException $e) {
            return ['scope' => $scope, 'endpoint' => $endpoint, 'ok' => false, 'status' => $e->status ?: null, 'summary' => '', 'error' => $e->toArray()];
        } catch (\Throwable $e) {
            return ['scope' => $scope, 'endpoint' => $endpoint, 'ok' => false, 'status' => null, 'summary' => '', 'error' => ['message' => $e->getMessage()]];
        }
    }
}
