<?php

namespace App\Models;

class LineAccount extends BaseModel
{
    protected $fillable = [
        'user_id', 'line_user_id', 'display_name', 'picture_url', 'is_active', 'linked_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'linked_at' => 'datetime',
    ];

    protected $hidden = ['line_user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
