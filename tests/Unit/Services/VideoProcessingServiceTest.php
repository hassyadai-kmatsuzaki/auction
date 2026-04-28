<?php

namespace Tests\Unit\Services;

use App\Services\StorageService;
use App\Services\VideoProcessingService;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * VideoProcessingService の Unit テスト。
 *
 * ffmpeg を実行するメソッドは外部プロセス依存のため、
 * - 入力ファイルが存在しないケース（早期 null 返却）
 * - StorageService 経由のパス決定
 * を中心に検証する。
 */
class VideoProcessingServiceTest extends TestCase
{
    private VideoProcessingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config(['filesystems.disks.s3.key' => '', 'filesystems.disks.s3.bucket' => '']);
        $this->service = new VideoProcessingService(new StorageService());
    }

    public function test_generatePoster_は_存在しないファイルでnull(): void
    {
        $this->assertNull($this->service->generatePoster('items/1/2/missing.mov'));
    }

    public function test_compress_は_存在しないファイルでnull(): void
    {
        $this->assertNull($this->service->compress('items/1/2/missing.mov'));
    }

    public function test_generatePoster_は_ffmpeg未インストールならnull(): void
    {
        // ファイルは存在するが ffmpeg が無いか入力が無効なため Process が失敗する
        Storage::disk('public')->put('items/1/2/sample.mov', 'fake video bytes');

        // ffmpeg コマンドがある環境ではエンコードに失敗（fake bytes なので）→ null
        // ffmpeg が無い環境では ProcessFailedException → null
        $result = $this->service->generatePoster('items/1/2/sample.mov');
        $this->assertNull($result);
    }

    public function test_compress_は_無効な入力でnull(): void
    {
        Storage::disk('public')->put('items/1/2/sample.mov', 'fake video bytes');

        $result = $this->service->compress('items/1/2/sample.mov');
        $this->assertNull($result);
    }

    public function test_generatePoster_は_有効な動画からJPEGポスターを生成しストレージに保存する(): void
    {
        if (!$this->ffmpegAvailable()) {
            $this->markTestSkipped('ffmpeg not installed on this environment');
        }

        $sampleMp4 = $this->generateSampleVideo();
        Storage::disk('public')->put('items/1/2/origin.mp4', file_get_contents($sampleMp4));
        @unlink($sampleMp4);

        $posterPath = $this->service->generatePoster('items/1/2/origin.mp4');

        $this->assertNotNull($posterPath, 'ポスターパスが返る');
        $this->assertStringContainsString('items/1/2/origin_poster_', $posterPath);
        $this->assertStringEndsWith('.jpg', $posterPath);
        $this->assertTrue(Storage::disk('public')->exists($posterPath));

        // JPEG SOI マーカーが先頭にあることを確認
        $head = substr(Storage::disk('public')->get($posterPath), 0, 3);
        $this->assertSame("\xFF\xD8\xFF", $head, 'JPEG マジックバイト');
    }

    public function test_compress_は_有効な動画をH264_MP4に再エンコードする(): void
    {
        if (!$this->ffmpegAvailable()) {
            $this->markTestSkipped('ffmpeg not installed on this environment');
        }

        $sampleMp4 = $this->generateSampleVideo();
        Storage::disk('public')->put('items/3/4/raw.mp4', file_get_contents($sampleMp4));
        @unlink($sampleMp4);

        $outPath = $this->service->compress('items/3/4/raw.mp4');

        $this->assertNotNull($outPath);
        $this->assertStringContainsString('items/3/4/raw_enc_', $outPath);
        $this->assertStringEndsWith('.mp4', $outPath);
        $this->assertTrue(Storage::disk('public')->exists($outPath));

        // mp4 ファイルとして妥当（5-8 バイト目に 'ftyp' シグネチャ）
        $head = substr(Storage::disk('public')->get($outPath), 4, 4);
        $this->assertSame('ftyp', $head, 'MP4 ftyp ボックス');
    }

    public function test_compress_は_派生パスをユニーク化する(): void
    {
        if (!$this->ffmpegAvailable()) {
            $this->markTestSkipped('ffmpeg not installed on this environment');
        }

        $sampleMp4 = $this->generateSampleVideo();
        Storage::disk('public')->put('items/9/9/clip.mp4', file_get_contents($sampleMp4));
        @unlink($sampleMp4);

        $a = $this->service->compress('items/9/9/clip.mp4');
        $b = $this->service->compress('items/9/9/clip.mp4');

        $this->assertNotNull($a);
        $this->assertNotNull($b);
        $this->assertNotSame($a, $b, 'derivePath はランダムサフィックスでユニーク化される');
    }

    private function ffmpegAvailable(): bool
    {
        $out = [];
        $ret = 0;
        @exec('which ffmpeg 2>/dev/null', $out, $ret);
        return $ret === 0 && !empty($out);
    }

    private function generateSampleVideo(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'vid_') . '.mp4';
        @unlink($path);
        $cmd = sprintf(
            'ffmpeg -y -f lavfi -i color=c=red:size=320x240:duration=2 -c:v libx264 -pix_fmt yuv420p -t 2 %s 2>/dev/null',
            escapeshellarg($path)
        );
        exec($cmd);
        if (!file_exists($path)) {
            $this->fail('Failed to generate sample mp4 via ffmpeg');
        }
        return $path;
    }
}
