<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NLPService
{
    public const CATEGORY_LABELS = [
        'premium' => '高級品種',
        'improved' => '改良品種',
        'standard' => '普通種',
    ];

    /** AI 一括分類の1リクエストあたりの件数 */
    private const CLASSIFY_CHUNK_SIZE = 80;

    /** AI 一括分類の処理時間上限（秒）。超えた分はキーワード判定にする（ALB 60秒対策） */
    private const CLASSIFY_TIME_BUDGET_SECONDS = 40;

    private const CLASSIFY_CACHE_PREFIX = 'ai:category:v1:';

    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = (string) config('services.openai.api_key', '');
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
                $result = json_decode($response->json('choices.0.message.content'), true) ?? [];
                return $this->withCategory($result);
            }
        } catch (\Exception $e) {
            Log::warning('NLP extraction failed', ['error' => $e->getMessage()]);
        }

        return $this->fallbackExtraction($text);
    }

    /**
     * 抽出結果のカテゴリを自動分類（classifyTexts）の結果に揃える。
     * 生体登録画面の入力支援と AI分析センターの分類で判定がずれないようにするため。
     */
    private function withCategory(array $result): array
    {
        $species = trim((string) ($result['species_name'] ?? ''));
        if ($species === '') {
            return $result;
        }

        $classified = $this->classifyTexts([$species])[$species];
        $result['category'] = $classified['category'];
        $result['category_label'] = $classified['label'];
        $result['category_source'] = $classified['source'];

        return $result;
    }

    /**
     * 品種名（＋説明文）のリストを一括でカテゴリ分類する。
     * OpenAI キーがあれば AI で判定し（結果は品種名単位で30日キャッシュ）、無い場合・失敗時・時間切れ分はキーワード判定。
     *
     * @param  string[]  $texts
     * @return array<string, array{category: string, label: string, source: string}> 入力テキスト => 判定結果
     */
    public function classifyTexts(array $texts): array
    {
        $texts = array_values(array_unique(array_filter(array_map('trim', $texts), fn ($t) => $t !== '')));
        $results = [];
        $pending = [];

        foreach ($texts as $text) {
            $cached = Cache::get(self::CLASSIFY_CACHE_PREFIX . md5($text));
            if ($cached) {
                $results[$text] = $this->categoryResult($cached, 'ai');
            } else {
                $pending[] = $text;
            }
        }

        if ($pending && !empty($this->apiKey)) {
            $startedAt = microtime(true);
            foreach (array_chunk($pending, self::CLASSIFY_CHUNK_SIZE) as $chunk) {
                if (microtime(true) - $startedAt > self::CLASSIFY_TIME_BUDGET_SECONDS) {
                    break;
                }
                foreach ($this->classifyChunkWithAi($chunk) as $text => $category) {
                    Cache::put(self::CLASSIFY_CACHE_PREFIX . md5($text), $category, now()->addDays(30));
                    $results[$text] = $this->categoryResult($category, 'ai');
                }
            }
        }

        foreach ($texts as $text) {
            $results[$text] ??= $this->categoryResult($this->classifyCategory($text), 'rule');
        }

        return $results;
    }

    private function categoryResult(string $category, string $source): array
    {
        return [
            'category' => $category,
            'label' => self::CATEGORY_LABELS[$category],
            'source' => $source,
        ];
    }

    /**
     * @param  string[]  $texts
     * @return array<string, string> 判定できたテキスト => premium|improved|standard
     */
    private function classifyChunkWithAi(array $texts): array
    {
        try {
            $list = json_encode(array_values($texts), JSON_UNESCAPED_UNICODE);
            $response = Http::withToken($this->apiKey)
                ->timeout(25)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'あなたは日本の改良メダカの専門家です。品種名を価格帯・希少性で3つのカテゴリに分類し、JSONで返してください。',
                        ],
                        [
                            'role' => 'user',
                            'content' => <<<EOT
次の品種名（説明文を含む場合あり）をそれぞれ分類してください。

カテゴリ:
- premium: 高級品種（希少・高価格帯。例: 三色・紅白・幹之・ラメ・体外光・夜桜・王華・煌・サファイア 系の上位品種）
- improved: 改良品種（普及している改良メダカ。例: 楊貴妃・みゆき・オロチ・黒龍・ブラックダイヤ・ユリシス）
- standard: 普通種（黒メダカ・ヒメダカ等の原種・一般的な品種、または判断できないもの）

品種名リスト: {$list}

出力形式: {"results": [{"name": "入力した品種名をそのまま", "category": "premium|improved|standard"}]}
EOT,
                        ],
                    ],
                    'response_format' => ['type' => 'json_object'],
                    'max_tokens' => 4000,
                ]);

            if (!$response->successful()) {
                Log::warning('AI category classification failed', ['status' => $response->status()]);
                return [];
            }

            $decoded = json_decode((string) $response->json('choices.0.message.content'), true);
            $classified = [];
            foreach ($decoded['results'] ?? [] as $row) {
                $name = trim((string) ($row['name'] ?? ''));
                $category = (string) ($row['category'] ?? '');
                if (in_array($name, $texts, true) && isset(self::CATEGORY_LABELS[$category])) {
                    $classified[$name] = $category;
                }
            }

            return $classified;
        } catch (\Exception $e) {
            Log::warning('AI category classification error', ['error' => $e->getMessage()]);
            return [];
        }
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

        // 性別抽出（「オス5・メス5」のように両方あればミックス）
        if (preg_match('/(オス|♂)/u', $text) && preg_match('/(メス|♀)/u', $text)) {
            $result['sex'] = 'ミックス';
        } elseif (preg_match('/(オス|メス|♂|♀|ミックス|MIX)/iu', $text, $matches)) {
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
