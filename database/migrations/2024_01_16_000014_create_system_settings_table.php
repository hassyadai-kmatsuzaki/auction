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
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('setting_key')->unique()->comment('設定キー');
            $table->text('setting_value')->comment('設定値');
            $table->enum('value_type', ['string', 'integer', 'decimal', 'boolean', 'json'])
                ->default('string')
                ->comment('値の型');
            $table->string('category', 100)->default('general')->comment('カテゴリ');
            $table->string('display_name')->comment('表示名');
            $table->text('description')->nullable()->comment('説明');
            $table->boolean('is_public')->default(false)->comment('公開設定');
            $table->timestamps();
            
            // インデックス
            $table->index('category');
        });

        // 初期設定値を投入
        DB::table('system_settings')->insert([
            // サイト設定
            [
                'setting_key' => 'site_name',
                'setting_value' => 'メダカライブオークション',
                'value_type' => 'string',
                'category' => 'site',
                'display_name' => 'サイト名',
                'description' => 'システムの名称',
                'is_public' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'contact_email',
                'setting_value' => 'info@medaka-auction.jp',
                'value_type' => 'string',
                'category' => 'site',
                'display_name' => '連絡先メールアドレス',
                'description' => '問い合わせ先メールアドレス',
                'is_public' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // オークション設定
            [
                'setting_key' => 'default_lane_count',
                'setting_value' => '6',
                'value_type' => 'integer',
                'category' => 'auction',
                'display_name' => 'デフォルトレーン数',
                'description' => '新規オークション作成時のレーン数',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'countdown_seconds',
                'setting_value' => '3',
                'value_type' => 'integer',
                'category' => 'auction',
                'display_name' => 'カウントダウン秒数',
                'description' => '複数人入札時の価格上昇間隔（秒）',
                'is_public' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'default_bid_increment',
                'setting_value' => '100',
                'value_type' => 'decimal',
                'category' => 'auction',
                'display_name' => 'デフォルト入札単位',
                'description' => '価格上昇の単位（円）',
                'is_public' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'price_increment_rate',
                'setting_value' => '10',
                'value_type' => 'decimal',
                'category' => 'auction',
                'display_name' => '価格上昇率',
                'description' => '自動価格上昇の割合（%）',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // プレミアムプラン設定
            [
                'setting_key' => 'premium_plan_fee',
                'setting_value' => '300',
                'value_type' => 'decimal',
                'category' => 'premium',
                'display_name' => 'プレミアムプラン料金',
                'description' => '個別撮影プラン料金（円）',
                'is_public' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'max_photos',
                'setting_value' => '3',
                'value_type' => 'integer',
                'category' => 'premium',
                'display_name' => '最大写真枚数',
                'description' => 'プレミアムプランの追加写真枚数',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // 支払い設定
            [
                'setting_key' => 'default_payment_deadline_hours',
                'setting_value' => '24',
                'value_type' => 'integer',
                'category' => 'payment',
                'display_name' => 'デフォルト入金期限（時間）',
                'description' => '落札後の入金期限',
                'is_public' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'default_commission_rate',
                'setting_value' => '10',
                'value_type' => 'decimal',
                'category' => 'payment',
                'display_name' => 'デフォルト手数料率',
                'description' => 'システム利用手数料率（%）',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // 配送設定
            [
                'setting_key' => 'default_shipping_deadline_hours',
                'setting_value' => '48',
                'value_type' => 'integer',
                'category' => 'shipping',
                'display_name' => 'デフォルト発送期限（時間）',
                'description' => '入金確認後の発送期限',
                'is_public' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'setting_key' => 'shipping_companies',
                'setting_value' => '["ヤマト運輸","佐川急便","日本郵便"]',
                'value_type' => 'json',
                'category' => 'shipping',
                'display_name' => '利用可能配送業者',
                'description' => '選択可能な配送業者リスト',
                'is_public' => true,
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
        Schema::dropIfExists('system_settings');
    }
};
