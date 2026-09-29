<?php

namespace App\Console\Commands;

use App\Services\GmoAozora\GmoAozoraApiException;
use App\Services\GmoAozora\GmoConnectionTestService;
use Illuminate\Console\Command;

/**
 * GMOあおぞら 接続試験（4スコープを参照系 API で1回ずつ叩く）。
 *
 *   sudo -u ec2-user php artisan gmo-aozora:test-connection [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
 *
 * 送金系は叩かない。結果は audit ログにも残る。
 */
class GmoAozoraTestConnectionCommand extends Command
{
    protected $signature = 'gmo-aozora:test-connection {--from= : 照会期間 From (Y-m-d)} {--to= : 照会期間 To (Y-m-d)}';
    protected $description = 'GMOあおぞら API の接続試験（口座 / 振込 / 総合振込 / 振込入金口座）';

    public function handle(GmoConnectionTestService $tester): int
    {
        try {
            $result = $tester->run($this->option('from') ?: null, $this->option('to') ?: null);
        } catch (GmoAozoraApiException $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $this->line('環境: ' . $result['environment']);
        $this->table(
            ['scope', 'endpoint', 'ok', 'status', 'summary / error'],
            array_map(fn ($r) => [
                $r['scope'],
                $r['endpoint'],
                $r['ok'] ? 'OK' : 'NG',
                $r['status'] ?? '-',
                $r['ok'] ? $r['summary'] : json_encode($r['error'], JSON_UNESCAPED_UNICODE),
            ], $result['results'])
        );

        if ($result['ok']) {
            $this->info('全スコープ OK');
            return self::SUCCESS;
        }
        $this->error('失敗したスコープがあります');
        return self::FAILURE;
    }
}
