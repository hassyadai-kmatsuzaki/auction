<?php

namespace Tests\Feature\GmoAozora;

use Tests\TestCase;

/**
 * gmo-aozora:export-api-log（GMO へ提出する API 実行ログの CSV 化）。
 */
class ExportApiLogCommandTest extends TestCase
{
    public function test_exports_jsonl_logs_in_range_to_csv(): void
    {
        $dir = sys_get_temp_dir() . '/gmo-export-' . uniqid();
        mkdir($dir);
        file_put_contents("{$dir}/gmo-aozora-api-2026-10-01.log", implode("\n", [
            '{"ts":"2026-10-01T10:00:00.000+09:00","env":"development","direction":"outbound","scope":"account","context":"accounts","method":"GET","url":"https://stg-api.gmo-aozora.com/ganb/api/corporation/v1/accounts","status":200,"duration_ms":120}',
            '{"ts":"2026-10-01T10:00:01.000+09:00","env":"development","direction":"outbound","scope":"transfer","context":"transferStatus","method":"GET","url":"https://stg-api.gmo-aozora.com/ganb/api/corporation/v1/transfer/status?accountId=1","status":403,"error_code":"ERR403"}',
            'not json',
        ]) . "\n");
        file_put_contents("{$dir}/gmo-aozora-api-2026-10-03.log",
            '{"ts":"2026-10-03T09:00:00.000+09:00","env":"development","direction":"inbound","scope":"virtual-account","context":"webhook:va-deposit-transaction","method":"POST","url":"api/gmo-aozora/webhook","status":200,"result":"accepted","message_id":"0000000000123456789"}' . "\n");
        $out = "{$dir}/out.csv";

        $this->artisan('gmo-aozora:export-api-log', [
            '--from' => '2026-10-01', '--to' => '2026-10-03', '--output' => $out, '--log-dir' => $dir,
        ])->expectsOutputToContain('3 行を書き出しました')
          ->expectsOutputToContain('ログファイルが無い日: 2026-10-02')
          ->assertExitCode(0);

        $csv = array_map('str_getcsv', file($out, FILE_IGNORE_NEW_LINES));
        $header = $csv[0];
        $header[0] = ltrim($header[0], "\xEF\xBB\xBF");
        $this->assertSame('ts', $header[0]);
        $this->assertCount(4, $csv); // ヘッダ + 3 行（壊れた行は飛ばす）
        $row = array_combine($header, $csv[2]);
        $this->assertSame('transfer', $row['scope']);
        $this->assertSame('403', $row['status']);
        $this->assertSame('ERR403', $row['error_code']);
        $row = array_combine($header, $csv[3]);
        $this->assertSame('inbound', $row['direction']);
        $this->assertSame('0000000000123456789', $row['message_id']);

        array_map('unlink', glob("{$dir}/*"));
        rmdir($dir);
    }

    public function test_rejects_bad_range(): void
    {
        $this->artisan('gmo-aozora:export-api-log', ['--from' => '2026-10-05', '--to' => '2026-10-01'])
            ->assertExitCode(1);
    }
}
