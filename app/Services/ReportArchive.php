<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * 自動生成した週次・月次レポート（JSON）の保存と一覧（F-060）
 * 保存先: 既定ディスクの reports/{種類}_{開始日}_{終了日}.json
 */
class ReportArchive
{
    public const DIR = 'reports';

    /** ファイル名の形式（パスの指定を受け付けないよう、この形だけを許可する） */
    public const FILENAME_PATTERN = '/^(weekly|monthly)_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/';

    /**
     * @return string 保存したパス
     */
    public function save(array $report, string $type): string
    {
        $path = self::DIR . "/{$type}_{$report['period']['start']}_{$report['period']['end']}.json";
        Storage::put($path, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $path;
    }

    /**
     * 保存済みレポートの一覧（期間の新しい順。期間が終わっていないものは除く）
     *
     * @return array<int, array{filename: string, type: string, start: string, end: string, generated_at: ?string}>
     */
    public function list(): array
    {
        $rows = [];
        foreach (Storage::files(self::DIR) as $path) {
            $filename = basename($path);
            if (!preg_match(self::FILENAME_PATTERN, $filename)) {
                continue;
            }
            [$type, $start, $endWithExt] = explode('_', $filename);
            // 期間が終わっていないもの（旧仕様で月曜・月初に当週・当月を保存したファイル）は途中の数字なので出さない
            if (substr($endWithExt, 0, 10) >= now()->toDateString()) {
                continue;
            }
            $rows[] = [
                'filename' => $filename,
                'type' => $type,
                'start' => $start,
                'end' => substr($endWithExt, 0, 10),
                'generated_at' => $this->lastModified($path),
            ];
        }

        usort($rows, fn ($a, $b) => [$b['start'], $a['type']] <=> [$a['start'], $b['type']]);

        return $rows;
    }

    public function get(string $filename): ?array
    {
        if (!preg_match(self::FILENAME_PATTERN, $filename)) {
            return null;
        }
        $path = self::DIR . '/' . $filename;
        if (!Storage::exists($path)) {
            return null;
        }

        return json_decode((string) Storage::get($path), true) ?: null;
    }

    private function lastModified(string $path): ?string
    {
        try {
            return date(DATE_ATOM, Storage::lastModified($path));
        } catch (\Throwable) {
            return null;
        }
    }
}
