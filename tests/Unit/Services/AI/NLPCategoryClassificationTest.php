<?php

namespace Tests\Unit\Services\AI;

use App\Services\AI\NLPService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NLPCategoryClassificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function fakeOpenAi(array $content): void
    {
        Http::fake([
            'api.openai.com/*' => Http::response([
                'choices' => [['message' => ['content' => json_encode($content, JSON_UNESCAPED_UNICODE)]]],
            ], 200),
        ]);
    }

    public function test_classifyTexts_uses_keyword_rules_without_api_key(): void
    {
        config(['services.openai.api_key' => '']);
        Http::fake();

        $result = (new NLPService())->classifyTexts(['紅白ラメ', '楊貴妃', '黒メダカ']);

        $this->assertSame(['category' => 'premium', 'label' => '高級品種', 'source' => 'rule'], $result['紅白ラメ']);
        $this->assertSame('improved', $result['楊貴妃']['category']);
        $this->assertSame('standard', $result['黒メダカ']['category']);
        Http::assertNothingSent();
    }

    public function test_classifyTexts_uses_ai_and_caches_result(): void
    {
        config(['services.openai.api_key' => 'test-key']);
        $this->fakeOpenAi(['results' => [
            ['name' => '紅薊', 'category' => 'premium'],
            ['name' => '黒メダカ', 'category' => 'standard'],
        ]]);

        $result = (new NLPService())->classifyTexts(['紅薊', '黒メダカ', '紅薊']);

        $this->assertSame(['category' => 'premium', 'label' => '高級品種', 'source' => 'ai'], $result['紅薊']);
        $this->assertSame('ai', $result['黒メダカ']['source']);
        Http::assertSentCount(1);

        // 2回目はキャッシュから返り、API を呼ばない
        $again = (new NLPService())->classifyTexts(['紅薊']);
        $this->assertSame('ai', $again['紅薊']['source']);
        Http::assertSentCount(1);
    }

    public function test_classifyTexts_falls_back_to_rules_for_invalid_or_missing_ai_results(): void
    {
        config(['services.openai.api_key' => 'test-key']);
        $this->fakeOpenAi(['results' => [
            ['name' => '幹之', 'category' => 'unknown'],   // 不正なカテゴリ
        ]]);                                             // 楊貴妃 は返ってこない

        $result = (new NLPService())->classifyTexts(['幹之', '楊貴妃']);

        $this->assertSame(['category' => 'premium', 'label' => '高級品種', 'source' => 'rule'], $result['幹之']);
        $this->assertSame(['category' => 'improved', 'label' => '改良品種', 'source' => 'rule'], $result['楊貴妃']);
    }

    public function test_classifyTexts_falls_back_to_rules_when_api_fails(): void
    {
        config(['services.openai.api_key' => 'test-key']);
        Http::fake(['api.openai.com/*' => Http::response(['error' => 'down'], 500)]);

        $result = (new NLPService())->classifyTexts(['三色ラメ']);

        $this->assertSame('rule', $result['三色ラメ']['source']);
        $this->assertSame('premium', $result['三色ラメ']['category']);
    }

    public function test_fallback_extraction_treats_both_sexes_as_mix(): void
    {
        config(['services.openai.api_key' => '']);

        $result = (new NLPService())->extractItemInfo('若魚10匹（オス5・メス5）体長2.5cm');

        $this->assertSame('ミックス', $result['sex']);
        $this->assertSame(10, $result['quantity']);
        $this->assertSame(2.5, $result['size']);
    }

    public function test_extractItemInfo_adds_category_label_from_classification(): void
    {
        config(['services.openai.api_key' => 'test-key']);
        Http::fakeSequence('api.openai.com/*')
            ->push(['choices' => [['message' => ['content' => json_encode([
                'species_name' => '紅白ラメ幹之', 'quantity' => 10, 'size' => 2.5, 'sex' => 'ミックス', 'category' => '普通種',
            ], JSON_UNESCAPED_UNICODE)]]]])
            ->push(['choices' => [['message' => ['content' => json_encode([
                'results' => [['name' => '紅白ラメ幹之', 'category' => 'premium']],
            ], JSON_UNESCAPED_UNICODE)]]]]);

        $result = (new NLPService())->extractItemInfo('紅白ラメ幹之の若魚10匹（オス5・メス5）。体長2.5cm前後');

        $this->assertSame('紅白ラメ幹之', $result['species_name']);
        $this->assertSame(10, $result['quantity']);
        $this->assertSame('premium', $result['category']);
        $this->assertSame('高級品種', $result['category_label']);
        $this->assertSame('ai', $result['category_source']);
    }
}
