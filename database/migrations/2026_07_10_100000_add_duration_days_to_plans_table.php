<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 1Day会員導入:
 *   - plans.duration_days 追加（null = 従来どおり1年更新の年会費プラン）
 *   - 1Dayプラン（one_day / 500円 / 10日間 / 落札のみ / 自動更新なし）を投入
 *
 * plans はコールドテーブル（従来2行）。ホットテーブルへの変更はない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->unsignedSmallInteger('duration_days')->nullable()->after('amount')
                ->comment('有効日数。null=1年（年会費・自動更新）');
        });

        DB::table('plans')->updateOrInsert(
            ['code' => 'one_day'],
            [
                'name'          => '1Day会員',
                'description'   => '決済完了から10日間有効。落札のみ・自動更新なし。',
                'amount'        => 500,
                'duration_days' => 10,
                'allows_bid'    => true,
                'allows_sell'   => false,
                'is_active'     => true,
                'sort_order'    => 3,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]
        );
    }

    public function down(): void
    {
        // 既に加入者がいる場合は plan 行を消せない（subscriptions.plan_id が restrictOnDelete）ため
        // 受付停止に留め、カラムだけ落とす。
        DB::table('plans')->where('code', 'one_day')->update(['is_active' => false, 'updated_at' => now()]);

        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('duration_days');
        });
    }
};
