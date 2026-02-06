<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * 全モデル共通の基底クラス
 * 
 * JSONシリアライズ時にタイムゾーン情報(Z)を含めず、
 * ローカルタイム（Asia/Tokyo）のフォーマットで返す。
 * これにより、フロントエンドでのUTC→JST二重変換問題を防止する。
 */
class BaseModel extends Model
{
    /**
     * JSONシリアライズ時にタイムゾーン情報を含めない
     */
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s');
    }
}
