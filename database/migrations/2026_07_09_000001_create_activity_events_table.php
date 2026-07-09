<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * ユーザー行動計測イベントログ。
     *
     * 分析ダッシュボード（オークション別 / 全体）の基礎データ。閲覧・お気に入り・指値・
     * 会場入場・ログインを1本のイベント表に集約する。入札は既存 bid_events を流用するため
     * ここには持たない。
     *
     * 集計を軽くするため auction_id / item_id は書き込み時に非正規化で確定させる
     * （集計のたびに item→auction を JOIN しない）。
     *
     * 重複排除は dedup_key（単一 unique）で行う:
     *   - daily_access … "da:{user}:{Ymd}"        （1ユーザー1日1行）
     *   - item_view    … "iv:{user}:{item}:{Ymd}" （1ユーザー1日×item 1行・開始前のみ）
     *   - venue_enter  … "ve:{user}:{auction}"    （1ユーザー1オークション1行）
     *   - それ以外（favorite/bid_limit/login）… dedup_key=NULL（MySQL は NULL 重複を許すので無制限）
     */
    public function up(): void
    {
        Schema::create('activity_events', function (Blueprint $table) {
            $table->id();
            // ログインユーザーのみ計測（未ログインは対象外）。ユーザー削除時は行動履歴も消す。
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // 集計軸。削除されても履歴は残す（FK は null 化）。
            $table->foreignId('auction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 40)->comment('daily_access/item_view/venue_enter/favorite_add/favorite_remove/bid_limit_set/bid_limit_remove/login');
            $table->json('meta')->nullable()->comment('limit_price / auto フラグなどの付随情報');
            $table->date('event_date')->nullable()->comment('閲覧系の日次重複排除・「前日」集計用');
            $table->string('dedup_key', 191)->nullable()->comment('非nullなら1行に制限。NULLは重複可');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['auction_id', 'event_type', 'created_at']); // ダッシュボード集計の主軸
            $table->index(['item_id', 'event_type']);                  // 生体別集計
            $table->index(['user_id', 'created_at']);                  // 「誰が」ドリルダウン
            $table->index(['event_type', 'created_at']);               // 全体推移
            $table->unique('dedup_key');                               // 重複排除（NULLは対象外）
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_events');
    }
};
