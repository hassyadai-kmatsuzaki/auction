<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SystemSetting;

class SystemSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // ==================== システム設定 ====================
            [
                'key' => 'site_name',
                'value' => 'メダカライブオークション',
                'type' => 'string',
                'category' => 'system',
                'label' => 'サイト名',
                'description' => 'サイトの表示名',
            ],
            [
                'key' => 'contact_email',
                'value' => 'info@example.com',
                'type' => 'string',
                'category' => 'system',
                'label' => '連絡先メールアドレス',
                'description' => '問い合わせ先メールアドレス',
            ],
            [
                'key' => 'contact_phone',
                'value' => '03-1234-5678',
                'type' => 'string',
                'category' => 'system',
                'label' => '連絡先電話番号',
                'description' => '問い合わせ先電話番号',
            ],
            [
                'key' => 'business_hours',
                'value' => '平日 10:00-18:00',
                'type' => 'string',
                'category' => 'system',
                'label' => '営業時間',
                'description' => '営業時間の表示',
            ],

            // ==================== オークション設定 ====================
            [
                'key' => 'price_increment_rate',
                'value' => '10',
                'type' => 'integer',
                'category' => 'auction',
                'label' => '価格上昇率（%）',
                'description' => '複数人入札時の価格上昇率',
            ],
            [
                'key' => 'price_increment_min',
                'value' => '50',
                'type' => 'integer',
                'category' => 'auction',
                'label' => '最低上昇金額（円）',
                'description' => '最低でもこの金額は上昇',
            ],
            [
                'key' => 'countdown_seconds',
                'value' => '3',
                'type' => 'integer',
                'category' => 'auction',
                'label' => 'カウントダウン秒数',
                'description' => '価格上昇までの待機時間',
            ],
            [
                'key' => 'max_lanes',
                'value' => '6',
                'type' => 'integer',
                'category' => 'auction',
                'label' => '最大レーン数',
                'description' => '同時進行できるレーン数',
            ],
            [
                'key' => 'auto_extend_seconds',
                'value' => '10',
                'type' => 'integer',
                'category' => 'auction',
                'label' => '自動延長秒数',
                'description' => '終了直前の入札で延長する秒数',
            ],

            // ==================== 料金設定（出品者向け） ====================
            [
                'key' => 'seller_registration_fee',
                'value' => '3000',
                'type' => 'integer',
                'category' => 'fee',
                'label' => '出品者登録料（初回）',
                'description' => '出品者登録時の初期費用',
            ],
            [
                'key' => 'seller_annual_fee',
                'value' => '0',
                'type' => 'integer',
                'category' => 'fee',
                'label' => '出品者年会費',
                'description' => '年間維持費（0で無料）',
            ],
            [
                'key' => 'base_listing_fee',
                'value' => '500',
                'type' => 'integer',
                'category' => 'fee',
                'label' => '基本出品料',
                'description' => '1点あたりの出品料',
            ],
            [
                'key' => 'premium_listing_fee',
                'value' => '800',
                'type' => 'integer',
                'category' => 'fee',
                'label' => 'プレミアム出品料',
                'description' => '個別撮影付きの出品料',
            ],
            [
                'key' => 'seller_commission_rate',
                'value' => '10',
                'type' => 'float',
                'category' => 'fee',
                'label' => '出品者販売手数料率（%）',
                'description' => '落札金額に対する手数料',
            ],
            [
                'key' => 'seller_commission_min',
                'value' => '500',
                'type' => 'integer',
                'category' => 'fee',
                'label' => '出品者最低手数料',
                'description' => '1点あたりの最低手数料',
            ],

            // ==================== 料金設定（買受者向け） ====================
            [
                'key' => 'buyer_registration_fee',
                'value' => '0',
                'type' => 'integer',
                'category' => 'fee',
                'label' => '買受者登録料',
                'description' => '買受者登録時の費用（0で無料）',
            ],
            [
                'key' => 'buyer_commission_rate',
                'value' => '5',
                'type' => 'float',
                'category' => 'fee',
                'label' => '買受者落札手数料率（%）',
                'description' => '落札金額に対する手数料',
            ],
            [
                'key' => 'buyer_commission_min',
                'value' => '300',
                'type' => 'integer',
                'category' => 'fee',
                'label' => '買受者最低手数料',
                'description' => '1点あたりの最低手数料',
            ],

            // ==================== 配送・梱包設定 ====================
            [
                'key' => 'packaging_fee',
                'value' => '500',
                'type' => 'integer',
                'category' => 'shipping',
                'label' => '梱包料金',
                'description' => '1件あたりの梱包費',
            ],
            [
                'key' => 'handling_fee',
                'value' => '300',
                'type' => 'integer',
                'category' => 'shipping',
                'label' => '取扱手数料',
                'description' => '発送事務手数料',
            ],
            [
                'key' => 'insurance_fee_rate',
                'value' => '3',
                'type' => 'float',
                'category' => 'shipping',
                'label' => '保険料率（%）',
                'description' => '落札金額に対する保険料',
            ],
            [
                'key' => 'cooling_fee_summer',
                'value' => '300',
                'type' => 'integer',
                'category' => 'shipping',
                'label' => '夏季クール便料金',
                'description' => '6-9月の追加料金',
            ],
            [
                'key' => 'heating_fee_winter',
                'value' => '300',
                'type' => 'integer',
                'category' => 'shipping',
                'label' => '冬季保温料金',
                'description' => '12-2月の追加料金',
            ],
            [
                'key' => 'shipping_rates',
                'value' => json_encode([
                    ['region' => '関東', 'size_60' => 800, 'size_80' => 1000, 'size_100' => 1200],
                    ['region' => '関西', 'size_60' => 900, 'size_80' => 1100, 'size_100' => 1300],
                    ['region' => '北海道', 'size_60' => 1500, 'size_80' => 1800, 'size_100' => 2100],
                    ['region' => '沖縄', 'size_60' => 1800, 'size_80' => 2200, 'size_100' => 2600],
                    ['region' => 'その他', 'size_60' => 1000, 'size_80' => 1200, 'size_100' => 1500],
                ]),
                'type' => 'json',
                'category' => 'shipping',
                'label' => '地域別配送料金',
                'description' => '地域とサイズ別の配送料金テーブル',
            ],

            // ==================== 帳票設定 ====================
            [
                'key' => 'company_name',
                'value' => '株式会社日本メダカオンライン市場',
                'type' => 'string',
                'category' => 'document',
                'label' => '会社名・屋号',
                'description' => '帳票に表示する会社名',
            ],
            [
                'key' => 'company_address',
                'value' => '東京都渋谷区xxx 1-2-3',
                'type' => 'string',
                'category' => 'document',
                'label' => '会社住所',
                'description' => '帳票に表示する住所',
            ],
            [
                'key' => 'company_phone',
                'value' => '03-1234-5678',
                'type' => 'string',
                'category' => 'document',
                'label' => '会社電話番号',
                'description' => '帳票に表示する電話番号',
            ],
            [
                'key' => 'company_email',
                'value' => 'info@example.com',
                'type' => 'string',
                'category' => 'document',
                'label' => '会社メールアドレス',
                'description' => '帳票に表示するメールアドレス',
            ],
            [
                'key' => 'bank_name',
                'value' => '三菱UFJ銀行',
                'type' => 'string',
                'category' => 'document',
                'label' => '銀行名',
                'description' => '振込先銀行名',
            ],
            [
                'key' => 'bank_branch',
                'value' => '渋谷支店',
                'type' => 'string',
                'category' => 'document',
                'label' => '支店名',
                'description' => '振込先支店名',
            ],
            [
                'key' => 'bank_account_type',
                'value' => '普通',
                'type' => 'string',
                'category' => 'document',
                'label' => '口座種別',
                'description' => '口座種別（普通/当座）',
            ],
            [
                'key' => 'bank_account_number',
                'value' => '1234567',
                'type' => 'string',
                'category' => 'document',
                'label' => '口座番号',
                'description' => '振込先口座番号',
            ],
            [
                'key' => 'bank_account_holder',
                'value' => 'カ）ニホンメダカオンラインイチバ',
                'type' => 'string',
                'category' => 'document',
                'label' => '口座名義',
                'description' => '振込先口座名義',
            ],
            [
                'key' => 'invoice_prefix',
                'value' => 'INV-',
                'type' => 'string',
                'category' => 'document',
                'label' => '請求書プレフィックス',
                'description' => '請求書番号のプレフィックス',
            ],
            [
                'key' => 'payment_notice_prefix',
                'value' => 'PAY-',
                'type' => 'string',
                'category' => 'document',
                'label' => '支払通知書プレフィックス',
                'description' => '支払通知書番号のプレフィックス',
            ],
            [
                'key' => 'warranty_validity_days',
                'value' => '14',
                'type' => 'integer',
                'category' => 'document',
                'label' => '保証書有効日数',
                'description' => '到着後の保証期間（日数）',
            ],
            [
                'key' => 'auto_generate_invoice',
                'value' => '1',
                'type' => 'boolean',
                'category' => 'document',
                'label' => '請求書自動発行',
                'description' => '落札確定時に請求書を自動生成',
            ],
            [
                'key' => 'auto_generate_payment_notice',
                'value' => '1',
                'type' => 'boolean',
                'category' => 'document',
                'label' => '支払通知書自動発行',
                'description' => '入金確認時に支払通知書を自動生成',
            ],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}
