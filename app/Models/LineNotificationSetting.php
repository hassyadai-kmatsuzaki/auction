<?php

namespace App\Models;

class LineNotificationSetting extends BaseModel
{
    protected $fillable = ['user_id', 'notification_type', 'is_enabled'];

    protected $casts = ['is_enabled' => 'boolean'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** 指定ユーザー・指定通知タイプが有効かどうか */
    public static function isEnabled(int $userId, string $type): bool
    {
        $setting = static::where('user_id', $userId)->where('notification_type', $type)->first();
        return $setting ? $setting->is_enabled : true; // デフォルトON
    }
}
