<?php

namespace Tests\Feature\Console;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** B-9: media:warm（開催前の variant 事前生成） */
class MediaWarmCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Storage::fake('public');
        config(['filesystems.disks.s3.key' => '', 'filesystems.disks.s3.bucket' => '']);
    }

    private function makeAuctionWithItems(int $count): Auction
    {
        $admin = $this->createAdmin();
        $auction = Auction::factory()->create(['created_by' => $admin->id]);
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        for ($i = 1; $i <= $count; $i++) {
            Storage::disk('public')->put("items/1/{$i}/t.png", $this->png(300, 200));
            Item::factory()->create([
                'auction_id' => $auction->id,
                'seller_profile_id' => $sellerProfile->id,
                'status' => 'registered',
                'thumbnail_path' => "http://localhost/storage/items/1/{$i}/t.png",
            ]);
        }
        return $auction;
    }

    public function test_auction未指定は失敗(): void
    {
        $this->artisan('media:warm')->assertExitCode(1);
    }

    public function test_存在しないauctionは失敗(): void
    {
        $this->artisan('media:warm', ['--auction' => 999999])->assertExitCode(1);
    }

    public function test_不明なプリセットは失敗(): void
    {
        $auction = $this->makeAuctionWithItems(1);
        $this->artisan('media:warm', ['--auction' => $auction->id, '--presets' => 'huge'])->assertExitCode(1);
    }

    public function test_商品サムネイルのvariantを生成し_2回目は生成しない(): void
    {
        $auction = $this->makeAuctionWithItems(3);

        $this->artisan('media:warm', ['--auction' => $auction->id, '--presets' => 'thumb,small'])->assertExitCode(0);
        $this->assertCount(6, Storage::disk('public')->files('cache/media'), '3商品 × 2プリセット');

        $this->artisan('media:warm', ['--auction' => $auction->id, '--presets' => 'thumb,small'])->assertExitCode(0);
        $this->assertCount(6, Storage::disk('public')->files('cache/media'), '既存は作り直さない');
    }

    private function png(int $w, int $h): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, 30, 90, 160));
        ob_start();
        imagepng($im);
        $bytes = ob_get_clean();
        imagedestroy($im);
        return $bytes;
    }
}
