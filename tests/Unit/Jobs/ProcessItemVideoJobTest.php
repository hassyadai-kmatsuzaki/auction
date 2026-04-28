<?php

namespace Tests\Unit\Jobs;

use App\Jobs\ProcessItemVideoJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Services\StorageService;
use App\Services\VideoProcessingService;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class ProcessItemVideoJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Storage::fake('public');
        config(['filesystems.disks.s3.key' => '', 'filesystems.disks.s3.bucket' => '']);
    }

    public function test_default_properties_and_queue(): void
    {
        $job = new ProcessItemVideoJob(123);
        $this->assertSame(123, $job->mediaId);
        $this->assertSame(2, $job->tries);
        $this->assertSame(1800, $job->timeout);
        $this->assertSame('media', $job->queue);
    }

    private function makeItem(): Item
    {
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $sp = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id]);
        return Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sp->id,
        ]);
    }

    public function test_handle_returns_early_when_media_missing(): void
    {
        $video = Mockery::mock(VideoProcessingService::class);
        $video->shouldNotReceive('compress');

        (new ProcessItemVideoJob(99999))->handle($video, app(StorageService::class));
        $this->assertTrue(true);
    }

    public function test_handle_returns_early_when_already_processed(): void
    {
        $item = $this->makeItem();
        $media = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/mp4',
            'file_name' => 'a.mp4',
            'file_size' => 100,
            'file_path' => 'videos/a.mp4',
            'is_processed' => true,
            'display_order' => 1,
        ]);

        $video = Mockery::mock(VideoProcessingService::class);
        $video->shouldNotReceive('compress');

        (new ProcessItemVideoJob($media->id))->handle($video, app(StorageService::class));
        $this->assertTrue($media->fresh()->is_processed);
    }

    public function test_handle_logs_and_skips_when_compress_returns_null(): void
    {
        $item = $this->makeItem();
        $media = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/quicktime',
            'file_name' => 'orig.mov',
            'file_size' => 999,
            'file_path' => 'videos/orig.mov',
            'is_processed' => false,
            'display_order' => 1,
        ]);

        $video = Mockery::mock(VideoProcessingService::class);
        $video->shouldReceive('compress')->once()->with('videos/orig.mov')->andReturn(null);

        (new ProcessItemVideoJob($media->id))->handle($video, app(StorageService::class));

        $media->refresh();
        $this->assertFalse($media->is_processed);
        $this->assertSame('videos/orig.mov', $media->file_path);
    }

    public function test_handle_updates_media_and_deletes_original_on_success(): void
    {
        $item = $this->makeItem();
        Storage::disk('public')->put('videos/orig.mov', 'orig-bytes');
        Storage::disk('public')->put('videos/orig.mp4', 'encoded-bytes');

        $media = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/quicktime',
            'file_name' => 'orig.mov',
            'file_size' => 10,
            'file_path' => 'videos/orig.mov',
            'is_processed' => false,
            'display_order' => 1,
        ]);

        $video = Mockery::mock(VideoProcessingService::class);
        $video->shouldReceive('compress')
            ->once()->with('videos/orig.mov')->andReturn('videos/orig.mp4');

        (new ProcessItemVideoJob($media->id))->handle($video, app(StorageService::class));

        $media->refresh();
        $this->assertTrue($media->is_processed);
        $this->assertSame('videos/orig.mp4', $media->file_path);
        $this->assertSame('video/mp4', $media->mime_type);
        Storage::disk('public')->assertMissing('videos/orig.mov');
        Storage::disk('public')->assertExists('videos/orig.mp4');
    }

    public function test_handle_keeps_file_when_encoded_path_equals_original(): void
    {
        $item = $this->makeItem();
        Storage::disk('public')->put('videos/same.mp4', 'bytes');

        $media = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/mp4',
            'file_name' => 'same.mp4',
            'file_size' => 5,
            'file_path' => 'videos/same.mp4',
            'is_processed' => false,
            'display_order' => 1,
        ]);

        $video = Mockery::mock(VideoProcessingService::class);
        $video->shouldReceive('compress')
            ->once()->with('videos/same.mp4')->andReturn('videos/same.mp4');

        (new ProcessItemVideoJob($media->id))->handle($video, app(StorageService::class));

        $media->refresh();
        $this->assertTrue($media->is_processed);
        Storage::disk('public')->assertExists('videos/same.mp4');
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
