<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AIContentService
{
    protected string $apiKey;
    protected string $model;

    public function __construct()
    {
        $this->apiKey = (string) config('services.openai.api_key', '');
        $this->model = (string) config('services.openai.model', 'gpt-4o-mini');
    }

    /**
     * お知らせコンテンツを生成
     *
     * @param string $title お知らせタイトル
     * @param array $options オプション（対象ロール、重要度など）
     * @return array
     */
    public function generateAnnouncementContent(string $title, array $options = []): array
    {
        if (empty($this->apiKey)) {
            return [
                'success' => false,
                'message' => 'OpenAI APIキーが設定されていません。',
            ];
        }

        $targetRoles = $options['target_roles'] ?? ['participant', 'seller'];
        $isImportant = $options['is_important'] ?? false;

        $roleNames = [
            'admin' => '管理者',
            'seller' => '出品者',
            'participant' => '参加者（落札者）',
        ];

        $targetAudience = implode('、', array_map(fn($r) => $roleNames[$r] ?? $r, $targetRoles));

        $prompt = $this->buildPrompt($title, $targetAudience, $isImportant);

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'あなたはめだかライブオークションの運営スタッフです。お知らせの本文を作成してください。丁寧で分かりやすい日本語で、適切な敬語を使用してください。HTMLタグは使用せず、プレーンテキストで作成してください。',
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'max_tokens' => 1000,
                'temperature' => 0.7,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $content = $data['choices'][0]['message']['content'] ?? '';

                return [
                    'success' => true,
                    'content' => trim($content),
                ];
            }

            Log::error('OpenAI API Error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'AI生成に失敗しました。',
            ];

        } catch (\Exception $e) {
            Log::error('OpenAI API Exception', [
                'message' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'AI生成中にエラーが発生しました: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * プロンプトを構築
     */
    protected function buildPrompt(string $title, string $targetAudience, bool $isImportant): string
    {
        $importanceNote = $isImportant ? '【重要なお知らせ】として、緊急性を持たせた文章にしてください。' : '';

        return <<<PROMPT
以下のタイトルでお知らせの本文を作成してください。

タイトル: {$title}
対象: {$targetAudience}
{$importanceNote}

要件:
- 200〜400文字程度で作成
- 丁寧で分かりやすい文章
- 必要に応じて箇条書きを使用
- 最後に「ご不明な点がございましたら、お気軽にお問い合わせください。」などの締めの言葉を入れる
- めだかオークションに関連する内容として自然な文章にする
PROMPT;
    }
}
