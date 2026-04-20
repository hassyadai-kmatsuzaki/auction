<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TutorialController extends Controller
{
    /**
     * チュートリアルステップ一覧
     */
    public function index(Request $request): JsonResponse
    {
        $role = $request->query('role', 'participant');

        $tutorials = match ($role) {
            'participant' => $this->getParticipantTutorial(),
            'seller' => $this->getSellerTutorial(),
            'admin' => $this->getAdminTutorial(),
            default => [],
        };

        // ユーザーの完了済みステップを取得
        $user = $request->user();
        $completedSteps = $user->notification_settings['completed_tutorials'] ?? [];

        foreach ($tutorials as &$step) {
            $step['completed'] = in_array($step['id'], $completedSteps);
        }

        return response()->json(['success' => true, 'data' => $tutorials]);
    }

    /**
     * チュートリアルステップを完了としてマーク
     */
    public function complete(Request $request): JsonResponse
    {
        $request->validate(['step_id' => 'required|string']);

        $user = $request->user();
        $settings = $user->notification_settings ?? [];
        $completed = $settings['completed_tutorials'] ?? [];

        if (!in_array($request->step_id, $completed)) {
            $completed[] = $request->step_id;
        }

        $settings['completed_tutorials'] = $completed;
        $user->update(['notification_settings' => $settings]);

        return response()->json(['success' => true]);
    }

    private function getParticipantTutorial(): array
    {
        return [
            ['id' => 'p_welcome', 'title' => '日本メダカオンライン市場へようこそ', 'description' => 'オークションの基本的な流れを確認しましょう', 'target' => '/participant/home'],
            ['id' => 'p_auction_list', 'title' => 'オークション一覧', 'description' => '開催予定・開催中のオークションを確認できます', 'target' => '/participant/auctions'],
            ['id' => 'p_favorites', 'title' => 'お気に入り機能', 'description' => '気になる商品をお気に入りに登録すると通知が届きます', 'target' => '/participant/favorites'],
            ['id' => 'p_live', 'title' => 'ライブ入札の方法', 'description' => '入札ボタンの使い方、指値（上限価格）の設定方法を学びましょう', 'target' => null],
            ['id' => 'p_won_items', 'title' => '落札後の流れ', 'description' => '入金・配送の確認方法を説明します', 'target' => '/participant/won-items'],
            ['id' => 'p_settings', 'title' => '通知設定', 'description' => 'メール・LINE通知の設定を確認しましょう', 'target' => '/participant/settings'],
        ];
    }

    private function getSellerTutorial(): array
    {
        return [
            ['id' => 's_welcome', 'title' => '出品者ガイド', 'description' => '出品の流れと操作方法を確認しましょう', 'target' => '/seller/dashboard'],
            ['id' => 's_submit', 'title' => '商品の出品方法', 'description' => '写真・動画のアップロード、商品情報の入力方法', 'target' => '/seller/submit'],
            ['id' => 's_profile', 'title' => 'プロフィール設定', 'description' => '口座情報や表示名の設定', 'target' => '/seller/profile'],
            ['id' => 's_shipping', 'title' => '発送管理', 'description' => '落札後の発送手続きと追跡番号の入力', 'target' => '/seller/shipping'],
            ['id' => 's_settlement', 'title' => '売上・精算', 'description' => '売上の確認と精算の流れ', 'target' => '/seller/sales'],
        ];
    }

    private function getAdminTutorial(): array
    {
        return [
            ['id' => 'a_dashboard', 'title' => '管理画面の概要', 'description' => 'ダッシュボードの見方', 'target' => '/admin/dashboard'],
            ['id' => 'a_auction', 'title' => 'オークション作成', 'description' => 'オークションの作成から開催までの流れ', 'target' => '/admin/auctions'],
            ['id' => 'a_live', 'title' => 'ライブ管理', 'description' => 'オークション中の操作方法', 'target' => '/admin/live'],
        ];
    }
}
