<?php

namespace App\Console\Commands;

use App\Models\ItemMedia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MigrateItemMediaToS3 extends Command
{
    protected $signature = 'media:migrate-to-s3
        {--dry-run : 何もせず処理対象を表示}
        {--delete-local : S3 への存在確認後に local 側を削除}
        {--id-from= : item_media.id の下限 (含む)}
        {--id-to= : item_media.id の上限 (含む)}
        {--limit= : 最大処理件数}
        {--no-acl : public-read ACL を付けずに put する (バケットが BucketOwnerEnforced のとき)}';

    protected $description = 'item_media の file_path / poster_path を local public disk から S3 へ同じキーで複製する';

    public function handle(): int
    {
        $bucket = config('filesystems.disks.s3.bucket');
        if (empty($bucket)) {
            $this->error('AWS_BUCKET が未設定です。');
            return self::FAILURE;
        }
        $this->info("対象バケット: {$bucket}");

        // put 失敗を Laravel が握りつぶさないように throw=true で再ビルドする。
        // 静かな false を返されると AWS の本当のエラー文が消えるため。
        config(['filesystems.disks.s3.throw' => true]);
        Storage::forgetDisk('s3');

        $dryRun      = (bool) $this->option('dry-run');
        $deleteLocal = (bool) $this->option('delete-local');
        $noAcl       = (bool) $this->option('no-acl');

        $stats = [
            'scanned_rows'        => 0,
            'paths_uploaded'      => 0,
            'paths_skipped_s3'    => 0,
            'paths_skipped_url'   => 0,
            'paths_missing_local' => 0,
            'paths_failed'        => 0,
            'local_deleted'       => 0,
        ];

        $query = ItemMedia::query()->orderBy('id');
        if ($from = $this->option('id-from')) {
            $query->where('id', '>=', (int) $from);
        }
        if ($to = $this->option('id-to')) {
            $query->where('id', '<=', (int) $to);
        }
        $hardLimit = $this->option('limit') ? (int) $this->option('limit') : null;

        $query->chunkById(200, function ($rows) use (&$stats, $dryRun, $deleteLocal, $noAcl, $hardLimit) {
            foreach ($rows as $m) {
                $stats['scanned_rows']++;
                foreach (['file_path', 'poster_path'] as $col) {
                    $this->migrateOne($m, $col, $stats, $dryRun, $deleteLocal, $noAcl);
                    if ($hardLimit !== null && $stats['paths_uploaded'] >= $hardLimit) {
                        return false;
                    }
                }
            }
            return true;
        });

        $this->newLine();
        $this->table(array_keys($stats), [array_values($stats)]);
        $this->info($dryRun ? '[dry-run] 実書き込みは行っていません。' : '完了');

        return self::SUCCESS;
    }

    private function migrateOne(ItemMedia $m, string $col, array &$stats, bool $dryRun, bool $deleteLocal, bool $noAcl): void
    {
        $path = $m->{$col};
        if (!$path) {
            return;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            $stats['paths_skipped_url']++;
            return;
        }

        $local = Storage::disk('public');
        $s3    = Storage::disk('s3');

        $localExists = $local->exists($path);
        $s3Exists    = $s3->exists($path);

        if ($s3Exists) {
            $stats['paths_skipped_s3']++;
            if ($deleteLocal && $localExists && !$dryRun) {
                $deleted = $local->delete($path);
                if ($deleted) {
                    $stats['local_deleted']++;
                } else {
                    $stats['local_delete_failed']++;
                    $abs = storage_path('app/public/' . $path);
                    $owner = file_exists($abs) ? (posix_getpwuid(fileowner($abs))['name'] ?? '?') : '?';
                    $this->warn(sprintf('  local 削除失敗 media_id=%d col=%s path=%s owner=%s', $m->id, $col, $path, $owner));
                }
            }
            return;
        }

        if (!$localExists) {
            $this->warn(sprintf('  local 不在 media_id=%d col=%s path=%s', $m->id, $col, $path));
            $stats['paths_missing_local']++;
            return;
        }

        $bytes = $local->size($path);

        if ($dryRun) {
            $this->line(sprintf('[dry-run] upload media_id=%d col=%s path=%s (%s bytes)', $m->id, $col, $path, number_format($bytes)));
            $stats['paths_uploaded']++;
            return;
        }

        try {
            $stream = $local->readStream($path);

            $options = ['ContentType' => $this->guessMime($m, $col, $path)];
            if (!$noAcl) {
                $options['visibility'] = 'public';
                $options['ACL']        = 'public-read';
            }

            $ok = $s3->put($path, $stream, $options);

            if (is_resource($stream)) {
                fclose($stream);
            }

            if ($ok === false) {
                throw new \RuntimeException('Storage::put が false を返した');
            }
            if (!$s3->exists($path)) {
                throw new \RuntimeException('put 後の exists() で見えない');
            }
            $s3Size = $s3->size($path);
            if ((int) $s3Size !== (int) $bytes) {
                throw new \RuntimeException(sprintf('サイズ不一致 local=%d s3=%d', $bytes, $s3Size));
            }

            $stats['paths_uploaded']++;
            $this->line(sprintf('OK   media_id=%d col=%s path=%s', $m->id, $col, $path));

            if ($deleteLocal) {
                $local->delete($path);
                $stats['local_deleted']++;
            }
        } catch (\Throwable $e) {
            $this->error(sprintf('FAIL media_id=%d col=%s path=%s err=%s', $m->id, $col, $path, $e->getMessage()));
            $stats['paths_failed']++;
        }
    }

    private function guessMime(ItemMedia $m, string $col, string $path): string
    {
        if ($col === 'file_path' && $m->mime_type) {
            return $m->mime_type;
        }
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        return match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png'         => 'image/png',
            'webp'        => 'image/webp',
            'gif'         => 'image/gif',
            'mp4'         => 'video/mp4',
            'mov'         => 'video/quicktime',
            'webm'        => 'video/webm',
            default       => 'application/octet-stream',
        };
    }
}
