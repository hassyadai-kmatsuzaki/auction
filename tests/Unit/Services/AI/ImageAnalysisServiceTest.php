<?php

namespace Tests\Unit\Services\AI;

use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Services\AI\ImageAnalysisService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ImageAnalysisServiceTest extends TestCase
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
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id]);

        config(['services.openai.api_key' => 'test-key']);
        config(['services.openai.model' => 'gpt-4o-mini']);
        config(['filesystems.default' => 'public']);
    }

    private function makeItem(): Item
    {
        return Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
    }

    private function attachPhoto(Item $item): ItemMedia
    {
        return ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'mime_type' => 'image/jpeg',
            'file_name' => 'a.jpg',
            'file_size' => 100,
            'file_path' => 'https://example.com/a.jpg',
            'display_order' => 1,
            'is_thumbnail' => true,
        ]);
    }

    public function test_analyzeItem_returns_null_when_no_photo(): void
    {
        $item = $this->makeItem();
        $service = new ImageAnalysisService();

        $this->assertNull($service->analyzeItem($item));
    }

    public function test_analyzeItem_persists_record_on_successful_api_response(): void
    {
        $item = $this->makeItem();
        $this->attachPhoto($item);

        Http::fake([
            'api.openai.com/*' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'body_shape' => ['length' => '3cm'],
                            'color' => ['main' => '黒'],
                            'pattern' => ['type' => 'plain'],
                            'quality_score' => 8.5,
                            'predicted_breed' => '幹之メダカ',
                            'breed_confidence' => 90,
                        ]),
                    ],
                ]],
            ], 200),
        ]);

        $service = new ImageAnalysisService();
        $result = $service->analyzeItem($item);

        $this->assertNotNull($result);
        $this->assertDatabaseHas('ai_image_analyses', [
            'item_id' => $item->id,
            'predicted_breed' => '幹之メダカ',
        ]);
    }

    public function test_analyzeItem_returns_null_when_api_call_fails(): void
    {
        $item = $this->makeItem();
        $this->attachPhoto($item);

        Http::fake([
            'api.openai.com/*' => Http::response(['error' => 'fail'], 500),
        ]);

        $service = new ImageAnalysisService();
        $this->assertNull($service->analyzeItem($item));
    }

    public function test_analyzeItem_returns_null_when_api_key_missing(): void
    {
        config(['services.openai.api_key' => '']);
        $item = $this->makeItem();
        $this->attachPhoto($item);

        $service = new ImageAnalysisService();
        $this->assertNull($service->analyzeItem($item));
    }

    public function test_analyzeAuctionItems_counts_only_successful_analyses(): void
    {
        $item1 = $this->makeItem();
        $this->attachPhoto($item1);
        $item2 = $this->makeItem(); // 写真なし → スキップ

        Http::fake([
            'api.openai.com/*' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode(['quality_score' => 7.0]),
                    ],
                ]],
            ], 200),
        ]);

        $service = new ImageAnalysisService();
        $result = $service->analyzeAuctionItems($this->auction->id);

        $this->assertSame(['analyzed' => 1, 'remaining' => 0, 'failed' => 0], $result);
    }

    public function test_analyzeAuctionItems_returns_zero_when_no_items(): void
    {
        $service = new ImageAnalysisService();
        $result = $service->analyzeAuctionItems($this->auction->id);
        $this->assertSame(['analyzed' => 0, 'remaining' => 0, 'failed' => 0], $result);
    }

    public function test_sends_resized_image_inline_for_stored_media(): void
    {
        // 本番は画像が S3。URL ではなく、読み込んで長辺1200pxの JPEG に縮小し base64 で直接送ること
        \Illuminate\Support\Facades\Storage::fake('public');
        config(['filesystems.disks.s3.bucket' => null]);
        $img = imagecreatetruecolor(2400, 1600);
        ob_start();
        imagejpeg($img);
        \Illuminate\Support\Facades\Storage::disk('public')->put('items/1/a.jpg', ob_get_clean());

        $item = $this->makeItem();
        ItemMedia::create([
            'item_id' => $item->id, 'media_type' => 'photo_top', 'mime_type' => 'image/jpeg',
            'file_name' => 'a.jpg', 'file_size' => 100, 'file_path' => 'items/1/a.jpg', 'display_order' => 1, 'is_thumbnail' => true,
        ]);
        Http::fake(['api.openai.com/*' => Http::response(['choices' => [['message' => ['content' => json_encode(['quality_score' => 7.0])]]]], 200)]);

        $this->assertNotNull((new ImageAnalysisService())->analyzeItem($item));

        Http::assertSent(function ($request) {
            $url = $request->data()['messages'][0]['content'][1]['image_url']['url'] ?? '';
            if (!str_starts_with($url, 'data:image/jpeg;base64,')) {
                return false;
            }
            [$w] = getimagesizefromstring(base64_decode(substr($url, strlen('data:image/jpeg;base64,'))));
            return $w === 1200;
        });
    }

    public function test_returns_null_when_stored_image_is_missing(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        config(['filesystems.disks.s3.bucket' => null]);
        $item = $this->makeItem();
        ItemMedia::create([
            'item_id' => $item->id, 'media_type' => 'photo_top', 'mime_type' => 'image/jpeg',
            'file_name' => 'x.jpg', 'file_size' => 100, 'file_path' => 'items/1/missing.jpg', 'display_order' => 1, 'is_thumbnail' => true,
        ]);
        Http::fake();

        $this->assertNull((new ImageAnalysisService())->analyzeItem($item));
        Http::assertNothingSent();
    }

    public function test_analyzeAuctionItems_counts_failures(): void
    {
        $item = $this->makeItem();
        $this->attachPhoto($item);
        Http::fake(['api.openai.com/*' => Http::response(['error' => 'fail'], 500)]);

        $result = (new ImageAnalysisService())->analyzeAuctionItems($this->auction->id);

        $this->assertSame(['analyzed' => 0, 'remaining' => 0, 'failed' => 1], $result);
    }
}
