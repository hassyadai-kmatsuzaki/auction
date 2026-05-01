<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * オークション自体にテスト/本番のフラグを持たせる。
 *
 * 可視性ルール:
 * - is_test=true なオークション → is_test=true な買受者だけが見える、is_test=true な出品者だけが出品できる
 * - is_test=false なオークション → 通常運用（テストモード中は通常買受者には見えないが、テスト買受者は見える）
 *
 * これによりテスト用オークションが本番出品者・本番買受者から完全に隔離される。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->boolean('is_test')
                  ->default(false)
                  ->after('status')
                  ->comment('テスト用オークションか。trueの場合は is_test=true ユーザーだけが相互可視');
            $table->index('is_test');
        });
    }

    public function down(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->dropIndex(['is_test']);
            $table->dropColumn('is_test');
        });
    }
};
