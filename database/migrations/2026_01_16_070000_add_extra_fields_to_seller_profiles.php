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
        Schema::table('seller_profiles', function (Blueprint $table) {
            // 基本情報の追加
            $table->string('corporate_name')->nullable()->after('seller_name')->comment('法人名');
            $table->string('business_type', 50)->nullable()->after('corporate_name')->comment('事業形態');
            $table->string('business_registration_number', 50)->nullable()->after('business_type')->comment('事業者登録番号');
            
            // SNS・Web情報
            $table->string('instagram', 100)->nullable()->after('address_line2')->comment('Instagram');
            $table->string('twitter', 100)->nullable()->after('instagram')->comment('Twitter/X');
            $table->string('youtube')->nullable()->after('twitter')->comment('YouTube');
            $table->string('website')->nullable()->after('youtube')->comment('Webサイト');
            $table->string('other_sns')->nullable()->after('website')->comment('その他SNS');
            
            // 任意情報
            $table->text('sales_channels')->nullable()->after('other_sns')->comment('販売チャネル');
            $table->text('event_history')->nullable()->after('sales_channels')->comment('イベント出店歴');
            $table->text('event_hosting')->nullable()->after('event_history')->comment('イベント開催歴');
            $table->string('shop_address')->nullable()->after('event_hosting')->comment('店舗住所');
            
            // 設定
            $table->json('notification_settings')->nullable()->after('notes')->comment('通知設定');
            $table->json('display_settings')->nullable()->after('notification_settings')->comment('表示設定');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('seller_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'corporate_name',
                'business_type',
                'business_registration_number',
                'instagram',
                'twitter',
                'youtube',
                'website',
                'other_sns',
                'sales_channels',
                'event_history',
                'event_hosting',
                'shop_address',
                'notification_settings',
                'display_settings',
            ]);
        });
    }
};
