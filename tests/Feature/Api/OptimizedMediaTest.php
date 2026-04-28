<?php

namespace Tests\Feature\Api;

use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Models\Auction;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * OptimizedMediaController のテスト。
 *
 * - GET /api/media/{mediaId}/optimized
 * - GET /api/media/optimized-by-path
 * いずれも認証不要（public 配信）
 */
class OptimizedMediaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Storage::fake('public');
        // OptimizedMediaController は StorageService::disk() を見て public/s3 を判定する
        config(['filesystems.disks.s3.key' => '', 'filesystems.disks.s3.bucket' => '']);
    }

    private function makeMedia(string $mime = 'image/jpeg', ?string $path = null): ItemMedia
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->create(['created_by' => $admin->id]);
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        $filePath = $path ?? 'items/1/1/sample.jpg';
        return ItemMedia::create([
            'item_id'    => $item->id,
            'media_type' => str_starts_with($mime, 'video/') ? 'video_top' : 'photo_top',
            'file_path'  => $filePath,
            'file_name'  => basename($filePath),
            'mime_type'  => $mime,
            'file_size'  => 100,
            'display_order' => 1,
            'is_thumbnail' => false,
        ]);
    }

    public function test_show_は_存在しないmediaIdで404(): void
    {
        $this->get('/api/media/999999/optimized')->assertStatus(404);
    }

    public function test_show_は_動画は元URLへリダイレクト(): void
    {
        $media = $this->makeMedia('video/mp4', 'items/1/1/clip.mp4');
        Storage::disk('public')->put('items/1/1/clip.mp4', 'fake');

        $this->get("/api/media/{$media->id}/optimized")
            ->assertStatus(302);
    }

    public function test_show_は_有効な画像で200と画像レスポンスを返す(): void
    {
        $imageContent = $this->makePngBytes(200, 150);
        Storage::disk('public')->put('items/1/1/sample.png', $imageContent);
        $media = $this->makeMedia('image/png', 'items/1/1/sample.png');

        $r = $this->get("/api/media/{$media->id}/optimized?preset=thumb");
        $r->assertStatus(200);
        $this->assertStringContainsString('image/', $r->headers->get('Content-Type'));
        // ETag / Cache-Control が付く
        $this->assertNotEmpty($r->headers->get('ETag'));
        $this->assertStringContainsString('max-age', $r->headers->get('Cache-Control') ?? '');
    }

    public function test_show_は_キャッシュが既にあれば再利用される(): void
    {
        $imageContent = $this->makePngBytes(120, 80);
        Storage::disk('public')->put('items/1/1/cached.png', $imageContent);
        $media = $this->makeMedia('image/png', 'items/1/1/cached.png');

        // 1 回目で キャッシュ作成
        $this->get("/api/media/{$media->id}/optimized?w=100&q=70&f=webp")->assertStatus(200);

        // キャッシュファイルが置かれていることを確認
        $cacheFiles = Storage::disk('public')->files('cache/media');
        $this->assertNotEmpty($cacheFiles);

        // 2 回目も 200
        $this->get("/api/media/{$media->id}/optimized?w=100&q=70&f=webp")->assertStatus(200);
    }

    public function test_showByPath_は_pathパラメータ未指定で400(): void
    {
        $this->get('/api/media/optimized-by-path')->assertStatus(400);
    }

    public function test_showByPath_は_該当ファイル無しで404(): void
    {
        $this->get('/api/media/optimized-by-path?path=https://example.com/items/9/9/missing.jpg')
            ->assertStatus(404);
    }

    /**
     * 単純な PNG バイト列を生成（GD で画像最適化処理が通る最小限）。
     */
    private function makePngBytes(int $w, int $h): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, 200, 100, 50));
        ob_start();
        imagepng($im);
        $bytes = ob_get_clean();
        imagedestroy($im);
        return $bytes;
    }
}
