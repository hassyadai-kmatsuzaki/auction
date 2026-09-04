<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 発送登録で伝票番号を複数（最大10件・カンマ区切り）保持できるよう列を拡張する。
 *
 * 100 文字では 12 桁+ハイフンの番号を 10 件連結できない（14×10+9=149）。
 * 値の分割・結合は WonItem::splitTrackingNumbers / joinTrackingNumbers に集約する。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->string('tracking_number', 500)
                ->nullable()
                ->comment('追跡番号（複数はカンマ区切り・最大10件）')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('won_items', function (Blueprint $table) {
            $table->string('tracking_number', 100)
                ->nullable()
                ->comment('追跡番号')
                ->change();
        });
    }
};
