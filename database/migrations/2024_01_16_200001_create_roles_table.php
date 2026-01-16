<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * ロール定義テーブル
     * - admin: 管理者
     * - seller: 出品者
     * - participant: 参加者（入札者）
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique()->comment('ロール名');
            $table->string('display_name', 100)->comment('表示名');
            $table->text('description')->nullable()->comment('説明');
            $table->timestamps();
        });

        // 初期ロールを投入
        DB::table('roles')->insert([
            [
                'name' => 'admin',
                'display_name' => '管理者',
                'description' => 'システム全体の管理権限',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'seller',
                'display_name' => '出品者',
                'description' => '生体を出品する権限',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'participant',
                'display_name' => '参加者',
                'description' => 'オークションに参加して入札する権限',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
