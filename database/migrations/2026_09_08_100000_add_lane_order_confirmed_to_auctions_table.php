<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * レーン割当の「出品者順序 確定」状態を auctions に持たせる。
 *
 * 未確定（null）の間、レーン画面は出品者グループ単位の配置モードで、
 * 生体単位の割当・並び替え API（assignItem / removeItem / reorderItems）は拒否される。
 * 確定後は従来どおり生体単位で操作できる（LaneController::assertLaneOrderConfirmed）。
 *
 * 既にレーン割当が存在するオークションは、運用中の作業を止めないため
 * 「確定済み」として扱う（後方互換のバックフィル）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->timestamp('lane_order_confirmed_at')
                ->nullable()
                ->after('lane_count')
                ->comment('レーン割当の出品者順序を確定した日時（null=未確定・グループ配置モード）');
            $table->unsignedBigInteger('lane_order_confirmed_by')
                ->nullable()
                ->after('lane_order_confirmed_at')
                ->comment('確定操作を行った管理者 users.id');
        });

        // バックフィル: すでにレーン割当があるオークションは確定済み扱いにする
        $auctionIds = DB::table('lane_items')
            ->join('lanes', 'lanes.id', '=', 'lane_items.lane_id')
            ->distinct()
            ->pluck('lanes.auction_id');

        if ($auctionIds->isNotEmpty()) {
            DB::table('auctions')
                ->whereIn('id', $auctionIds)
                ->whereNull('lane_order_confirmed_at')
                ->update(['lane_order_confirmed_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('auctions', function (Blueprint $table) {
            $table->dropColumn(['lane_order_confirmed_at', 'lane_order_confirmed_by']);
        });
    }
};
