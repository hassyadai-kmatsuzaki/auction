<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * オークション終了後のログを退避するアーカイブテーブル群
     *
     * 設計方針:
     *  - 元テーブルと同一スキーマを維持（カラム追加なし）
     *  - 外部キーは張らない（元側を物理削除しても安全なように）
     *  - archived_auction_id でオークション単位で検索可能にする
     *  - archived_at でいつ退避したかを記録
     *  - 元テーブルのインデックスに相当する索引を維持（過去データ参照時のクエリ性能確保）
     */
    public function up(): void
    {
        // bid_events_archive
        Schema::create('bid_events_archive', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary()->comment('元テーブルのID（衝突させない）');
            $table->unsignedBigInteger('archived_auction_id')->comment('退避元オークションID');
            $table->unsignedBigInteger('item_id')->comment('生体ID');
            $table->unsignedBigInteger('user_id')->comment('ユーザーID');
            $table->enum('event_type', [
                'join', 'leave', 'price_accept', 'auto_raise',
                'manual_raise', 'win', 'lose',
            ])->comment('イベント種別');
            $table->decimal('price_at_event', 10, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('archived_at')->useCurrent()->comment('退避日時');

            $table->index('archived_auction_id', 'idx_bea_auction');
            $table->index(['item_id', 'created_at'], 'idx_bea_item_created');
            $table->index('user_id', 'idx_bea_user');
            $table->index('event_type', 'idx_bea_type');
        });

        // price_events_archive
        Schema::create('price_events_archive', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('archived_auction_id')->comment('退避元オークションID');
            $table->unsignedBigInteger('item_id');
            $table->decimal('old_price', 10, 2);
            $table->decimal('new_price', 10, 2);
            $table->enum('reason', [
                'auto_increment', 'manual_adjustment', 'bid_accepted',
                'item_start', 'item_sold',
            ]);
            $table->unsignedInteger('active_bidder_count')->default(0);
            $table->unsignedBigInteger('triggered_by')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('archived_at')->useCurrent();

            $table->index('archived_auction_id', 'idx_pea_auction');
            $table->index(['item_id', 'created_at'], 'idx_pea_item_created');
            $table->index('reason', 'idx_pea_reason');
        });

        // bid_participants_archive
        Schema::create('bid_participants_archive', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('archived_auction_id')->comment('退避元オークションID');
            $table->unsignedBigInteger('item_id');
            $table->unsignedBigInteger('user_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('archived_at')->useCurrent();

            $table->index('archived_auction_id', 'idx_bpa_auction');
            $table->index(['item_id', 'user_id'], 'idx_bpa_item_user');
            $table->index('user_id', 'idx_bpa_user');
        });

        // bid_limit_prices_archive
        Schema::create('bid_limit_prices_archive', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('archived_auction_id')->comment('退避元オークションID');
            $table->unsignedBigInteger('item_id');
            $table->unsignedBigInteger('user_id');
            $table->decimal('limit_price', 12, 2);
            $table->boolean('is_triggered')->default(false);
            $table->timestamp('triggered_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('archived_at')->useCurrent();

            $table->index('archived_auction_id', 'idx_blpa_auction');
            $table->index(['item_id', 'user_id'], 'idx_blpa_item_user');
            $table->index('user_id', 'idx_blpa_user');
        });

        // lane_items_archive
        Schema::create('lane_items_archive', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('archived_auction_id')->comment('退避元オークションID');
            $table->unsignedBigInteger('lane_id');
            $table->unsignedBigInteger('item_id');
            $table->unsignedInteger('sequence_order');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('archived_at')->useCurrent();

            $table->index('archived_auction_id', 'idx_lia_auction');
            $table->index('item_id', 'idx_lia_item');
            $table->index(['lane_id', 'sequence_order'], 'idx_lia_lane_seq');
        });

        // アーカイブ履歴（監査用）
        Schema::create('auction_archive_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('auction_id')->comment('対象オークションID（auctions削除後も残せるようFKなし）');
            $table->enum('operation', ['archive', 'unarchive'])->comment('操作種別');
            $table->unsignedInteger('bid_events_count')->default(0);
            $table->unsignedInteger('price_events_count')->default(0);
            $table->unsignedInteger('bid_participants_count')->default(0);
            $table->unsignedInteger('bid_limit_prices_count')->default(0);
            $table->unsignedInteger('lane_items_count')->default(0);
            $table->unsignedBigInteger('executed_by')->nullable()->comment('実行ユーザー（CLIの場合NULL）');
            $table->text('note')->nullable();
            $table->timestamp('executed_at')->useCurrent();

            $table->index(['auction_id', 'operation']);
            $table->index('executed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auction_archive_logs');
        Schema::dropIfExists('lane_items_archive');
        Schema::dropIfExists('bid_limit_prices_archive');
        Schema::dropIfExists('bid_participants_archive');
        Schema::dropIfExists('price_events_archive');
        Schema::dropIfExists('bid_events_archive');
    }
};
