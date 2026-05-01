<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

/**
 * テストモード機能のゲート判定とクエリフィルタを提供する。
 *
 * テストモードの世界観:
 * - system_settings.test_mode_enabled が true の間、is_test=true 同士の閉じた世界だけを露出する
 * - 「is_test=true ユーザーから見て、is_test=true 出品者の生体だけが見える」
 * - 非 is_test ユーザーには空一覧を返す（403 ではなくデータレベルで存在しない扱い）
 * - 管理者（admin ロール）はテストモードの影響を受けない（運営に必要）
 *
 * 用途:
 * - 先行登録ユーザーへの限定公開
 * - 本番環境でのリハーサル運用
 *
 * 利用例:
 *   // 一覧取得時:
 *   $items = Item::query();
 *   app(TestModeService::class)->applyToItemQuery($items);
 *   // ↑ テストモード ON かつ閲覧者が is_test=false なら 0 件返るクエリに変わる
 */
class TestModeService
{
    /**
     * テストモードが有効か。SystemSetting のキャッシュ（1時間）に乗るので毎回 DB は叩かない。
     */
    public function isEnabled(): bool
    {
        return (bool) SystemSetting::get('test_mode_enabled', false);
    }

    /**
     * トグル切り替え。SystemSetting に書き込み + キャッシュクリア。
     */
    public function setEnabled(bool $enabled): void
    {
        SystemSetting::set('test_mode_enabled', $enabled ? '1' : '0');
        SystemSetting::clearCache();
    }

    /**
     * テストモード判定で「閉じた世界の住人」かを返す。
     *
     * - テストモード OFF      → 常に true（誰でも全部見える）
     * - admin ロール          → 常に true（運営に必要）
     * - is_test=true なユーザー → true（テストユニバースの住人）
     * - それ以外               → false（空一覧で扱われる）
     */
    public function currentUserCanSeeTestUniverse(?User $user = null): bool
    {
        if (!$this->isEnabled()) return true;

        $user ??= Auth::user();
        if (!$user) return false;

        // 管理者は常に素通し（管理画面経由で全件見る必要がある）
        if (method_exists($user, 'hasRole') && $user->hasRole('admin')) return true;

        return (bool) $user->is_test;
    }

    /**
     * 生体（items）クエリにテストモードのフィルタを適用する。
     *
     * - テストモード OFF → 何もしない
     * - 閲覧者が閉じた世界の住人ではない → whereRaw('1=0') で 0 件確定
     * - 住人 → 「出品者が is_test=true の生体」だけに絞る
     */
    public function applyToItemQuery(Builder $query, ?User $viewer = null): Builder
    {
        if (!$this->isEnabled()) return $query;

        $viewer ??= Auth::user();
        if (!$this->currentUserCanSeeTestUniverse($viewer)) {
            return $query->whereRaw('1=0');
        }

        // admin は閉じた世界フィルタをかけない（全件見る）
        if ($viewer && method_exists($viewer, 'hasRole') && $viewer->hasRole('admin')) {
            return $query;
        }

        // Item -> SellerProfile -> User.is_test の経路で絞り込み
        return $query->whereHas('sellerProfile.user', function ($q) {
            $q->where('is_test', true);
        });
    }

    /**
     * オークション（auctions）クエリにフィルタを適用する。
     *
     * 「閲覧者が住人なら、is_test 出品者の生体を 1 件以上含むオークションだけ」
     * 「住人でないなら 0 件」
     */
    public function applyToAuctionQuery(Builder $query, ?User $viewer = null): Builder
    {
        if (!$this->isEnabled()) return $query;

        $viewer ??= Auth::user();
        if (!$this->currentUserCanSeeTestUniverse($viewer)) {
            return $query->whereRaw('1=0');
        }

        if ($viewer && method_exists($viewer, 'hasRole') && $viewer->hasRole('admin')) {
            return $query;
        }

        return $query->whereHas('items.sellerProfile.user', function ($q) {
            $q->where('is_test', true);
        });
    }

    /**
     * 落札（won_items）クエリにフィルタを適用する。
     *
     * 落札者本人視点では「自分が住人かつ落札商品の出品者も住人」のものだけ表示。
     */
    public function applyToWonItemQuery(Builder $query, ?User $viewer = null): Builder
    {
        if (!$this->isEnabled()) return $query;

        $viewer ??= Auth::user();
        if (!$this->currentUserCanSeeTestUniverse($viewer)) {
            return $query->whereRaw('1=0');
        }

        if ($viewer && method_exists($viewer, 'hasRole') && $viewer->hasRole('admin')) {
            return $query;
        }

        return $query->whereHas('item.sellerProfile.user', function ($q) {
            $q->where('is_test', true);
        });
    }

    /**
     * 出品者側のクエリ（自分の出品物・売上等）に対するゲート。
     *
     * 「閲覧している出品者本人が住人ではない」ならテストモード中は 0 件にする
     * （非 is_test 出品者は test mode 中は出品履歴も見えない）。
     */
    public function applyToOwnSellerScope(Builder $query, ?User $seller = null): Builder
    {
        if (!$this->isEnabled()) return $query;

        $seller ??= Auth::user();
        if (!$this->currentUserCanSeeTestUniverse($seller)) {
            return $query->whereRaw('1=0');
        }
        return $query;
    }
}
