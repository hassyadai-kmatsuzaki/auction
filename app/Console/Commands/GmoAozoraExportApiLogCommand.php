<?php

namespace App\Console\Commands;

use Carbon\CarbonPeriod;
use Illuminate\Console\Command;

/**
 * GMOあおぞら API 実行ログ（storage/logs/gmo-aozora-api-YYYY-MM-DD.log、1行=1JSON）を CSV に書き出す。
 *
 * 接続試験の完了後、GMO へ「API実行ログ（全スコープ分）」として接続試験表と一緒に提出する。
 * スコープ別の件数・成功件数も表示するので、接続試験表の記入にも使える。
 *
 *   sudo -u ec2-user php artisan gmo-aozora:export-api-log --from=2026-10-01 --to=2026-10-03
 *   → storage/app/gmo-aozora/api-log_2026-10-01_2026-10-03.csv
 */
class GmoAozoraExportApiLogCommand extends Command
{
    protected $signature = 'gmo-aozora:export-api-log
        {--from= : 開始日 (Y-m-d, JST。省略時は今日)}
        {--to= : 終了日 (Y-m-d, JST。省略時は開始日)}
        {--output= : 出力先 CSV パス（省略時は storage/app/gmo-aozora/ 配下）}
        {--log-dir= : ログの置き場所（省略時は storage/logs）}';

    protected $description = 'GMOあおぞら API 実行ログを期間指定で CSV に書き出す（GMO 提出用）';

    private const COLUMNS = [
        'ts', 'env', 'direction', 'scope', 'context', 'method', 'url', 'status',
        'duration_ms', 'error_code', 'error_message', 'request_id', 'result', 'reason', 'message_id', 'remote_ip',
    ];

    public function handle(): int
    {
        $from = $this->option('from') ?: now('Asia/Tokyo')->toDateString();
        $to   = $this->option('to') ?: $from;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) || $from > $to) {
            $this->error('--from / --to は Y-m-d 形式で、from <= to にしてください。');
            return self::FAILURE;
        }

        $output = $this->option('output') ?: storage_path("app/gmo-aozora/api-log_{$from}_{$to}.csv");
        if (!is_dir(dirname($output))) {
            mkdir(dirname($output), 0775, true);
        }

        $fh = fopen($output, 'w');
        if ($fh === false) {
            $this->error("書き込めません: {$output}");
            return self::FAILURE;
        }
        fwrite($fh, "\xEF\xBB\xBF"); // Excel で文字化けしないよう BOM 付き UTF-8
        fputcsv($fh, self::COLUMNS);

        $logDir = rtrim($this->option('log-dir') ?: storage_path('logs'), '/');
        $rows = 0;
        $summary = [];
        $missing = [];
        foreach (CarbonPeriod::create($from, $to) as $day) {
            $file = $logDir . '/gmo-aozora-api-' . $day->toDateString() . '.log';
            if (!is_file($file)) {
                $missing[] = $day->toDateString();
                continue;
            }
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $rec = json_decode($line, true);
                if (!is_array($rec)) {
                    continue;
                }
                fputcsv($fh, array_map(fn ($c) => isset($rec[$c]) ? (is_scalar($rec[$c]) ? (string) $rec[$c] : json_encode($rec[$c], JSON_UNESCAPED_UNICODE)) : '', self::COLUMNS));
                $rows++;

                $key = ($rec['direction'] ?? '?') . ' / ' . ($rec['scope'] ?? '?');
                $summary[$key] ??= ['total' => 0, 'ok' => 0];
                $summary[$key]['total']++;
                $status = (int) ($rec['status'] ?? 0);
                if ($status >= 200 && $status < 300) {
                    $summary[$key]['ok']++;
                }
            }
        }
        fclose($fh);

        ksort($summary);
        $this->table(['direction / scope', '件数', '2xx'], array_map(
            fn ($k, $v) => [$k, $v['total'], $v['ok']], array_keys($summary), $summary
        ));
        if ($missing) {
            $this->warn('ログファイルが無い日: ' . implode(', ', $missing));
        }
        $this->info("{$rows} 行を書き出しました: {$output}");
        return self::SUCCESS;
    }
}
