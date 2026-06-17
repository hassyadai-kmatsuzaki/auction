<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            // null = 審査中 / 値あり = 承認済み。承認日時の監査も兼ねる。
            // status とは独立した審査軸。落札ユーザーへの表示可否のみを制御し、
            // レーン割り当て（status='registered'）には影響しない。
            $table->timestamp('approved_at')->nullable()->after('status')
                ->comment('生体の審査承認日時。null=審査中。承認済みのみ落札ユーザーに表示・liveに昇格する。');
            $table->index('approved_at');
        });

        // 既存の出品済み生体（registered/live/sold/unsold）は承認済みとして扱う。
        // これをやらないと列追加で既存出品が全件「審査中」になり、参加者から消える。
        DB::table('items')
            ->whereIn('status', ['registered', 'live', 'sold', 'unsold'])
            ->whereNull('approved_at')
            ->update(['approved_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropIndex(['approved_at']);
            $table->dropColumn('approved_at');
        });
    }
};
