<?php

namespace Tests\Unit\Services;

use App\Services\AIContentService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AIContentServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['services.openai.api_key' => 'test-key']);
        config(['services.openai.model' => 'gpt-4o-mini']);
    }

    public function test_generateAnnouncementContent_returns_failure_when_api_key_missing(): void
    {
        config(['services.openai.api_key' => '']);

        $service = new AIContentService();
        $result = $service->generateAnnouncementContent('テスト');

        $this->assertFalse($result['success']);
        $this->assertArrayHasKey('message', $result);
    }

    public function test_generateAnnouncementContent_returns_content_on_success(): void
    {
        Http::fake([
            'api.openai.com/*' => Http::response([
                'choices' => [[
                    'message' => ['content' => 'テスト用のお知らせ本文です。'],
                ]],
            ], 200),
        ]);

        $service = new AIContentService();
        $result = $service->generateAnnouncementContent('メンテナンスのお知らせ');

        $this->assertTrue($result['success']);
        $this->assertSame('テスト用のお知らせ本文です。', $result['content']);
    }

    public function test_generateAnnouncementContent_returns_failure_on_api_error(): void
    {
        Http::fake([
            'api.openai.com/*' => Http::response(['error' => 'rate_limited'], 429),
        ]);

        $service = new AIContentService();
        $result = $service->generateAnnouncementContent('タイトル');

        $this->assertFalse($result['success']);
    }

    public function test_generateAnnouncementContent_handles_exception(): void
    {
        Http::fake(function () {
            throw new \RuntimeException('network down');
        });

        $service = new AIContentService();
        $result = $service->generateAnnouncementContent('タイトル');

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('network down', $result['message']);
    }

    public function test_generateAnnouncementContent_passes_target_roles_and_importance_in_prompt(): void
    {
        $captured = null;
        Http::fake(function ($request) use (&$captured) {
            $captured = $request->data();
            return Http::response([
                'choices' => [['message' => ['content' => 'ok']]],
            ], 200);
        });

        $service = new AIContentService();
        $service->generateAnnouncementContent('重要', [
            'target_roles' => ['admin'],
            'is_important' => true,
        ]);

        $userMessage = collect($captured['messages'])->firstWhere('role', 'user')['content'];
        $this->assertStringContainsString('管理者', $userMessage);
        $this->assertStringContainsString('重要なお知らせ', $userMessage);
    }

    public function test_generateAnnouncementContent_trims_whitespace_from_content(): void
    {
        Http::fake([
            'api.openai.com/*' => Http::response([
                'choices' => [[
                    'message' => ['content' => "   本文です。   \n"],
                ]],
            ], 200),
        ]);

        $service = new AIContentService();
        $result = $service->generateAnnouncementContent('タイトル');

        $this->assertSame('本文です。', $result['content']);
    }
}
