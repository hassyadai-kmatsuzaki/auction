<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\SellerProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProfileController extends Controller
{
    /**
     * 出品者プロフィール取得
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request)
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            // プロフィールがない場合は新規作成
            $profile = SellerProfile::create([
                'user_id' => $user->id,
                'seller_code' => 'S' . str_pad((SellerProfile::max('id') ?? 0) + 1, 6, '0', STR_PAD_LEFT),
                'seller_name' => $user->name,
                'business_registration_number' => $user->business_registration_number,
                'contact_name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone ?? '',
                'postal_code' => $user->postal_code,
                'prefecture' => $user->prefecture,
                'city' => $user->city,
                'address_line1' => $user->address_line1,
                'address_line2' => $user->address_line2,
                'is_active' => true,
                'notification_settings' => [
                    'email_new_auction' => true,
                    'email_item_sold' => true,
                    'email_shipping_reminder' => true,
                ],
                'display_settings' => [
                    'show_sns' => true,
                    'show_sales_channels' => true,
                    'show_event_history' => true,
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'profile' => $profile->getWithBankInfo(),
            ],
        ]);
    }

    /**
     * 出品者プロフィール更新
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request)
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => 'プロフィールが見つかりません。',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            // 基本情報
            'seller_name' => 'required|string|max:255',
            'corporate_name' => 'nullable|string|max:255',
            'business_type' => 'nullable|string|max:50',
            'business_registration_number' => 'nullable|string|max:50',
            'contact_name' => 'required|string|max:255',
            
            // 連絡先
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:20',
            'postal_code' => 'nullable|string|max:10',
            'prefecture' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            
            // SNS・Web
            'instagram' => 'nullable|string|max:100',
            'twitter' => 'nullable|string|max:100',
            'youtube' => 'nullable|string|max:255',
            'website' => 'nullable|url|max:255',
            'other_sns' => 'nullable|string|max:255',
            
            // 任意情報
            'sales_channels' => 'nullable|string',
            'event_history' => 'nullable|string',
            'event_hosting' => 'nullable|string',
            'shop_address' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $profile->update($request->only([
            'seller_name',
            'corporate_name',
            'business_type',
            'business_registration_number',
            'contact_name',
            'email',
            'phone',
            'postal_code',
            'prefecture',
            'city',
            'address_line1',
            'address_line2',
            'instagram',
            'twitter',
            'youtube',
            'website',
            'other_sns',
            'sales_channels',
            'event_history',
            'event_hosting',
            'shop_address',
            'notes',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'プロフィールを更新しました。',
            'data' => [
                'profile' => $profile->getWithBankInfo(),
            ],
        ]);
    }

    /**
     * 口座情報更新
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateBankAccount(Request $request)
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => 'プロフィールが見つかりません。',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'bank_name' => 'required|string|max:100',
            'bank_branch' => 'required|string|max:100',
            'account_type' => 'required|in:checking,savings',
            'account_number' => 'required|string|max:20',
            'account_holder' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $profile->update($request->only([
            'bank_name',
            'bank_branch',
            'account_type',
            'account_number',
            'account_holder',
        ]));

        return response()->json([
            'success' => true,
            'message' => '口座情報を更新しました。',
            'data' => [
                'bank_info' => [
                    'bank_name' => $profile->bank_name,
                    'bank_branch' => $profile->bank_branch,
                    'account_type' => $profile->account_type,
                    'account_number' => $profile->account_number,
                    'account_holder' => $profile->account_holder,
                ],
            ],
        ]);
    }

    /**
     * プロフィール画像アップロード
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadProfileImage(Request $request)
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => 'プロフィールが見つかりません。',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($profile->profile_image_path) {
            Storage::disk('public')->delete($profile->profile_image_path);
        }

        $file = $request->file('image');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs("avatars/seller/{$profile->id}", $filename, 'public');

        $profile->profile_image_path = $path;
        $profile->save();

        return response()->json([
            'success' => true,
            'message' => 'プロフィール画像をアップロードしました。',
            'data' => [
                'profile_image_path' => $profile->profile_image_path,
                'profile_image_url' => $profile->profile_image_url,
            ],
        ]);
    }

    /**
     * プロフィール画像削除
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteProfileImage()
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => 'プロフィールが見つかりません。',
            ], 404);
        }

        if ($profile->profile_image_path) {
            Storage::disk('public')->delete($profile->profile_image_path);
            $profile->profile_image_path = null;
            $profile->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'プロフィール画像を削除しました。',
        ]);
    }

    /**
     * 通知設定更新
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateNotificationSettings(Request $request)
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => 'プロフィールが見つかりません。',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'email_new_auction' => 'boolean',
            'email_item_sold' => 'boolean',
            'email_shipping_reminder' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $currentSettings = $profile->notification_settings ?? [];
        $newSettings = array_merge($currentSettings, $request->only([
            'email_new_auction',
            'email_item_sold',
            'email_shipping_reminder',
        ]));

        $profile->notification_settings = $newSettings;
        $profile->save();

        return response()->json([
            'success' => true,
            'message' => '通知設定を更新しました。',
            'data' => [
                'notification_settings' => $profile->notification_settings,
            ],
        ]);
    }

    /**
     * 表示設定更新
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateDisplaySettings(Request $request)
    {
        $user = Auth::user();
        $profile = SellerProfile::where('user_id', $user->id)->first();

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => 'プロフィールが見つかりません。',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'show_sns' => 'boolean',
            'show_sales_channels' => 'boolean',
            'show_event_history' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $currentSettings = $profile->display_settings ?? [];
        $newSettings = array_merge($currentSettings, $request->only([
            'show_sns',
            'show_sales_channels',
            'show_event_history',
        ]));

        $profile->display_settings = $newSettings;
        $profile->save();

        return response()->json([
            'success' => true,
            'message' => '表示設定を更新しました。',
            'data' => [
                'display_settings' => $profile->display_settings,
            ],
        ]);
    }
}
