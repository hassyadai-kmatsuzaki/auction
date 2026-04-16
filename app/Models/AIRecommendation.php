<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AIRecommendation extends Model
{
    protected $fillable = [
        'user_id', 'item_id', 'score', 'reason', 'source', 'was_viewed', 'was_bid',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:4',
            'was_viewed' => 'boolean',
            'was_bid' => 'boolean',
        ];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function item(): BelongsTo { return $this->belongsTo(Item::class); }
}
