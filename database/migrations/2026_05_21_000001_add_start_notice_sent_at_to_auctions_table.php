<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->timestamp('start_notice_sent_at')->nullable()->after('published_at')
                ->comment('開始予告通知（30分前）送信日時。冪等性フラグ。');
        });
    }

    public function down(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->dropColumn('start_notice_sent_at');
        });
    }
};
