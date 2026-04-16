<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NLPService
{
    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key', '');
    }

    /**
     * 自然言語テキストから商品情報を自動抽出
     */
    public function extractItemInfo(string $text): array
    {
        if (empty($this->apiKey)) {
            return $this->fallbackExtraction($text);
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(15)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'あなたはメダカの出品情報を解析するAIです。テキストから商品情報を抽出してJSONで返してください。',
                        ],
                        [
                            'role' => 'user',
                            'content' => <<<EOT
以下のテキストからメダカの商品情報を抽出してJSON形式で返してください。

テキスト: {$text}

抽出項目（該当しない場合はnull）:
- species_name: 品種名
- quantity: 匹数（数値）
- size: サイズ（cm）
- sex: 性別（オス/メス/ミックス）
- age: 月齢
- grade: グレード
- category: カテゴリ（普通種/改良品種/高級品種）
- keywords: キーワード配列
EOT,
                        ],
                    ],
                    'response_format' => ['type' => 'json_object'],
                    'max_tokens' => 500,
                ]);

            if ($response->successful()) {
                return json_decode($response->json('choices.0.message.content'), true) ?? [];
            }
        } catch (\Exception $e) {
            Log::warning('NLP extraction failed', ['error' => $e->getMessage()]);
        }

        return $this->fallbackExtraction($text);
    }

    /**
     * テキストからカテゴリを自動分類
     */
    public function classifyCategory(string $speciesName, ?string $description = null): string
    {
        $text = $speciesName . ($description ? " {$description}" : '');

        // ルールベースの分類（API不要）
        $highGrade = ['幹之', '三色', '紅白', '鳳凰', 'ラメ', '体外光', '夜桜', '王華', '煌', 'サファイア', 'マリアージュ'];
        $premiumBreed = ['楊貴妃', 'みゆき', 'オロチ', '黒龍', 'ブラックダイヤ', 'ユリシス'];

        foreach ($highGrade as $keyword) {
            if (str_contains($text, $keyword)) {
                return 'premium';
            }
        }

        foreach ($premiumBreed as $keyword) {
            if (str_contains($text, $keyword)) {
                return 'improved';
            }
        }

        return 'standard';
    }

    /**
     * API不使用のフォールバック抽出
     */
    private function fallbackExtraction(string $text): array
    {
        $result = [
            'species_name' => null,
            'quantity' => null,
            'size' => null,
            'sex' => null,
            'category' => null,
            'keywords' => [],
        ];

        // 匹数抽出
        if (preg_match('/(\d+)\s*(?:匹|ペア|ぺあ)/', $text, $matches)) {
            $result['quantity'] = (int) $matches[1];
        }

        // サイズ抽出
        if (preg_match('/(\d+(?:\.\d+)?)\s*(?:cm|センチ)/', $text, $matches)) {
            $result['size'] = (float) $matches[1];
        }

        // 性別抽出
        if (preg_match('/(オス|メス|♂|♀|ミックス|MIX)/iu', $text, $matches)) {
            $sex = $matches[1];
            $result['sex'] = match ($sex) {
                'オス', '♂' => 'オス',
                'メス', '♀' => 'メス',
                default => 'ミックス',
            };
        }

        return $result;
    }

    /**
     * マッチングスコアを計算（購買履歴と出品パターンの分析）
     */
    public function calculateMatchScore(array $buyerPreferences, array $itemFeatures): float
    {
        $score = 0.0;
        $maxScore = 0.0;

        // 品種一致
        $maxScore += 0.4;
        if (isset($buyerPreferences['species']) && isset($itemFeatures['species_name'])) {
            if (in_array($itemFeatures['species_name'], $buyerPreferences['species'])) {
                $score += 0.4;
            }
        }

        // 価格帯一致
        $maxScore += 0.3;
        if (isset($buyerPreferences['price_range']) && isset($itemFeatures['start_price'])) {
            $range = $buyerPreferences['price_range'];
            if ($itemFeatures['start_price'] >= ($range['min'] ?? 0) && $itemFeatures['start_price'] <= ($range['max'] ?? PHP_INT_MAX)) {
                $score += 0.3;
            }
        }

        // カテゴリ一致
        $maxScore += 0.3;
        if (isset($buyerPreferences['categories']) && isset($itemFeatures['category'])) {
            if (in_array($itemFeatures['category'], $buyerPreferences['categories'])) {
                $score += 0.3;
            }
        }

        return $maxScore > 0 ? $score / $maxScore : 0;
    }
}
