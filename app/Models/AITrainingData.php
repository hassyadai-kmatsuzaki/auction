<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * AI 学習用データ（F-051）
 *
 * data_type:
 *   - price: 出品条件（features）と落札結果（labels）。価格予測モデルの学習用
 *   - image: 画像と AI 解析結果（features）、出品者申告の品種・落札結果（labels）。画像モデルの学習用
 */
class AITrainingData extends Model
{
    public const TYPE_PRICE = 'price';
    public const TYPE_IMAGE = 'image';

    protected $table = 'ai_training_data';

    protected $fillable = [
        'data_type',
        'item_id',
        'features',
        'labels',
        'is_validated',
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array',
            'labels' => 'array',
            'is_validated' => 'boolean',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
