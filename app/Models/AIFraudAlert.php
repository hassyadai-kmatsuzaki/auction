<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AIFraudAlert extends Model
{
    protected $table = 'ai_fraud_alerts';

    protected $fillable = [
        'auction_id', 'user_id', 'alert_type', 'severity', 'description',
        'evidence', 'status', 'resolution_notes', 'resolved_by', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'evidence' => 'array',
            'resolved_at' => 'datetime',
        ];
    }

    public function auction(): BelongsTo { return $this->belongsTo(Auction::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function resolver(): BelongsTo { return $this->belongsTo(User::class, 'resolved_by'); }
}
