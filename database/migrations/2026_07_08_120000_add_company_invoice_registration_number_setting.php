<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 帳票（請求書・領収書・納品書・出品者支払通知書）に表示する
 * 「適格請求書発行事業者の登録番号（T+13桁）」の設定キーを追加する。
 *
 * SystemSetting::set() は既存レコードが無いと新規作成しないため、
 * 管理画面から入力できるよう空値で1件挿入しておく。値は運用側で登録番号を入力する。
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('system_settings')->where('setting_key', 'company_invoice_registration_number')->exists()) {
            return;
        }

        DB::table('system_settings')->insert([
            'setting_key'   => 'company_invoice_registration_number',
            'setting_value' => 'T9010001247770',
            'value_type'    => 'string',
            'category'      => 'document',
            'display_name'  => 'インボイス登録番号',
            'description'   => '適格請求書発行事業者の登録番号（T+13桁）。帳票の発行者欄に表示されます。',
            'is_public'     => false,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('setting_key', 'company_invoice_registration_number')
            ->delete();
    }
};
