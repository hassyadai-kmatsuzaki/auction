<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A-8 (2026-09-08): 指値検索用の複合インデックスをマイグレーションに載せる。
 *
 * 本番には 2026-05-21 に手動 ALTER で `idx_active_limits (item_id, is_triggered, limit_price)` を
 * 追加済みだが、コードに記録が無く、DB を再構築すると消える。
 * 入札のたびに JoinBidAction が `WHERE item_id=? AND is_triggered=0` の EXISTS を発行し、
 * adjustPriceByBidLimits が `... AND limit_price > ?` で検索するため、無いと全件走査になる。
 *
 * 既に存在する環境（本番）では何もしない。
 */
return new class extends Migration
{
    private const INDEX = 'idx_active_limits';

    public function up(): void
    {
        if (Schema::hasIndex('bid_limit_prices', self::INDEX)) {
            return;
        }

        Schema::table('bid_limit_prices', function (Blueprint $table) {
            $table->index(['item_id', 'is_triggered', 'limit_price'], self::INDEX);
        });
    }

    public function down(): void
    {
        if (!Schema::hasIndex('bid_limit_prices', self::INDEX)) {
            return;
        }

        Schema::table('bid_limit_prices', function (Blueprint $table) {
            $table->dropIndex(self::INDEX);
        });
    }
};
