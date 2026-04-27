<?php

namespace Tests\Feature\Admin;

use App\Models\AIFraudAlert;
use App\Models\AIImageAnalysis;
use App\Models\AIPricePrediction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Models\User;
use App\Services\AI\FraudDetectionService;
use App\Services\AI\ImageAnalysisService;
use App\Services\AI\NLPService;
use App\Services\AI\PricePredictionService;
use App\Services\AI\RecommendationService;
use Mockery;
use Tests\TestCase;

/**
 * 管理者向け AI 機能 (Admin\AIController) のテスト。
 *
 * 外部 API 依存サービス (画像解析 / 価格予測 / 詐欺検知 / レコメンド / NLP) は
 * Mock してコントローラの I/O とゲートのみ検証する。
 */
class AIControllerTest extends TestCase
{
    private User $admin;
    private Auction $auction;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeItem(): Item
    {
        return Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
    }

    public function test_dashboard_returns_aggregates(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/ai/dashboard');
        $response->assertOk()
            ->assertJsonStructure([
                'data' => ['image_analyses', 'price_predictions', 'fraud_alerts', 'recommendations_generated'],
            ]);
    }

    public function test_analyze_image_requires_photo_media(): void
    {
        $item = $this->makeItem(); // メディアなし

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/image-analysis/{$item->id}")
            ->assertStatus(422);
    }

    public function test_analyze_image_returns_503_when_api_key_missing(): void
    {
        config(['services.openai.api_key' => '']);
        $item = $this->makeItem();
        ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'mime_type' => 'image/jpeg',
            'file_name' => 'a.jpg',
            'file_size' => 100,
            'file_path' => 'a.jpg',
            'media_path' => 'a.jpg',
            'display_order' => 1,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/image-analysis/{$item->id}")
            ->assertStatus(503);
    }

    public function test_analyze_image_returns_502_when_service_returns_null(): void
    {
        config(['services.openai.api_key' => 'fake-key']);
        $item = $this->makeItem();
        ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'mime_type' => 'image/jpeg',
            'file_name' => 'a.jpg',
            'file_size' => 100,
            'file_path' => 'a.jpg',
            'media_path' => 'a.jpg',
            'display_order' => 1,
        ]);

        $this->mock(ImageAnalysisService::class, function ($m) {
            $m->shouldReceive('analyzeItem')->once()->andReturn(null);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/image-analysis/{$item->id}")
            ->assertStatus(502);
    }

    public function test_batch_analyze_images(): void
    {
        $this->mock(ImageAnalysisService::class, function ($m) {
            $m->shouldReceive('analyzeAuctionItems')->once()->andReturn(5);
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/image-analysis/batch/{$this->auction->id}");

        $response->assertOk()
            ->assertJsonPath('data.analyzed_count', 5);
    }

    public function test_image_analysis_results_returns_latest(): void
    {
        $item = $this->makeItem();
        AIImageAnalysis::create([
            'item_id' => $item->id,
            'health_score' => 85,
            'confidence' => 0.9,
            'model_version' => 'v1',
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/ai/image-analysis/{$item->id}/results");

        $response->assertOk();
        $this->assertNotNull($response->json('data'));
    }

    public function test_predict_price(): void
    {
        $item = $this->makeItem();
        $this->mock(PricePredictionService::class, function ($m) use ($item) {
            $m->shouldReceive('predictPrice')->once()->andReturn(
                AIPricePrediction::create([
                    'item_id' => $item->id,
                    'species_name' => $item->species_name,
                    'predicted_price' => 12345,
                    'price_low' => 10000,
                    'price_high' => 15000,
                    'confidence' => 70,
                    'factors' => [],
                    'model_version' => 'v1',
                ])
            );
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/price-prediction/{$item->id}");

        $response->assertOk()
            ->assertJsonPath('data.predicted_price', 12345);
    }

    public function test_market_trends(): void
    {
        $this->mock(PricePredictionService::class, function ($m) {
            $m->shouldReceive('getMarketTrends')->once()->andReturn(['trend1', 'trend2']);
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/ai/market-trends');
        $response->assertOk();
    }

    public function test_run_fraud_detection(): void
    {
        $this->mock(FraudDetectionService::class, function ($m) {
            $m->shouldReceive('analyzeAuction')->once()->andReturn([
                ['id' => 1, 'severity' => 'high'],
            ]);
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/fraud-detection/{$this->auction->id}");

        $response->assertOk()
            ->assertJsonPath('data.new_alerts', 1);
    }

    public function test_fraud_alerts_paginated(): void
    {
        $this->mock(FraudDetectionService::class, function ($m) {
            $m->shouldReceive('getAlerts')->once()->andReturn(
                new \Illuminate\Pagination\LengthAwarePaginator([], 0, 20)
            );
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/ai/fraud-alerts');
        $response->assertOk();
    }

    public function test_resolve_fraud_alert(): void
    {
        $alert = AIFraudAlert::create([
            'alert_type' => 'shill_bidding',
            'severity' => 'high',
            'status' => 'open',
            'description' => 'test',
            'metadata' => [],
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/ai/fraud-alerts/{$alert->id}", [
                'status' => 'resolved',
                'notes' => '対応済み',
            ]);

        $response->assertOk();
        $this->assertSame('resolved', $alert->fresh()->status);
        $this->assertSame($this->admin->id, (int) $alert->fresh()->resolved_by);
    }

    public function test_resolve_fraud_alert_validates_status(): void
    {
        $alert = AIFraudAlert::create([
            'alert_type' => 'bid_pattern',
            'severity' => 'low',
            'status' => 'open',
            'description' => 'tx',
            'metadata' => [],
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/ai/fraud-alerts/{$alert->id}", [
                'status' => 'totally_invalid',
            ])
            ->assertStatus(422);
    }

    public function test_generate_recommendations(): void
    {
        $user = $this->createParticipant();
        $this->mock(RecommendationService::class, function ($m) {
            $m->shouldReceive('generateRecommendations')->once()->andReturn(['rec1', 'rec2']);
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/ai/recommendations/{$user->id}");

        $response->assertOk()
            ->assertJsonPath('data.count', 2);
    }

    public function test_extract_item_info(): void
    {
        $this->mock(NLPService::class, function ($m) {
            $m->shouldReceive('extractItemInfo')->once()->andReturn([
                'species' => 'メダカ',
                'quantity' => 10,
            ]);
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai/nlp/extract', ['text' => 'メダカ 10匹']);

        $response->assertOk()
            ->assertJsonPath('data.species', 'メダカ');
    }

    public function test_classify_category(): void
    {
        $this->mock(NLPService::class, function ($m) {
            $m->shouldReceive('classifyCategory')->once()->andReturn('premium');
        });

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai/nlp/classify', ['species_name' => '幹之メダカ']);

        $response->assertOk()
            ->assertJsonPath('data.category', 'premium');
    }

    public function test_extract_validates_text_required(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/ai/nlp/extract', [])
            ->assertStatus(422);
    }

    public function test_non_admin_cannot_access_ai(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/admin/ai/dashboard')
            ->assertStatus(403);
    }
}
