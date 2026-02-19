<?php

namespace App\Models;

class LineNotificationLog extends BaseModel
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'notification_type', 'line_user_id',
        'message_payload', 'status', 'error_message', 'sent_at', 'created_at',
    ];

    protected $casts = [
        'message_payload' => 'array',
        'sent_at'         => 'datetime',
        'created_at'      => 'datetime',
    ];

    protected $hidden = ['line_user_id', 'message_payload'];
}
