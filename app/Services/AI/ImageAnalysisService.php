<?php

namespace App\Services\AI;

use App\Models\AIImageAnalysis;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Services\MediaOptimizer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ImageAnalysisService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = (string) config('services.openai.api_key', '');
        $this->model = (string) config('services.openai.model', 'gpt-4o-mini');
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
            $imageInput = $this->getImageInput($media);
            if ($imageInput === null) {
                return null;
            }
            $response = $this->callVisionApi($imageInput, $item->species_name);

            if (!$response) {
                return null;
            }

            // 品質スコア（F-052）: AI の観点別採点を決まった重みで合成する。内訳は raw_response に残す
            $quality = app(QualityScoreCalculator::class)->calculate($response);
            $response['quality_breakdown'] = $quality['breakdown'];

            return AIImageAnalysis::updateOrCreate(
                ['item_id' => $item->id],
                [
                    'item_media_id' => $media->id,
                    'body_shape_features' => $response['body_shape'] ?? null,
                    'color_features' => $response['color'] ?? null,
                    'pattern_features' => $response['pattern'] ?? null,
                    'quality_score' => $quality['score'],
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
7. 
EOT;
        $prompt .= QualityScoreCalculator::RUBRIC;

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
            Log::error('OpenAI Vision API failed', [
                'status' => $response->status(),
                'error' => mb_substr((string) $response->json('error.message'), 0, 300),
            ]);
            return null;
        }

        $content = $response->json('choices.0.message.content');
        return json_decode($content, true);
    }

    /**
     * OpenAI に渡す画像。
     * URL で渡すと S3 の公開設定や元画像のサイズ・形式に左右されて失敗する（400）ため、
     * 画面表示と同じ仕組み（MediaOptimizer: S3 から読み込み・縮小・キャッシュ）で長辺1200pxの JPEG にして直接送る。
     * 外部サイトの画像URLはそのまま渡す。
     */
    private function getImageInput(ItemMedia $media): ?string
    {
        $optimizer = app(MediaOptimizer::class);
        $path = (string) $media->file_path;

        $storagePath = str_starts_with($path, 'http') ? $optimizer->extractStoragePath($path) : $path;
        if ($storagePath === null) {
            return $path;
        }

        $variant = $optimizer->variant($storagePath, $optimizer->resolveParams('large', null, null, 'jpg'), $media->mime_type);
        if ($variant === null) {
            Log::warning('AI Image Analysis: image could not be read', ['media_id' => $media->id, 'path' => $storagePath]);
            return null;
        }

        return 'data:' . $variant['mime'] . ';base64,' . base64_encode($variant['content']);
    }

    /**
     * バッチ解析の1リクエストあたりの処理時間上限（秒）。
     * ALB の idle timeout（60秒）で 504 にならないよう、超えたら打ち切って残りは再実行で続きから処理する。
     */
    private const BATCH_TIME_BUDGET_SECONDS = 45;

    /**
     * バッチ解析（オークション全商品）
     *
     * @return array{analyzed: int, remaining: int, failed: int}
     */
    public function analyzeAuctionItems(int $auctionId): array
    {
        $items = Item::where('auction_id', $auctionId)
            ->whereDoesntHave('imageAnalysis')
            ->whereHas('media', fn ($q) => $q->where('media_type', 'like', 'photo%'))
            ->with('media')
            ->get();

        $startedAt = microtime(true);
        $count = 0;
        $attempted = 0;
        foreach ($items as $item) {
            if (microtime(true) - $startedAt > self::BATCH_TIME_BUDGET_SECONDS) {
                break;
            }
            $attempted++;
            if ($this->analyzeItem($item)) {
                $count++;
            }
            usleep(500000); // API レート制限対策: 0.5秒待機
        }

        return ['analyzed' => $count, 'remaining' => $items->count() - $attempted, 'failed' => $attempted - $count];
    }
}
