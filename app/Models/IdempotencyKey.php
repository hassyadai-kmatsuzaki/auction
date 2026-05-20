<?php

namespace App\Models;

class IdempotencyKey extends BaseModel
{
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED  = 'completed';

    protected $table = 'idempotency_keys';

    public $timestamps = false;

    protected $fillable = [
        'scope',
        'idempotency_key',
        'request_hash',
        'status',
        'response_status',
        'response_body',
        'created_at',
        'completed_at',
    ];

    protected $casts = [
        'response_body' => 'array',
        'created_at'    => 'datetime',
        'completed_at'  => 'datetime',
    ];
}
