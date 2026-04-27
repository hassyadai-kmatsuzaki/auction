<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EscrowTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'won_item_id',
        'buyer_id',
        'seller_id',
        'amount',
        'status',
        'paid_at',
        'released_at',
        'refunded_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'paid_at' => 'datetime',
            'released_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    public function wonItem(): BelongsTo
    {
        return $this->belongsTo(WonItem::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }
}
