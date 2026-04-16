<?php

namespace Tests\Unit;

use App\Services\AI\NLPService;
use Tests\TestCase;

class NLPServiceTest extends TestCase
{
    private NLPService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new NLPService();
    }

    public function test_extract_quantity_from_text(): void
    {
        $result = $this->service->extractItemInfo('楊貴妃メダカ 5匹セット');
        $this->assertEquals(5, $result['quantity']);
    }

    public function test_extract_size_from_text(): void
    {
        $result = $this->service->extractItemInfo('幹之メダカ 3.5cm');
        $this->assertEquals(3.5, $result['size']);
    }

    public function test_extract_sex_from_text(): void
    {
        $result = $this->service->extractItemInfo('オロチメダカ オス 2匹');
        $this->assertEquals('オス', $result['sex']);
    }

    public function test_classify_premium_breed(): void
    {
        $category = $this->service->classifyCategory('三色ラメ体外光');
        $this->assertEquals('premium', $category);
    }

    public function test_classify_improved_breed(): void
    {
        $category = $this->service->classifyCategory('楊貴妃');
        $this->assertEquals('improved', $category);
    }

    public function test_classify_standard_breed(): void
    {
        $category = $this->service->classifyCategory('ヒメダカ');
        $this->assertEquals('standard', $category);
    }

    public function test_calculate_match_score(): void
    {
        $preferences = [
            'species' => ['楊貴妃', '幹之'],
            'price_range' => ['min' => 500, 'max' => 3000],
            'categories' => ['improved'],
        ];

        $features = [
            'species_name' => '楊貴妃',
            'start_price' => 1000,
            'category' => 'improved',
        ];

        $score = $this->service->calculateMatchScore($preferences, $features);
        $this->assertEquals(1.0, $score);
    }
}
