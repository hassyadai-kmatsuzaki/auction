<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->string('exhibit_code', 8)->nullable()->after('item_number')
                ->comment('出品ID（表示専用）。例: A001。レーン割当時に発行され以後固定。');
            $table->timestamp('exhibit_code_issued_at')->nullable()->after('exhibit_code')
                ->comment('出品ID発行日時');
            $table->index('exhibit_code');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropIndex(['exhibit_code']);
            $table->dropColumn(['exhibit_code', 'exhibit_code_issued_at']);
        });
    }
};
