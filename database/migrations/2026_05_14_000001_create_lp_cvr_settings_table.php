<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lp_cvr_settings', function (Blueprint $table) {
            $table->id();
            $table->enum('lp_type', ['buyer', 'seller'])->comment('LPタイプ');
            $table->string('rid', 64)->comment('流入経路ID');
            $table->string('cta_url', 512)->comment('CTAボタンの遷移先URL');
            $table->string('note', 255)->nullable()->comment('管理用メモ');
            $table->timestamps();

            $table->unique(['lp_type', 'rid']);
            $table->index('lp_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lp_cvr_settings');
    }
};
