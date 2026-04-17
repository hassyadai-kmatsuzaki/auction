<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_media', function (Blueprint $table) {
            $table->string('poster_path', 500)->nullable()->after('file_path')->comment('動画ポスター画像パス');
            $table->boolean('is_processed')->default(false)->after('poster_path')->comment('動画エンコード完了フラグ');
        });
    }

    public function down(): void
    {
        Schema::table('item_media', function (Blueprint $table) {
            $table->dropColumn(['poster_path', 'is_processed']);
        });
    }
};
