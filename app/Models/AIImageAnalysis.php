<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AIImageAnalysis extends Model
{
    protected $table = 'ai_image_analyses';

    protected $fillable = [
        'item_id', 'item_media_id', 'body_shape_features', 'color_features',
        'pattern_features', 'quality_score', 'predicted_breed', 'breed_confidence',
        'raw_response', 'model_version',
    ];

    protected function casts(): array
    {
        return [
            'body_shape_features' => 'array',
            'color_features' => 'array',
            'pattern_features' => 'array',
            'quality_score' => 'decimal:2',
            'breed_confidence' => 'decimal:2',
            'raw_response' => 'array',
        ];
    }

    public function item(): BelongsTo { return $this->belongsTo(Item::class); }
    public function media(): BelongsTo { return $this->belongsTo(ItemMedia::class, 'item_media_id'); }
}
