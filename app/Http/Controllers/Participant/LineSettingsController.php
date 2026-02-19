<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\LineNotificationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LineSettingsController extends Controller
{
    /** 通知種別の定義 */
    private const NOTIFICATION_TYPES = [
        'auction_start'       => 'オークション開始通知',
        'won_item'            => '落札通知',
        'payment_reminder'    => '入金催促',
        'shipping_completed'  => '発送完了通知',
        'auction_preview'     => 'オークション予告（前日）',
        'bid_limit_reached'   => '指値発動通知',
        'new_auction'         => '新規オークション通知',
        'favorite_approaching'=> 'お気に入り順番接近通知',
    ];

    /** 通知設定一覧を取得 */
    public function index(): JsonResponse
    {
        $userId   = Auth::id();
        $settings = LineNotificationSetting::where('user_id', $userId)->get()->keyBy('notification_type');

        $result = [];
        foreach (self::NOTIFICATION_TYPES as $type => $label) {
            $setting = $settings->get($type);
            $result[] = [
                'type'       => $type,
                'label'      => $label,
                'is_enabled' => $setting ? $setting->is_enabled : true, // デフォルトON
            ];
        }

        return response()->json(['success' => true, 'data' => ['notifications' => $result]]);
    }

    /** 通知設定を一括更新 */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'settings'          => 'required|array',
            'settings.*.type'   => 'required|string|in:' . implode(',', array_keys(self::NOTIFICATION_TYPES)),
            'settings.*.is_enabled' => 'required|boolean',
        ]);

        $userId = Auth::id();

        foreach ($request->settings as $item) {
            LineNotificationSetting::updateOrCreate(
                ['user_id' => $userId, 'notification_type' => $item['type']],
                ['is_enabled' => $item['is_enabled']]
            );
        }

        return response()->json(['success' => true, 'message' => '通知設定を保存しました']);
    }
}
