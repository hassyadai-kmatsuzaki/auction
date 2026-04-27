<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 自動計算 / 混合（auto種別のみ）の送料計算済み WonItem に対し、
 * 既存データを承認済みとしてバックフィルする。
 *
 * 背景: 「送料承認」フローを「その他（manual）」を含む発送単位限定にしたため、
 * auto / mixed は送料計算と同時に承認される運用に変更。
 * 既存に残っていた「計算済みだが未承認」の auto/mixed レコードは
 * UI から承認できなくなるため、shipping_calculated_at と同値で承認時刻をセットする。
 */
return new class extends Migration {
    public function up(): void
    {
        DB::table('won_items')
            ->whereIn('calculation_mode', ['auto', 'mixed'])
            ->whereNotNull('shipping_calculated_at')
            ->whereNull('shipping_approved_at')
            ->update([
                'shipping_approved_at' => DB::raw('shipping_calculated_at'),
            ]);
    }

    public function down(): void
    {
        // バックフィルは不可逆（誰がいつ承認したかの真の値ではないため、戻す意味はない）
    }
};
