<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * テストモード機能の DB 基盤を追加する。
 *
 * - users.is_test: そのユーザーがテストユニバースに属するか
 * - system_settings.test_mode_enabled: サイト全体のテストモード ON/OFF
 *
 * テストモード ON 中は「is_test=true 同士の閉じた世界」だけが見える運用。
 * 詳細は app/Services/TestModeService.php を参照。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_test')
                  ->default(false)
                  ->after('is_active')
                  ->comment('テストモード時に閉じたテストユニバースに属するか。trueのユーザー同士のみ相互可視');
        });

        // 既存設定が無ければ追加。再実行しても重複しない。
        $exists = DB::table('system_settings')->where('setting_key', 'test_mode_enabled')->exists();
        if (!$exists) {
            DB::table('system_settings')->insert([
                'setting_key' => 'test_mode_enabled',
                'setting_value' => 'false',
                'value_type' => 'boolean',
                'category' => 'general',
                'display_name' => 'テストモード',
                'description' => 'ON にすると is_test=true のユーザー同士だけがオークション・出品・落札を相互に可視できる。先行登録ユーザーへの限定公開などに使う',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('system_settings')->where('setting_key', 'test_mode_enabled')->delete();
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_test');
        });
    }
};
