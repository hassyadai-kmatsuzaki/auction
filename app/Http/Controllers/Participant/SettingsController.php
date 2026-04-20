<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    /**
     * 設定情報を取得
     */
    public function index()
    {
        $user = Auth::user();

        return response()->json([
            'success' => true,
            'data' => [
                'profile' => [
                    'name' => $user->name,
                    'trade_name' => $user->trade_name,
                    'company_name' => $user->company_name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'postal_code' => $user->postal_code,
                    'prefecture' => $user->prefecture,
                    'city' => $user->city,
                    'address_line1' => $user->address_line1,
                    'address_line2' => $user->address_line2,
                    'profile_image_path' => $user->profile_image_path,
                    'profile_image_url' => $user->profile_image_url,
                ],
                'notification_settings' => $user->notification_settings,
            ],
        ]);
    }

    /**
     * プロフィール更新
     */
    public function updateProfile(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'trade_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'postal_code' => 'nullable|string|max:10',
            'prefecture' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $user->update($request->only([
            'name',
            'trade_name',
            'company_name',
            'phone',
            'postal_code',
            'prefecture',
            'city',
            'address_line1',
            'address_line2',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'プロフィールを更新しました。',
            'data' => [
                'profile' => [
                    'name' => $user->name,
                    'trade_name' => $user->trade_name,
                    'company_name' => $user->company_name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'postal_code' => $user->postal_code,
                    'prefecture' => $user->prefecture,
                    'city' => $user->city,
                    'address_line1' => $user->address_line1,
                    'address_line2' => $user->address_line2,
                    'profile_image_path' => $user->profile_image_path,
                    'profile_image_url' => $user->profile_image_url,
                ],
            ],
        ]);
    }

    /**
     * プロフィール画像アップロード
     */
    public function uploadProfileImage(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($user->profile_image_path) {
            Storage::disk('public')->delete($user->profile_image_path);
        }

        $file = $request->file('image');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs("avatars/user/{$user->id}", $filename, 'public');

        $user->profile_image_path = $path;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'プロフィール画像をアップロードしました。',
            'data' => [
                'profile_image_path' => $user->profile_image_path,
                'profile_image_url' => $user->profile_image_url,
            ],
        ]);
    }

    /**
     * プロフィール画像削除
     */
    public function deleteProfileImage()
    {
        $user = Auth::user();

        if ($user->profile_image_path) {
            Storage::disk('public')->delete($user->profile_image_path);
            $user->profile_image_path = null;
            $user->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'プロフィール画像を削除しました。',
        ]);
    }

    /**
     * 通知設定を更新
     */
    public function updateNotificationSettings(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'email_won_item' => 'boolean',
            'email_payment_confirmed' => 'boolean',
            'email_shipping' => 'boolean',
            'email_new_auction' => 'boolean',
            'email_auction_start' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $currentSettings = $user->notification_settings ?? [];
        $newSettings = array_merge($currentSettings, $request->only([
            'email_won_item',
            'email_payment_confirmed',
            'email_shipping',
            'email_new_auction',
            'email_auction_start',
        ]));

        $user->notification_settings = $newSettings;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => '通知設定を更新しました。',
            'data' => [
                'notification_settings' => $user->notification_settings,
            ],
        ]);
    }
}
