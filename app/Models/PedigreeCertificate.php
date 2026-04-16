<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedigreeCertificate extends Model
{
    protected $fillable = [
        'item_id', 'issued_by', 'certificate_number', 'breed_name', 'breed_type',
        'fixation_rate', 'expression', 'parent_male', 'parent_female',
        'lineage', 'breeding_notes', 'status', 'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'parent_male' => 'array',
            'parent_female' => 'array',
            'lineage' => 'array',
            'fixation_rate' => 'decimal:2',
            'issued_at' => 'datetime',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
