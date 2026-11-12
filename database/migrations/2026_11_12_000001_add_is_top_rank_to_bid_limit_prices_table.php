<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 事前指値の「上位2件だけ計算対象」(2026-11-12)
 *
 * is_top_rank = 1: 商品開始時の自動参加・価格調整・敗者処理で読む行（金額降順・先着順の上位2件）
 * is_top_rank = 0: 表示専用（本書で言う「ダミー」）。開始後に FinishDummyLimitsJob が終了扱いにする
 *
 * 既定値は 1（計算対象）。並べ直しが走らなかった行は現行どおり計算対象になり、
 * 「指値があるのに流れる」方向には倒れない（フェイルオープン）。
 * 既存の idx_active_limits (item_id, is_triggered, limit_price) は is_top_rank を含めて作り直す。
 */
return new class extends Migration
{
    private const INDEX = 'idx_active_limits';

    public function up(): void
    {
        if (!Schema::hasColumn('bid_limit_prices', 'is_top_rank')) {
            Schema::table('bid_limit_prices', function (Blueprint $table) {
                $table->boolean('is_top_rank')->default(true)->after('is_triggered')
                    ->comment('1=開始時の計算対象（上位2件） 0=表示専用のダミー');
            });
        }

        if (Schema::hasIndex('bid_limit_prices', self::INDEX)) {
            Schema::table('bid_limit_prices', function (Blueprint $table) {
                $table->dropIndex(self::INDEX);
            });
        }
        Schema::table('bid_limit_prices', function (Blueprint $table) {
            $table->index(['item_id', 'is_triggered', 'is_top_rank', 'limit_price'], self::INDEX);
        });

        if (Schema::hasTable('bid_limit_prices_archive') && !Schema::hasColumn('bid_limit_prices_archive', 'is_top_rank')) {
            Schema::table('bid_limit_prices_archive', function (Blueprint $table) {
                $table->boolean('is_top_rank')->default(true)->after('is_triggered');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('bid_limit_prices', self::INDEX)) {
            Schema::table('bid_limit_prices', function (Blueprint $table) {
                $table->dropIndex(self::INDEX);
            });
        }
        Schema::table('bid_limit_prices', function (Blueprint $table) {
            $table->index(['item_id', 'is_triggered', 'limit_price'], self::INDEX);
        });
        if (Schema::hasColumn('bid_limit_prices', 'is_top_rank')) {
            Schema::table('bid_limit_prices', function (Blueprint $table) {
                $table->dropColumn('is_top_rank');
            });
        }
        if (Schema::hasTable('bid_limit_prices_archive') && Schema::hasColumn('bid_limit_prices_archive', 'is_top_rank')) {
            Schema::table('bid_limit_prices_archive', function (Blueprint $table) {
                $table->dropColumn('is_top_rank');
            });
        }
    }
};
