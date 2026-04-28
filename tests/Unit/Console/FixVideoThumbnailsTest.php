<?php

namespace Tests\Unit\Console;

use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Services\StorageService;
use Mockery;
use Tests\TestCase;

class FixVideoThumbnailsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        // StorageService::url() を固定 URL を返すモックに差し替え
        $mock = Mockery::mock(StorageService::class);
        $mock->shouldReceive('url')->andReturnUsing(fn ($p) => 'https://cdn.test/' . $p);
        $mock->shouldReceive('disk')->andReturn('local')->byDefault();
        $this->app->instance(StorageService::class, $mock);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeItem(): Item
    {
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        return Item::factory()->create([
            'seller_profile_id' => $sellerProfile->id,
            'thumbnail_path' => null,
        ]);
    }

    public function test_command_fixes_video_thumbnail_to_photo(): void
    {
        $item = $this->makeItem();

        $video = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/mp4',
            'file_path' => 'videos/a.mp4',
            'file_name' => 'a.mp4',
            'is_thumbnail' => true,
            'display_order' => 0,
        ]);
        $photo = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'mime_type' => 'image/jpeg',
            'file_path' => 'photos/a.jpg',
            'file_name' => 'a.jpg',
            'is_thumbnail' => false,
            'display_order' => 1,
        ]);

        $this->artisan('items:fix-video-thumbnails')
            ->expectsOutputToContain('修正対象商品')
            ->assertExitCode(0);

        $this->assertFalse((bool) $video->fresh()->is_thumbnail);
        $this->assertTrue((bool) $photo->fresh()->is_thumbnail);
        $this->assertSame('https://cdn.test/photos/a.jpg', $item->fresh()->getRawOriginal('thumbnail_path'));
    }

    public function test_command_clears_thumbnail_path_when_no_photo_exists(): void
    {
        $item = $this->makeItem();

        ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/mp4',
            'file_path' => 'videos/a.mp4',
            'file_name' => 'a.mp4',
            'is_thumbnail' => true,
            'display_order' => 0,
        ]);

        $this->artisan('items:fix-video-thumbnails')->assertExitCode(0);

        $this->assertNull($item->fresh()->getRawOriginal('thumbnail_path'));
    }

    public function test_dry_run_does_not_modify_db(): void
    {
        $item = $this->makeItem();
        $video = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/mp4',
            'file_path' => 'videos/a.mp4',
            'file_name' => 'a.mp4',
            'is_thumbnail' => true,
            'display_order' => 0,
        ]);

        $this->artisan('items:fix-video-thumbnails', ['--dry-run' => true])
            ->expectsOutputToContain('[dry-run]')
            ->assertExitCode(0);

        $this->assertTrue((bool) $video->fresh()->is_thumbnail);
    }

    public function test_command_handles_no_targets(): void
    {
        $this->artisan('items:fix-video-thumbnails')
            ->expectsOutputToContain('動画サムネイルのメディア: 0 件')
            ->assertExitCode(0);
    }

    public function test_command_fixes_thumbnail_path_pointing_to_video_url(): void
    {
        $item = $this->makeItem();
        // raw value を保存（アクセサで NULL に変換されるため forceFill）
        Item::withoutEvents(function () use ($item) {
            $item->forceFill(['thumbnail_path' => 'https://cdn.test/videos/a.mp4'])->save();
        });

        $photo = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'mime_type' => 'image/jpeg',
            'file_path' => 'photos/b.jpg',
            'file_name' => 'b.jpg',
            'is_thumbnail' => false,
            'display_order' => 0,
        ]);

        $this->artisan('items:fix-video-thumbnails')
            ->expectsOutputToContain('thumbnail_path が動画URLの商品: 1 件')
            ->assertExitCode(0);

        $this->assertSame('https://cdn.test/photos/b.jpg', $item->fresh()->getRawOriginal('thumbnail_path'));
        $this->assertTrue((bool) $photo->fresh()->is_thumbnail);
    }
}
