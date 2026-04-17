<?php

namespace App\Services\AI;

use App\Models\AIImageAnalysis;
use App\Models\Item;
use App\Models\ItemMedia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ImageAnalysisService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key', '');
        $this->model = config('services.openai.model', 'gpt-4o-mini');
    }

    /**
     * 商品画像をAI解析して品質・特徴を抽出
     */
    public function analyzeItem(Item $item): ?AIImageAnalysis
    {
        $media = $item->media()
            ->where('media_type', 'like', 'photo%')
            ->orderByDesc('is_thumbnail')
            ->orderBy('display_order')
            ->first();

        if (!$media) {
            Log::info('AI Image Analysis: No photo found for item', ['item_id' => $item->id]);
            return null;
        }

        try {
            $imageUrl = $this->getImageUrl($media);
            $response = $this->callVisionApi($imageUrl, $item->species_name);

            if (!$response) {
                return null;
            }

            return AIImageAnalysis::updateOrCreate(
                ['item_id' => $item->id],
                [
                    'item_media_id' => $media->id,
                    'body_shape_features' => $response['body_shape'] ?? null,
                    'color_features' => $response['color'] ?? null,
                    'pattern_features' => $response['pattern'] ?? null,
                    'quality_score' => $response['quality_score'] ?? null,
                    'predicted_breed' => $response['predicted_breed'] ?? null,
                    'breed_confidence' => $response['breed_confidence'] ?? null,
                    'raw_response' => $response,
                    'model_version' => $this->model,
                ],
            );
        } catch (\Exception $e) {
            Log::error('AI Image Analysis error', ['error' => $e->getMessage(), 'item_id' => $item->id]);
            return null;
        }
    }

    /**
     * OpenAI Vision API を呼び出し
     */
    private function callVisionApi(string $imageUrl, ?string $speciesName = null): ?array
    {
        if (empty($this->apiKey)) {
            Log::warning('AI Image Analysis: OpenAI API key not configured');
            return null;
        }

        $prompt = <<<EOT
あなたはメダカ（日本産淡水魚）の専門家AIです。
以下の画像を解析し、JSON形式で結果を返してください。

解析項目:
1. body_shape: 体型の特徴（全長推定, 体高, 体幅, 背骨の曲がり, ヒレの形状）
2. color: 色彩の特徴（主要な体色, 光沢タイプ, ラメの有無・密度, 色の均一性）
3. pattern: 模様の特徴（模様タイプ, 分布パターン, 左右対称性）
4. quality_score: 総合品質スコア（0-10の小数点1桁）
5. predicted_breed: 推定品種名
6. breed_confidence: 品種推定の信頼度（0-100%）
EOT;

        if ($speciesName) {
            $prompt .= "\n\n出品者による品種名: {$speciesName}";
        }

        $response = Http::withToken($this->apiKey)
            ->timeout(30)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            ['type' => 'text', 'text' => $prompt],
                            ['type' => 'image_url', 'image_url' => ['url' => $imageUrl]],
                        ],
                    ],
                ],
                'response_format' => ['type' => 'json_object'],
                'max_tokens' => 1000,
            ]);

        if (!$response->successful()) {
            Log::error('OpenAI Vision API failed', ['status' => $response->status()]);
            return null;
        }

        $content = $response->json('choices.0.message.content');
        return json_decode($content, true);
    }

    private function getImageUrl(ItemMedia $media): string
    {
        if (str_starts_with($media->file_path, 'http')) {
            return $media->file_path;
        }

        // S3の場合は一時URLを生成
        if (config('filesystems.default') === 's3') {
            return Storage::temporaryUrl($media->file_path, now()->addMinutes(15));
        }

        return Storage::url($media->file_path);
    }

    /**
     * バッチ解析（オークション全商品）
     */
    public function analyzeAuctionItems(int $auctionId): int
    {
        $items = Item::where('auction_id', $auctionId)
            ->whereDoesntHave('imageAnalysis')
            ->with('media')
            ->get();

        $count = 0;
        foreach ($items as $item) {
            if ($this->analyzeItem($item)) {
                $count++;
            }
            usleep(500000); // API レート制限対策: 0.5秒待機
        }

        return $count;
    }
}
