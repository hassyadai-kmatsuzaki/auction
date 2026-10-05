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

    public function test_quality_score_is_weighted_from_ai_axis_scores(): void
    {
        $item = $this->makeItem();
        $this->attachPhoto($item);
        $sent = null;
        Http::fake(function ($request) use (&$sent) {
            $sent = $request->data();
            return Http::response(['choices' => [['message' => ['content' => json_encode([
                'body_shape' => ['length' => '3cm'],
                'color' => ['main' => '朱赤'],
                'pattern' => ['type' => 'none'],
                'quality_score' => 9.9,
                'quality_scores' => ['body_shape' => 8, 'color' => 6, 'pattern' => 4],
            ])]]]], 200);
        });

        $result = (new ImageAnalysisService())->analyzeItem($item);

        // 8*0.40 + 6*0.35 + 4*0.25 = 6.3（AI の総合点 9.9 ではなく決まった式の値）
        $this->assertSame('6.30', (string) $result->quality_score);
        $this->assertSame('weighted_v1', $result->raw_response['quality_breakdown']['method']);
        $this->assertSame(9.9, $result->raw_response['quality_breakdown']['ai_overall']);
        // 画面の特徴カードに出る項目は変えない
        $this->assertSame(['length' => '3cm'], $result->body_shape_features);
        // AI に採点基準を渡している
        $this->assertStringContainsString('quality_scores', $sent['messages'][0]['content'][0]['text']);
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
