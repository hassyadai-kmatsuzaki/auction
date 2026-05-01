<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * 業務ロジックで参照されていない料金設定をsystem_settingsから削除する。
     * - 登録料 / 年会費は実態としてplansテーブルとSquareサブスクで管理されており未使用
     * - 基本出品料 / 最低手数料も実装上どこからも参照されていない
     * 手数料は出品者・買受者ともに一律10%（rate設定はそのまま残す）。
     * プレミアム出品料(premium_plan_fee)は将来再利用の可能性があるためDBレコードは残し、UIのみコメントアウト。
     */
    public function up(): void
    {
        DB::table('system_settings')->whereIn('setting_key', [
            'seller_registration_fee',
            'seller_annual_fee',
            'buyer_registration_fee',
            'base_listing_fee',
            'seller_commission_min',
            'buyer_commission_min',
        ])->delete();

        // 買受者手数料率を出品者と同じ10%に統一する
        DB::table('system_settings')
            ->where('setting_key', 'buyer_commission_rate')
            ->update(['setting_value' => '10', 'updated_at' => now()]);
    }

    public function down(): void
    {
        $now = now();
        $rows = [
            ['setting_key' => 'seller_registration_fee', 'setting_value' => '3000', 'value_type' => 'integer', 'display_name' => '出品者登録料（初回）', 'description' => '出品者登録時の初期費用'],
            ['setting_key' => 'seller_annual_fee',       'setting_value' => '0',    'value_type' => 'integer', 'display_name' => '出品者年会費',           'description' => '年間維持費（0で無料）'],
            ['setting_key' => 'buyer_registration_fee',  'setting_value' => '0',    'value_type' => 'integer', 'display_name' => '買受者登録料',           'description' => '買受者登録時の費用（0で無料）'],
            ['setting_key' => 'base_listing_fee',        'setting_value' => '500',  'value_type' => 'integer', 'display_name' => '基本出品料',             'description' => '1点あたりの出品料'],
            ['setting_key' => 'seller_commission_min',   'setting_value' => '500',  'value_type' => 'integer', 'display_name' => '出品者最低手数料',       'description' => '1点あたりの最低手数料'],
            ['setting_key' => 'buyer_commission_min',    'setting_value' => '300',  'value_type' => 'integer', 'display_name' => '買受者最低手数料',       'description' => '1点あたりの最低手数料'],
        ];

        foreach ($rows as $row) {
            DB::table('system_settings')->updateOrInsert(
                ['setting_key' => $row['setting_key']],
                array_merge($row, [
                    'category'   => 'payment',
                    'is_public'  => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }
    }
};
