<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * sellers テーブルを seller_profiles にリネームし、
     * user_id を追加して users テーブルと紐付ける
     */
    public function up(): void
    {
        // 1. 既存の sellers テーブルを seller_profiles にリネーム
        Schema::rename('sellers', 'seller_profiles');
        
        // 2. user_id カラムを追加
        Schema::table('seller_profiles', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->after('id')
                ->unique()
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('ユーザーID');
        });
        
        // 3. items テーブルの外部キーを更新
        Schema::table('items', function (Blueprint $table) {
            // 既存の外部キー制約を削除
            $table->dropForeign(['seller_id']);
            
            // seller_id を seller_profile_id にリネーム
            $table->renameColumn('seller_id', 'seller_profile_id');
            
            // 新しい外部キー制約を追加
            $table->foreign('seller_profile_id')
                ->references('id')
                ->on('seller_profiles')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // items テーブルの外部キーを元に戻す
        Schema::table('items', function (Blueprint $table) {
            $table->dropForeign(['seller_profile_id']);
            $table->renameColumn('seller_profile_id', 'seller_id');
            $table->foreign('seller_id')
                ->references('id')
                ->on('seller_profiles')
                ->onDelete('set null');
        });
        
        // user_id カラムを削除
        Schema::table('seller_profiles', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
        
        // テーブル名を元に戻す
        Schema::rename('seller_profiles', 'sellers');
    }
};
