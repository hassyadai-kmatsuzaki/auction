<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends BaseModel
{
    use HasFactory;

    public const STATUS_PENDING   = 'pending';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED    = 'failed';
    public const STATUS_REFUNDED  = 'refunded';

    protected $fillable = [
        'subscription_id',
        'user_id',
        'plan_id',
        'square_payment_id',
        'square_order_id',
        'idempotency_key',
        'amount',
        'currency',
        'status',
        'failure_reason',
        'receipt_url',
        'paid_at',
        'failed_at',
        'refunded_at',
        'refunded_amount',
        'raw_response',
    ];

    protected $casts = [
        'amount' => 'integer',
        'refunded_amount' => 'integer',
        'paid_at' => 'datetime',
        'failed_at' => 'datetime',
        'refunded_at' => 'datetime',
        'raw_response' => 'array',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
