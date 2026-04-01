<?php

namespace App\Models;

class PackingMaterial extends BaseModel
{
    public $timestamps = false;

    protected $fillable = ['box_size', 'styrofoam_cost', 'bag_material_cost', 'coolant_cost', 'updated_at'];

    protected $casts = [
        'updated_at' => 'datetime',
    ];

    protected $appends = ['total_cost'];

    public function getTotalCostAttribute(): int
    {
        return ($this->styrofoam_cost ?? 0) + ($this->bag_material_cost ?? 0) + ($this->coolant_cost ?? 0);
    }
}
