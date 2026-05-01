<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auction_seller_shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')
                ->constrained('auctions')
                ->onDelete('cascade')
                ->comment('オークションID');
            $table->foreignId('seller_profile_id')
                ->constrained('seller_profiles')
                ->onDelete('cascade')
                ->comment('出品者ID');
            $table->enum('carrier', ['yu_pack', 'sagawa', 'yamato'])
                ->comment('配送業者: ゆうパック / 佐川 / ヤマト');
            $table->string('tracking_number', 50)->comment('伝票番号');
            $table->timestamps();

            $table->index(['auction_id', 'seller_profile_id']);
            $table->unique(
                ['auction_id', 'seller_profile_id', 'carrier', 'tracking_number'],
                'auction_seller_shipments_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auction_seller_shipments');
    }
};
