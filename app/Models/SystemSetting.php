<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends BaseModel
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'setting_key',
        'setting_value',
        'value_type',
        'category',
        'display_name',
        'description',
        'is_public',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_public' => 'boolean',
    ];

    /**
     * キャッシュキー
     */
    const CACHE_KEY = 'system_settings';
    const CACHE_TTL = 3600; // 1時間

    /**
     * 設定値を取得
     *
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        $settings = self::getAllCached();
        
        if (!isset($settings[$key])) {
            return $default;
        }

        return self::castValue($settings[$key]['value'], $settings[$key]['type']);
    }

    /**
     * 設定値を保存
     *
     * @param string $key
     * @param mixed $value
     * @return bool
     */
    public static function set(string $key, $value): bool
    {
        $setting = self::where('setting_key', $key)->first();
        
        if (!$setting) {
            return false;
        }

        $setting->setting_value = is_array($value) ? json_encode($value) : (string) $value;
        $setting->save();

        // キャッシュをクリア
        Cache::forget(self::CACHE_KEY);

        return true;
    }

    /**
     * カテゴリ別に設定を取得
     *
     * @param string $category
     * @return array
     */
    public static function getByCategory(string $category): array
    {
        $settings = self::getAllCached();
        
        return array_filter($settings, function ($setting) use ($category) {
            return $setting['category'] === $category;
        });
    }

    /**
     * すべての設定を取得（キャッシュ付き）
     *
     * @return array
     */
    public static function getAllCached(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            $settings = self::all();
            $result = [];
            
            foreach ($settings as $setting) {
                $result[$setting->setting_key] = [
                    'value' => $setting->setting_value,
                    'type' => $setting->value_type,
                    'category' => $setting->category,
                    'label' => $setting->display_name,
                    'description' => $setting->description,
                    'is_public' => $setting->is_public,
                ];
            }
            
            return $result;
        });
    }

    /**
     * キャッシュをクリア
     */
    public static function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * 値を適切な型にキャスト
     *
     * @param string|null $value
     * @param string $type
     * @return mixed
     */
    protected static function castValue($value, string $type)
    {
        if ($value === null) {
            return null;
        }

        switch ($type) {
            case 'integer':
                return (int) $value;
            case 'decimal':
            case 'float':
                return (float) $value;
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'json':
                return json_decode($value, true);
            default:
                return $value;
        }
    }

    /**
     * オークション設定のデフォルト値を取得
     *
     * @return array
     */
    public static function getAuctionDefaults(): array
    {
        return [
            'price_increment_rate' => self::get('price_increment_rate', 10),
            'price_increment_min' => self::get('price_increment_min', 50),
            'countdown_seconds' => self::get('countdown_seconds', 3),
            'countdown_seconds_default' => self::get('countdown_seconds_default', 10),
            'countdown_seconds_competitive' => self::get('countdown_seconds_competitive', 1),
            'max_lanes' => self::get('default_lane_count', 6),
            'auto_extend_seconds' => self::get('auto_extend_seconds', 10),
            'default_bid_increment' => self::get('default_bid_increment', 100),
            'venue_open_minutes_before_start' => self::get('venue_open_minutes_before_start', 30),
            'item_switch_delay_seconds' => self::get('item_switch_delay_seconds', 5),
            'freeze_countdown_seconds' => self::get('freeze_countdown_seconds', 1),
            'bid_countdown_seconds' => self::get('bid_countdown_seconds', 5),
            'post_sale_display_seconds' => self::get('post_sale_display_seconds', 2),
            'auction_start_countdown_seconds' => self::get('auction_start_countdown_seconds', 10),
            'price_increment_tiers' => self::get('default_price_increment_tiers', [
                ['from_price' => 0,     'to_price' => 999,   'increment_amount' => 50],
                ['from_price' => 1000,  'to_price' => 4999,  'increment_amount' => 100],
                ['from_price' => 5000,  'to_price' => 9999,  'increment_amount' => 500],
                ['from_price' => 10000, 'to_price' => 49999, 'increment_amount' => 1000],
                ['from_price' => 50000, 'to_price' => null,  'increment_amount' => 5000],
            ]),
        ];
    }

    /**
     * 料金設定のデフォルト値を取得
     *
     * @return array
     */
    public static function getFeeDefaults(): array
    {
        return [
            // 出品者向け
            'seller_registration_fee' => self::get('seller_registration_fee', 3000),
            'seller_annual_fee' => self::get('seller_annual_fee', 0),
            'base_listing_fee' => self::get('base_listing_fee', 500),
            'premium_listing_fee' => self::get('premium_plan_fee', 300),
            'seller_commission_rate' => self::get('default_commission_rate', 10),
            'seller_commission_min' => self::get('seller_commission_min', 500),
            // 買受者向け
            'buyer_registration_fee' => self::get('buyer_registration_fee', 0),
            'buyer_commission_rate' => self::get('buyer_commission_rate', 5),
            'buyer_commission_min' => self::get('buyer_commission_min', 300),
        ];
    }

    /**
     * 配送・梱包設定のデフォルト値を取得
     *
     * @return array
     */
    public static function getShippingDefaults(): array
    {
        return [
            'packaging_fee' => self::get('packaging_fee', 500),
            'handling_fee' => self::get('handling_fee', 300),
            'insurance_fee_rate' => self::get('insurance_fee_rate', 3),
            'cooling_fee_summer' => self::get('cooling_fee_summer', 300),
            'heating_fee_winter' => self::get('heating_fee_winter', 300),
            'shipping_rates' => self::get('shipping_rates', [
                ['region' => '関東', 'size_60' => 800, 'size_80' => 1000, 'size_100' => 1200],
                ['region' => '関西', 'size_60' => 900, 'size_80' => 1100, 'size_100' => 1300],
                ['region' => '北海道', 'size_60' => 1500, 'size_80' => 1800, 'size_100' => 2100],
                ['region' => '沖縄', 'size_60' => 1800, 'size_80' => 2200, 'size_100' => 2600],
                ['region' => 'その他', 'size_60' => 1000, 'size_80' => 1200, 'size_100' => 1500],
            ]),
            'shipping_companies' => self::get('shipping_companies', ['ヤマト運輸', '佐川急便', '日本郵便']),
        ];
    }
}
