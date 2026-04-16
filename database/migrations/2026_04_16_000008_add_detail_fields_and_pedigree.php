<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 商品に性別・親魚情報・飼育環境フィールドを追加
        Schema::table('items', function (Blueprint $table) {
            $table->enum('sex', ['male', 'female', 'pair', 'mix'])->nullable()->after('quantity');
            $table->json('parent_fish_info')->nullable()->after('sex');
            $table->json('breeding_environment')->nullable()->after('parent_fish_info');
        });

        // デジタル血統証明書テーブル
        Schema::create('pedigree_certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('issued_by')->constrained('users');
            $table->string('certificate_number', 50)->unique();
            $table->string('breed_name', 100);
            $table->string('breed_type', 100)->nullable()->comment('品種タイプ（例：体外光、ラメ等）');
            $table->decimal('fixation_rate', 5, 2)->nullable()->comment('固定率%');
            $table->string('expression', 200)->nullable()->comment('表現型');
            $table->json('parent_male')->nullable()->comment('父魚情報');
            $table->json('parent_female')->nullable()->comment('母魚情報');
            $table->json('lineage')->nullable()->comment('血統3世代');
            $table->text('breeding_notes')->nullable();
            $table->enum('status', ['draft', 'issued', 'revoked'])->default('draft');
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();

            $table->index('item_id');
            $table->index('certificate_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedigree_certificates');
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['sex', 'parent_fish_info', 'breeding_environment']);
        });
    }
};
