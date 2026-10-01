<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レコメンドの出典に「マッチング（F-059）」を追加
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            $table->enum('source', ['collaborative', 'content_based', 'hybrid', 'trending', 'matching'])->change();
        });
    }

    public function down(): void
    {
        // 戻す前に matching の行を消す（enum に無い値が残ると型変更に失敗するため。レコメンドは再生成できる）
        \Illuminate\Support\Facades\DB::table('ai_recommendations')->where('source', 'matching')->delete();

        Schema::table('ai_recommendations', function (Blueprint $table) {
            $table->enum('source', ['collaborative', 'content_based', 'hybrid', 'trending'])->change();
        });
    }
};
