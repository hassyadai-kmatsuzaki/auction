<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->boolean('is_published')->default(false)->after('status')
                ->comment('落札者管理画面への公開フラグ。true で参加者の落札者管理画面に表示される。');
            $table->timestamp('published_at')->nullable()->after('is_published')
                ->comment('公開操作日時');
        });
    }

    public function down(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->dropColumn(['is_published', 'published_at']);
        });
    }
};
