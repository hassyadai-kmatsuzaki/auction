<?php

namespace App\Models;

class ShippingRate extends BaseModel
{
    public $timestamps = false;

    protected $fillable = ['region', 'box_size', 'rate', 'updated_at'];

    protected $casts = [
        'updated_at' => 'datetime',
    ];
}
