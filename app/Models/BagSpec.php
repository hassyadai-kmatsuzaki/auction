<?php

namespace App\Models;

class BagSpec extends BaseModel
{
    protected $fillable = ['bag_size', 'model', 'min_qty', 'max_qty', 'weight_kg'];

    protected $casts = [
        'weight_kg' => 'decimal:1',
    ];
}
