<?php

namespace Tests\Unit\Services;

use App\Services\MediaOptimizer;
use App\Services\StorageService;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToCheckFileExistence;
use League\Flysystem\UnableToReadFile;
use Tests\TestCase;

/**
 * A-12（exists/get の例外を 500 にしない）/ B-8（変換の排他）/ キャッシュキー互換
 */
class MediaOptimizerTest extends TestCase
{
    private function optimizer(): MediaOptimizer
    {
        config(['filesystems.disks.s3.key' => '', 'filesystems.disks.s3.bucket' => '']);
        return new MediaOptimizer(new StorageService());
    }

    public function test_exists_は_Flysystem例外を握ってfalse(): void
    {
        $disk = \Mockery::mock(Filesystem::class);
        $disk->shouldReceive('exists')->once()->andThrow(UnableToCheckFileExistence::forLocation('cache/media/x.webp'));
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);

        $this->assertFalse($this->optimizer()->exists('public', 'cache/media/x.webp'));
    }

    public function test_read_は_Flysystem例外を握ってnull(): void
    {
        $disk = \Mockery::mock(Filesystem::class);
        $disk->shouldReceive('get')->once()->andThrow(UnableToReadFile::fromLocation('items/1/1/a.jpg'));
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);

        $this->assertNull($this->optimizer()->read('public', 'items/1/1/a.jpg'));
    }

    public function test_cachePath_は_旧実装と同じ式(): void
    {
        $opt = $this->optimizer();
        $p = $opt->resolveParams('small');
        $this->assertSame(['width' => 400, 'quality' => 75, 'format' => 'webp'], ['width' => $p['width'], 'quality' => $p['quality'], 'format' => $p['format']]);
        $expected = 'cache/media/' . md5('items/1/1/a.jpg' . '_400_75_webp') . '.webp';
        $this->assertSame($expected, $opt->cachePath('items/1/1/a.jpg', $p));
    }

    public function test_resolveParams_は_不正値を丸める(): void
    {
        $p = $this->optimizer()->resolveParams(null, 99999, 999, 'gif');
        $this->assertSame(MediaOptimizer::MAX_WIDTH, $p['width']);
        $this->assertSame(100, $p['quality']);
        $this->assertSame('webp', $p['format']);
    }

    public function test_extractStoragePath_は_S3_ローカル_相対の3形式を受ける(): void
    {
        $opt = $this->optimizer();
        $this->assertSame('items/1/2/a.jpg', $opt->extractStoragePath('https://bucket.s3.ap-northeast-1.amazonaws.com/items/1/2/a.jpg'));
        $this->assertSame('items/1/2/a.jpg', $opt->extractStoragePath('http://localhost/storage/items/1/2/a.jpg'));
        $this->assertSame('items/1/2/a.jpg', $opt->extractStoragePath('items/1/2/a.jpg'));
        $this->assertNull($opt->extractStoragePath('https://example.com/other/a.jpg'));
    }

    public function test_variant_は_ロック待ちに失敗したら元画像をそのまま返しキャッシュしない(): void
    {
        Storage::fake('public');
        config(['media.convert_wait_seconds' => 0]);
        $png = $this->png(120, 80);
        Storage::disk('public')->put('items/1/1/a.png', $png);

        $opt = $this->optimizer();
        $p = $opt->resolveParams('thumb');
        // 他プロセスが変換中の体でロックを握っておく
        $held = Cache::lock('media:convert:' . md5($opt->cachePath('items/1/1/a.png', $p)), 20);
        $this->assertTrue($held->get());

        $v = $opt->variant('items/1/1/a.png', $p, 'image/png');
        $this->assertSame('original', $v['source']);
        $this->assertSame($png, $v['content']);
        $this->assertSame('image/png', $v['mime']);
        $this->assertEmpty(Storage::disk('public')->files('cache/media'));
        $held->release();
    }

    public function test_variant_は_生成してキャッシュし_2回目はキャッシュを返す(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('items/1/1/a.png', $this->png(300, 200));
        $opt = $this->optimizer();
        $p = $opt->resolveParams('thumb');

        $first = $opt->variant('items/1/1/a.png', $p);
        $this->assertSame('generated', $first['source']);
        $this->assertSame('image/webp', $first['mime']);
        $this->assertCount(1, Storage::disk('public')->files('cache/media'));

        $second = $opt->variant('items/1/1/a.png', $p);
        $this->assertSame('cache', $second['source']);
        $this->assertSame($first['content'], $second['content']);
    }

    public function test_warm_は_プリセットごとに結果を返す(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('items/1/1/a.png', $this->png(300, 200));
        $opt = $this->optimizer();

        $this->assertSame(['thumb' => 'generated', 'small' => 'generated'], $opt->warm('items/1/1/a.png', ['thumb', 'small']));
        $this->assertSame(['thumb' => 'cached', 'small' => 'cached'], $opt->warm('items/1/1/a.png', ['thumb', 'small']));
        $this->assertSame(['thumb' => 'missing'], $opt->warm('items/9/9/none.png', ['thumb']));
    }

    private function png(int $w, int $h): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, 10, 120, 200));
        ob_start();
        imagepng($im);
        $bytes = ob_get_clean();
        imagedestroy($im);
        return $bytes;
    }
}
