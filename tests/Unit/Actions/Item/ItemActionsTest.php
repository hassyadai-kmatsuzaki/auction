<?php

namespace Tests\Unit\Actions\Item;

use App\Actions\Item\AdjustPriceAction;
use App\Actions\Item\DeleteMediaAction;
use App\Actions\Item\UploadMediaAction;
use App\Jobs\ProcessItemVideoJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\Lane;
use App\Models\PriceEvent;
use App\Models\SellerProfile;
use App\Services\VideoProcessingService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ItemActionsTest extends TestCase
{
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->live()->create(['created_by' => $admin->id]);
    }

    private function makeItem(array $overrides = []): Item
    {
        return Item::factory()->create(array_merge([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'current_price' => 30000,
            'status' => 'live',
        ], $overrides));
    }

    /**
     * StorageService の disk 解決を 'public' に固定する。
     * 本番 .env の AWS_* で s3 が選択されてしまうのを防ぐため、
     * config をクリアした上で StorageService の解決済みキャッシュを破棄する。
     */
    private function fakePublicStorage(): void
    {
        config()->set('filesystems.disks.s3.key', null);
        config()->set('filesystems.disks.s3.bucket', null);
        $this->app->forgetInstance(\App\Services\StorageService::class);
        Storage::fake('public');
        Storage::fake('s3');
    }

    // ─── AdjustPriceAction ──────────────────────────────────────

    public function test_adjustPrice_ライブ商品の価格を更新できる(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();

        $result = app(AdjustPriceAction::class)->execute($item, 50000.0, '修正', $admin->id);

        $this->assertTrue($result->success);
        $this->assertSame(50000.0, (float) $item->fresh()->current_price);
        $this->assertSame(30000.0, (float) $result->data['old_price']);
        $this->assertSame(50000.0, (float) $result->data['new_price']);
    }

    public function test_adjustPrice_は_PriceEventを記録する(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();

        app(AdjustPriceAction::class)->execute($item, 40000.0, 'テスト', $admin->id);

        $this->assertDatabaseHas('price_events', [
            'item_id' => $item->id,
            'reason' => PriceEvent::REASON_MANUAL_ADJUSTMENT,
        ]);
    }

    public function test_adjustPrice_live以外のステータスでは失敗する(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem(['status' => 'registered']);

        $result = app(AdjustPriceAction::class)->execute($item, 40000.0, null, $admin->id);

        $this->assertFalse($result->success);
        $this->assertStringContainsString('ライブ中', $result->message);
        // 価格は変わらない
        $this->assertSame(30000.0, (float) $item->fresh()->current_price);
    }

    public function test_adjustPrice_は_対象レーン無しでも成功する(): void
    {
        $admin = $this->createAdmin();
        $item = $this->makeItem();
        // current_item_id にセットされた lane が存在しないケース
        Lane::factory()->create(['auction_id' => $this->auction->id, 'current_item_id' => null]);

        $result = app(AdjustPriceAction::class)->execute($item, 35000.0, null, $admin->id);

        $this->assertTrue($result->success);
    }

    // ─── DeleteMediaAction ──────────────────────────────────────

    public function test_deleteMedia_は_メディアレコードとファイルを削除する(): void
    {
        $this->fakePublicStorage();
        $item = $this->makeItem();
        Storage::disk('public')->put('items/sample.jpg', 'dummy');

        $media = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_other',
            'file_path' => 'items/sample.jpg',
            'file_name' => 'sample.jpg',
            'file_size' => 100,
            'mime_type' => 'image/jpeg',
            'is_thumbnail' => false,
            'is_processed' => true,
            'display_order' => 1,
        ]);

        $result = app(DeleteMediaAction::class)->execute($item, $media);

        $this->assertTrue($result->success);
        $this->assertDatabaseMissing('item_media', ['id' => $media->id]);
        Storage::disk('public')->assertMissing('items/sample.jpg');
    }

    public function test_deleteMedia_は_サムネイル削除時にItemのthumbnail_pathもクリアする(): void
    {
        $this->fakePublicStorage();
        $item = $this->makeItem(['thumbnail_path' => '/storage/items/sample.jpg']);

        $media = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_other',
            'file_path' => 'items/sample.jpg',
            'file_name' => 'sample.jpg',
            'file_size' => 100,
            'mime_type' => 'image/jpeg',
            'is_thumbnail' => true,
            'is_processed' => true,
            'display_order' => 1,
        ]);

        app(DeleteMediaAction::class)->execute($item, $media);

        $this->assertNull($item->fresh()->thumbnail_path);
    }

    // ─── UploadMediaAction ──────────────────────────────────────

    public function test_uploadMedia_画像をアップロードしてレコード生成する(): void
    {
        $this->fakePublicStorage();
        $item = $this->makeItem();

        $file = UploadedFile::fake()->image('photo.jpg', 800, 600);
        $result = app(UploadMediaAction::class)->execute($item, $file, 'image', false);

        $this->assertTrue($result->success);
        $this->assertDatabaseHas('item_media', [
            'item_id' => $item->id,
            'media_type' => 'photo_other',
            'is_processed' => true,
        ]);
    }

    public function test_uploadMedia_isThumbnail_trueでサムネ設定される(): void
    {
        $this->fakePublicStorage();
        $item = $this->makeItem();

        $existing = ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_other',
            'file_path' => 'items/old.jpg',
            'file_name' => 'old.jpg',
            'file_size' => 50,
            'mime_type' => 'image/jpeg',
            'is_thumbnail' => true,
            'is_processed' => true,
            'display_order' => 1,
        ]);

        $file = UploadedFile::fake()->image('new.jpg', 800, 600);
        $result = app(UploadMediaAction::class)->execute($item, $file, 'image', true);

        $this->assertTrue($result->success);
        // 既存サムネは外される
        $this->assertFalse((bool) $existing->fresh()->is_thumbnail);
        // Item の thumbnail_path が更新される
        $this->assertNotNull($item->fresh()->thumbnail_path);
    }

    public function test_uploadMedia_動画はProcessItemVideoJobをdispatchする(): void
    {
        Queue::fake();
        $this->fakePublicStorage();

        // VideoProcessingService をスタブして poster 生成を回避
        $this->app->instance(
            VideoProcessingService::class,
            new class extends VideoProcessingService {
                public function __construct() {}
                public function generatePoster(string $sourcePath): ?string
                {
                    return null;
                }
            }
        );

        $item = $this->makeItem();
        $file = UploadedFile::fake()->create('video.mp4', 1024, 'video/mp4');

        $result = app(UploadMediaAction::class)->execute($item, $file, 'video', true);

        $this->assertTrue($result->success);
        // 動画はサムネにしない
        $this->assertDatabaseHas('item_media', [
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'is_thumbnail' => false,
            'is_processed' => false,
        ]);
        Queue::assertPushed(ProcessItemVideoJob::class);
    }
}
