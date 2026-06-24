<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 手動でサムネを指定した個体を、自動サムネ（品種ビューによる自動適用・遡及バッチ）の
     * 上書き対象から外すためのフラグ。
     * true = 人が admin/media_editor で明示指定 → 自動適用はスキップする。
     */
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->boolean('thumbnail_is_manual')->default(false)->after('thumbnail_path')
                ->comment('true=手動サムネ指定。品種ビューによる自動サムネ適用の対象外にする');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn('thumbnail_is_manual');
        });
    }
};
