<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class VideoProcessingService
{
    private const VIDEO_LONG_EDGE = 2160;
    private const POSTER_LONG_EDGE = 720;
    private const CRF = 26;
    private const AUDIO_BITRATE = '128k';
    private const POSTER_AT_SECONDS = '00:00:01';

    public function __construct(
        private readonly StorageService $storage,
    ) {}

    /**
     * 動画から 1 秒目の JPEG ポスターを生成してストレージに保存する。
     * 戻り値はストレージ内のパス（失敗時 null）。
     */
    public function generatePoster(string $sourcePath): ?string
    {
        $disk = $this->storage->disk();
        $localSource = $this->copyToLocal($disk, $sourcePath);
        if (!$localSource) {
            return null;
        }

        $localPoster = tempnam(sys_get_temp_dir(), 'poster_') . '.jpg';
        try {
            $process = new Process([
                $this->ffmpegBin(), '-y',
                '-ss', self::POSTER_AT_SECONDS,
                '-i', $localSource,
                '-frames:v', '1',
                '-update', '1',
                '-vf', 'scale=\'min(' . self::POSTER_LONG_EDGE . ',iw)\':-2',
                '-q:v', '3',
                $localPoster,
            ]);
            $process->setTimeout(120);
            $process->mustRun();

            $posterPath = $this->derivePath($sourcePath, 'poster', 'jpg');
            $this->putFromLocal($disk, $localPoster, $posterPath, 'image/jpeg');

            return $posterPath;
        } catch (ProcessFailedException $e) {
            Log::error('動画ポスター生成失敗: ' . $e->getMessage(), ['source' => $sourcePath]);
            return null;
        } finally {
            @unlink($localSource);
            @unlink($localPoster);
        }
    }

    /**
     * H.264 / 長辺720px / CRF26 / AAC128k / +faststart で再エンコードして
     * ストレージに保存し、新しいパスを返す（失敗時 null）。
     */
    public function compress(string $sourcePath): ?string
    {
        $disk = $this->storage->disk();
        $localSource = $this->copyToLocal($disk, $sourcePath);
        if (!$localSource) {
            return null;
        }

        $localOut = tempnam(sys_get_temp_dir(), 'enc_') . '.mp4';
        try {
            $process = new Process([
                $this->ffmpegBin(), '-y',
                '-i', $localSource,
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-crf', (string) self::CRF,
                '-vf', 'scale=\'if(gt(iw,ih),min(' . self::VIDEO_LONG_EDGE . ',iw),-2)\':\'if(gt(iw,ih),-2,min(' . self::VIDEO_LONG_EDGE . ',ih))\'',
                '-c:a', 'aac',
                '-b:a', self::AUDIO_BITRATE,
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
                $localOut,
            ]);
            $process->setTimeout(1800);
            $process->mustRun();

            $outPath = $this->derivePath($sourcePath, 'enc', 'mp4');
            $this->putFromLocal($disk, $localOut, $outPath, 'video/mp4');

            return $outPath;
        } catch (ProcessFailedException $e) {
            Log::error('動画圧縮失敗: ' . $e->getMessage(), ['source' => $sourcePath]);
            return null;
        } finally {
            @unlink($localSource);
            @unlink($localOut);
        }
    }

    private function ffmpegBin(): string
    {
        return config('services.ffmpeg.bin') ?: 'ffmpeg';
    }

    private function copyToLocal(string $disk, string $path): ?string
    {
        if (!Storage::disk($disk)->exists($path)) {
            return null;
        }
        $ext = pathinfo($path, PATHINFO_EXTENSION) ?: 'bin';
        $local = tempnam(sys_get_temp_dir(), 'src_') . '.' . $ext;
        file_put_contents($local, Storage::disk($disk)->get($path));
        return $local;
    }

    private function putFromLocal(string $disk, string $localPath, string $destPath, string $mime): void
    {
        $stream = fopen($localPath, 'r');
        try {
            // S3 バケットが BucketOwnerEnforced のため ACL/visibility は付けない。
            // 公開はバケットポリシー側で制御する。
            Storage::disk($disk)->put($destPath, $stream, [
                'ContentType' => $mime,
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    /**
     * 元パス items/{auctionId}/{itemId}/{uuid}.mov を元に
     * items/{auctionId}/{itemId}/{uuid}_{suffix}.{ext} を返す。
     */
    private function derivePath(string $sourcePath, string $suffix, string $ext): string
    {
        $dir  = dirname($sourcePath);
        $base = pathinfo($sourcePath, PATHINFO_FILENAME);
        return trim($dir, '/') . '/' . $base . '_' . $suffix . '_' . Str::random(6) . '.' . $ext;
    }
}
