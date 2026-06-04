<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_media', function (Blueprint $table) {
            $table->string('original_path', 500)->nullable()->after('poster_path')->comment('動画オリジナル（無圧縮）パス。圧縮後も削除せず保持');
        });
    }

    public function down(): void
    {
        Schema::table('item_media', function (Blueprint $table) {
            $table->dropColumn('original_path');
        });
    }
};
