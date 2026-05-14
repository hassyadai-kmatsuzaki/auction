<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Throwable;

class LpCvrSetting extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'lp_type',
        'rid',
        'cta_url',
        'note',
    ];

    public const LP_TYPES = ['buyer', 'seller'];

    public const FAILSAFE_CTA_URL = 'https://liff.line.me/2009178950-3kyQfbZq?route=add&source=FWUbEVcD';

    /**
     * LP の CTA URL を解決する。
     *
     * 解決順:
     *   1. rid が指定されていて lp_cvr_settings に一致行があればその cta_url
     *   2. system_settings の lp_default_cta_{type} に値があればそれ
     *   3. ハードコードのフェイルセーフ値
     *
     * いかなる例外（テーブル未作成・DB障害等）でも LP が落ちないよう、
     * Throwable を捕捉してフェイルセーフ値に倒す。
     */
    public static function resolveCtaUrl(string $lpType, ?string $rid): string
    {
        try {
            if ($rid !== null && $rid !== '') {
                $row = static::where('lp_type', $lpType)->where('rid', $rid)->first();
                if ($row && $row->cta_url !== '') {
                    return $row->cta_url;
                }
            }

            $default = SystemSetting::get('lp_default_cta_' . $lpType);
            if (is_string($default) && $default !== '') {
                return $default;
            }
        } catch (Throwable $e) {
            // テーブル未作成等の場合はフェイルセーフへ倒す
        }

        return self::FAILSAFE_CTA_URL;
    }
}
