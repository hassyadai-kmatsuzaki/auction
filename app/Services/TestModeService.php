<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Auth;

/**
 * テストモード機能のゲート判定とクエリフィルタを提供する。
 *
 * テストモードの世界観（先行公開モード）:
 * - system_settings.test_mode_enabled が true の間、is_test=true な閲覧者だけがオークション/生体/落札を見られる
 * - 出品者側の is_test は問わない（既存の出品者は通常運用、is_test を立てる必要はない）
 * - 非 is_test の閲覧者には空一覧を返す（403 ではなくデータレベルで存在しない扱い）
 * - 管理者（admin ロール）はテストモードの影響を受けない（運営に必要）
 *
 * 用途:
 * - 先行登録ユーザーへの限定公開
 * - 本番環境でのリハーサル運用
 *
 * 利用例:
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
     * テストモード判定で「閲覧を許可されるユーザー」かを返す。
     *
     * - テストモード OFF      → 常に true（誰でも全部見える）
     * - admin ロール          → 常に true（運営に必要）
     * - is_test=true なユーザー → true（先行公開対象）
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
     * 生体（items）クエリにテストモードのゲートを適用する。
     *
     * - テストモード OFF → 何もしない
     * - 閲覧者が許可ユーザーではない → whereRaw('1=0') で 0 件確定
     * - 許可ユーザー → そのまま通す（出品者の is_test は問わない）
     */
    public function applyToItemQuery(Builder|Relation $query, ?User $viewer = null): Builder|Relation
    {
        $viewer ??= Auth::user();

        if ($this->isEnabled() && !$this->currentUserCanSeeTestUniverse($viewer)) {
            return $query->whereRaw('1=0');
        }

        // テスト用オークション配下の生体は is_test=true 閲覧者にだけ見せる
        return $this->applyAuctionVisibilityToItemQuery($query, $viewer);
    }

    /**
     * オークション（auctions）クエリにゲートを適用する。
     *
     * - テストモード ON で許可ユーザーでない閲覧者 → 0 件（既存ゲート）
     * - 「テスト用オークション（auctions.is_test=true）」は閲覧者 is_test=true のときだけ見える
     *   テストモードの ON/OFF に関係なく、本番買受者からは常に隠す
     * - admin はすべて見える（運営に必要）
     */
    public function applyToAuctionQuery(Builder $query, ?User $viewer = null): Builder
    {
        $viewer ??= Auth::user();

        // テストモードゲート
        if ($this->isEnabled() && !$this->currentUserCanSeeTestUniverse($viewer)) {
            return $query->whereRaw('1=0');
        }

        // 管理者は全件
        if ($viewer && method_exists($viewer, 'hasRole') && $viewer->hasRole('admin')) {
            return $query;
        }

        // is_test オークションは is_test=true 閲覧者にだけ見せる
        $viewerIsTest = (bool) ($viewer?->is_test ?? false);
        if (!$viewerIsTest) {
            $query->where(function ($q) {
                $q->where('is_test', false)->orWhereNull('is_test');
            });
        }
        return $query;
    }

    /**
     * 生体（items）と紐づくオークションの is_test 可視性も透過させる。
     * Item は seller を介してではなく、auction を介してテスト/本番を判定する。
     */
    public function applyAuctionVisibilityToItemQuery(Builder|Relation $query, ?User $viewer = null): Builder|Relation
    {
        $viewer ??= Auth::user();
        if ($viewer && method_exists($viewer, 'hasRole') && $viewer->hasRole('admin')) {
            return $query;
        }
        $viewerIsTest = (bool) ($viewer?->is_test ?? false);
        if (!$viewerIsTest) {
            $query->whereHas('auction', function ($q) {
                $q->where(function ($qq) {
                    $qq->where('is_test', false)->orWhereNull('is_test');
                });
            });
        }
        return $query;
    }

    /**
     * 落札（won_items）クエリにゲートを適用する。
     * 自分の落札なので、閲覧者本人が許可ユーザーかどうかだけで判定。
     */
    public function applyToWonItemQuery(Builder $query, ?User $viewer = null): Builder
    {
        $viewer ??= Auth::user();

        if ($this->isEnabled() && !$this->currentUserCanSeeTestUniverse($viewer)) {
            return $query->whereRaw('1=0');
        }

        // 自分の落札は item.auction.is_test を経由して非テスト買受者からテスト落札を隠す
        if ($viewer && method_exists($viewer, 'hasRole') && $viewer->hasRole('admin')) {
            return $query;
        }
        $viewerIsTest = (bool) ($viewer?->is_test ?? false);
        if (!$viewerIsTest) {
            $query->whereHas('item.auction', function ($q) {
                $q->where(function ($qq) {
                    $qq->where('is_test', false)->orWhereNull('is_test');
                });
            });
        }
        return $query;
    }

    /**
     * 通知（メール/LINE/お知らせ）の宛先 User クエリにテストモードゲートを適用する。
     *
     * テストモード ON の間は **is_test=true ユーザーへのみ通知**。
     * テストモード OFF なら何もしない（全員に通知）。
     *
     * Notification 系（メール/LINE 通知/オークション開始通知/落札通知 等）の宛先取得 query で呼び出す。
     */
    public function applyToUserNotificationQuery(Builder $query): Builder
    {
        if (!$this->isEnabled()) return $query;
        return $query->where('is_test', true);
    }

    /**
     * 1 ユーザーへ通知を送ってよいかの個別判定。
     * 通知 Service が個別 User に対して条件分岐するときに使う。
     */
    public function shouldNotifyUser(?User $user): bool
    {
        if (!$user) return false;
        if (!$this->isEnabled()) return true;
        return (bool) $user->is_test;
    }

    /**
     * 出品者側のクエリゲート。
     *
     * 案 Y（先行公開モード）では出品者にテストモードの影響を与えない。
     * ＝ 全出品者は通常通り出品・編集・売上確認ができる。
     * 互換性のためメソッドは残してあるが、内部では何もしない（呼び出し側を一斉削除しないで済むよう）。
     */
    public function applyToOwnSellerScope(Builder $query, ?User $seller = null): Builder
    {
        return $query;
    }
}
