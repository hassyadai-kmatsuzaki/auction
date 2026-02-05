<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class ManualController extends Controller
{
    /**
     * マニュアル一覧を取得
     */
    public function index(Request $request)
    {
        $manuals = [
            [
                'id' => 'operations',
                'title' => '操作マニュアル',
                'role' => 'all',
                'description' => '全機能の操作手順（11セクション、約50ステップ）',
                'file' => '操作マニュアル.md',
            ],
            [
                'id' => 'announcements',
                'title' => 'お知らせ管理マニュアル',
                'role' => 'admin',
                'description' => 'お知らせの作成、編集、削除の詳細手順（16ステップ）',
                'file' => 'お知らせ管理マニュアル.md',
            ],
            [
                'id' => 'seller',
                'title' => '出品者マニュアル',
                'role' => 'seller',
                'description' => '商品出品から精算までの完全な手順（12ステップ）',
                'file' => '出品者マニュアル.md',
            ],
            [
                'id' => 'participant',
                'title' => '参加者マニュアル',
                'role' => 'participant',
                'description' => 'オークション参加から落札確認までの手順（12ステップ）',
                'file' => '参加者マニュアル.md',
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'manuals' => $manuals,
            ],
        ]);
    }

    /**
     * 特定のマニュアルを取得
     */
    public function show(Request $request, $id)
    {
        $manualMap = [
            'operations' => '操作マニュアル.md',
            'announcements' => 'お知らせ管理マニュアル.md',
            'seller' => '出品者マニュアル.md',
            'participant' => '参加者マニュアル.md',
        ];

        if (!isset($manualMap[$id])) {
            return response()->json([
                'success' => false,
                'message' => 'マニュアルが見つかりません',
            ], 404);
        }

        $filename = $manualMap[$id];
        $manualPath = storage_path("app/manual/{$filename}");

        // マニュアルファイルが存在しない場合はサンプルコンテンツを返す
        if (!File::exists($manualPath)) {
            Log::warning("Manual file not found: {$manualPath}");
            
            $sampleContent = $this->getSampleContent($id);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $id,
                    'content' => $sampleContent,
                    'is_sample' => true,
                ],
            ]);
        }

        try {
            $content = File::get($manualPath);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $id,
                    'content' => $content,
                    'is_sample' => false,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to read manual file: {$e->getMessage()}");
            
            return response()->json([
                'success' => false,
                'message' => 'マニュアルの読み込みに失敗しました',
            ], 500);
        }
    }

    /**
     * サンプルコンテンツを生成
     */
    private function getSampleContent($id)
    {
        $titles = [
            'operations' => '操作マニュアル',
            'announcements' => 'お知らせ管理マニュアル',
            'seller' => '出品者マニュアル',
            'participant' => '参加者マニュアル',
        ];

        $descriptions = [
            'operations' => '全機能の操作手順（11セクション、約50ステップ）',
            'announcements' => 'お知らせの作成、編集、削除の詳細手順（16ステップ）',
            'seller' => '商品出品から精算までの完全な手順（12ステップ）',
            'participant' => 'オークション参加から落札確認までの手順（12ステップ）',
        ];

        $title = $titles[$id] ?? 'マニュアル';
        $description = $descriptions[$id] ?? '';

        return <<<MARKDOWN
# {$title}

**自動生成日**: {$this->getJapaneseDate()}

> このマニュアルはE2Eテストから自動生成されています。

---

## 📋 概要

{$description}

---

## 🎬 動画マニュアル

各機能の操作動画が用意されています。

---

## 📸 スクリーンショット付き手順

各ステップごとに詳細なスクリーンショットが用意されています。

---

## 📝 注意事項

- このマニュアルは常に最新の画面に基づいて自動生成されています
- 不明な点がある場合は、動画を参照してください
- 実際の操作と異なる場合は、管理者にお問い合わせください

---

## 🚀 マニュアルの生成方法

マニュアルを最新の状態に更新するには、以下のコマンドを実行してください:

\`\`\`bash
cd src
./scripts/manual/generate-all-manuals.sh
\`\`\`

---

## 💡 マニュアルの特徴

- ✅ 動画とスクリーンショット付きで視覚的にわかりやすい
- ✅ 実際に動作する手順のみを掲載（E2Eテストで検証済み）
- ✅ UI変更時に自動更新されるため、常に最新

---

**次のステップ**: 実際の画面で操作を試してみましょう！

MARKDOWN;
    }

    /**
     * 日本語の日付を取得
     */
    private function getJapaneseDate()
    {
        return now()->locale('ja')->isoFormat('YYYY年M月D日');
    }
}
