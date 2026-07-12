<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 1Day会員の変更（2026-07-13 決定）:
 *   - 有効期間: 10日 → 14日
 *   - 銀行振込にも対応したため説明文から期間の起点を「お支払い完了」に統一
 *     （振込の場合は管理者の入金確認時点から起算される）
 *
 * 本番は 2026_07_10_100000 で duration_days=10 の行が投入済みのため UPDATE で反映する。
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('plans')->where('code', 'one_day')->update([
            'duration_days' => 14,
            'description'   => 'お支払い完了から14日間有効。落札のみ・自動更新なし。',
            'updated_at'    => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('plans')->where('code', 'one_day')->update([
            'duration_days' => 10,
            'description'   => '決済完了から10日間有効。落札のみ・自動更新なし。',
            'updated_at'    => now(),
        ]);
    }
};
