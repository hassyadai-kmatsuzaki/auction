<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SystemSettingController extends Controller
{
    /**
     * すべての設定を取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $settings = SystemSetting::all()->groupBy('category');
        
        $result = [];
        foreach ($settings as $category => $items) {
            $result[$category] = [];
            foreach ($items as $item) {
                $result[$category][$item->setting_key] = [
                    'value' => $this->castValue($item->setting_value, $item->value_type),
                    'type' => $item->value_type,
                    'label' => $item->display_name,
                    'description' => $item->description,
                    'is_public' => $item->is_public,
                ];
            }
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $result,
            ],
        ]);
    }

    /**
     * カテゴリ別に設定を取得
     *
     * @param string $category
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(string $category)
    {
        $settings = SystemSetting::where('category', $category)->get();
        
        $result = [];
        foreach ($settings as $item) {
            $result[$item->setting_key] = [
                'value' => $this->castValue($item->setting_value, $item->value_type),
                'type' => $item->value_type,
                'label' => $item->display_name,
                'description' => $item->description,
                'is_public' => $item->is_public,
            ];
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'category' => $category,
                'settings' => $result,
            ],
        ]);
    }

    /**
     * 設定を更新
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request)
    {
        $settings = $request->input('settings', []);
        
        foreach ($settings as $key => $value) {
            $setting = SystemSetting::where('setting_key', $key)->first();
            
            if ($setting) {
                // JSONの場合はエンコード
                if ($setting->value_type === 'json' && is_array($value)) {
                    $value = json_encode($value);
                } elseif ($setting->value_type === 'boolean') {
                    $value = $value ? '1' : '0';
                }
                
                $setting->setting_value = (string) $value;
                $setting->save();
            }
        }
        
        // キャッシュをクリア
        SystemSetting::clearCache();
        
        return response()->json([
            'success' => true,
            'message' => '設定を保存しました。',
        ]);
    }

    /**
     * オークション設定のデフォルト値を取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAuctionDefaults()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'auction_settings' => SystemSetting::getAuctionDefaults(),
                'fee_settings' => SystemSetting::getFeeDefaults(),
                'shipping_settings' => SystemSetting::getShippingDefaults(),
            ],
        ]);
    }

    /**
     * 配送料金テーブルを取得
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getShippingRates()
    {
        $rates = SystemSetting::get('shipping_rates', []);
        
        return response()->json([
            'success' => true,
            'data' => [
                'shipping_rates' => $rates,
            ],
        ]);
    }

    /**
     * 配送料金テーブルを更新
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateShippingRates(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'shipping_rates' => 'required|array',
            'shipping_rates.*.region' => 'required|string',
            'shipping_rates.*.size_60' => 'required|integer|min:0',
            'shipping_rates.*.size_80' => 'required|integer|min:0',
            'shipping_rates.*.size_100' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        SystemSetting::set('shipping_rates', $request->shipping_rates);
        
        return response()->json([
            'success' => true,
            'message' => '配送料金テーブルを更新しました。',
        ]);
    }

    /**
     * 値を適切な型にキャスト
     *
     * @param string|null $value
     * @param string $type
     * @return mixed
     */
    protected function castValue($value, string $type)
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
}
