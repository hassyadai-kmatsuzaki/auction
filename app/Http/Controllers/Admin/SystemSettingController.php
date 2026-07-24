<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SystemSettingController extends Controller
{
    /**
     * 平文で画面に返してはいけない設定キー（APIキー等）。
     *
     * 読み出し時は先頭数文字だけ残してマスクし、保存時はマスク済みの値が
     * 送り返されてきたら「変更なし」として無視する（フォーム全体を PUT する
     * 作りのため、無視しないと開くだけでキーが壊れる）。
     *
     * @var array<int, string>
     */
    private const MASKED_KEYS = ['ene_crm_api_key'];

    /**
     * マスク表示の先頭に残す文字数（cc_live_xxxx… まで見えれば取り違えを防げる）。
     */
    private const MASK_VISIBLE_PREFIX = 12;

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
                    'value' => $this->maskIfSecret($item->setting_key, $this->castValue($item->setting_value, $item->value_type)),
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
                'value' => $this->maskIfSecret($item->setting_key, $this->castValue($item->setting_value, $item->value_type)),
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
            // マスク済みの値（画面に表示されたまま送り返された値）は保存しない。
            // 空文字も「未入力＝現状維持」とみなす（消したい場合は無効化トグルを使う）。
            if (in_array($key, self::MASKED_KEYS, true) && $this->isUnchangedSecret($value)) {
                continue;
            }

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

    /**
     * APIキー等を「cc_live_3f8a…」形式にマスクする。未設定なら空文字のまま返す。
     *
     * @param mixed $value
     * @return mixed
     */
    private function maskIfSecret(string $key, $value)
    {
        if (!in_array($key, self::MASKED_KEYS, true) || !is_string($value) || $value === '') {
            return $value;
        }

        return mb_substr($value, 0, self::MASK_VISIBLE_PREFIX) . '…';
    }

    /**
     * 保存要求の値が「マスク済み（＝画面で編集されていない）」かどうか。
     *
     * @param mixed $value
     */
    private function isUnchangedSecret($value): bool
    {
        return !is_string($value) || trim($value) === '' || str_ends_with($value, '…');
    }
}
