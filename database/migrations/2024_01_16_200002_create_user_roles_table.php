<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * ユーザーとロールの多対多関係
     * - 1ユーザーは複数のロールを持つことができる
     * - 例: seller かつ participant（自分で出品しつつ他の商品に入札）
     */
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('ユーザーID');
            $table->foreignId('role_id')
                ->constrained('roles')
                ->onDelete('cascade')
                ->comment('ロールID');
            $table->timestamp('assigned_at')->useCurrent()->comment('付与日時');
            $table->foreignId('assigned_by')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null')
                ->comment('付与者ID（管理者）');
            $table->timestamps();
            
            // インデックス・制約
            $table->unique(['user_id', 'role_id'], 'uk_user_role');
            $table->index('user_id');
            $table->index('role_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
