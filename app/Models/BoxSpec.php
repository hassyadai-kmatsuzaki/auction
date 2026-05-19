<?php

namespace App\Models;

class BoxSpec extends BaseModel
{
    protected $fillable = [
        'box_size', 'max_weight_kg', 'max_s', 'max_m', 'max_l', 'max_ll',
        'unit_capacity', 'allow_single_l_override',
    ];

    protected $casts = [
        'unit_capacity' => 'integer',
        'allow_single_l_override' => 'boolean',
    ];
}
