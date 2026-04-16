<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AIPricePrediction extends Model
{
    protected $table = 'ai_price_predictions';

    protected $fillable = [
        'item_id', 'species_name', 'predicted_price', 'price_low', 'price_high',
        'confidence', 'factors', 'actual_price', 'model_version',
    ];

    protected function casts(): array
    {
        return [
            'factors' => 'array',
            'predicted_price' => 'integer',
            'price_low' => 'integer',
            'price_high' => 'integer',
            'actual_price' => 'integer',
            'confidence' => 'decimal:2',
        ];
    }

    public function item(): BelongsTo { return $this->belongsTo(Item::class); }
}
