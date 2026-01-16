<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // ユーザー種別
            $table->enum('user_type', ['admin', 'participant'])
                ->default('participant')
                ->after('password');
            
            // 連絡先情報
            $table->string('phone', 20)->nullable()->after('user_type');
            $table->string('postal_code', 10)->nullable()->after('phone');
            $table->string('prefecture', 50)->nullable()->after('postal_code');
            $table->string('city', 100)->nullable()->after('prefecture');
            $table->string('address_line1')->nullable()->after('city');
            $table->string('address_line2')->nullable()->after('address_line1');
            
            // 承認ステータス
            $table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])
                ->default('pending')
                ->after('address_line2');
            $table->timestamp('approved_at')->nullable()->after('status');
            $table->foreignId('approved_by')
                ->nullable()
                ->after('approved_at')
                ->constrained('users')
                ->onDelete('set null');
            $table->text('rejected_reason')->nullable()->after('approved_by');
            
            // その他
            $table->timestamp('last_login_at')->nullable()->after('rejected_reason');
            $table->boolean('is_active')->default(true)->after('last_login_at');
            
            // 論理削除
            $table->softDeletes();
            
            // インデックス
            $table->index('user_type');
            $table->index('status');
            $table->index(['status', 'approved_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropIndex(['user_type']);
            $table->dropIndex(['status']);
            $table->dropIndex(['status', 'approved_at']);
            
            $table->dropColumn([
                'user_type',
                'phone',
                'postal_code',
                'prefecture',
                'city',
                'address_line1',
                'address_line2',
                'status',
                'approved_at',
                'approved_by',
                'rejected_reason',
                'last_login_at',
                'is_active',
                'deleted_at',
            ]);
        });
    }
};
