<?php

namespace App\Models;

class BagSpec extends BaseModel
{
    protected $fillable = ['species_type_id', 'bag_size', 'model', 'min_qty', 'max_qty', 'weight_kg', 'pack_unit'];

    protected $casts = [
        'weight_kg' => 'decimal:1',
        'min_qty' => 'integer',
        'max_qty' => 'integer',
        'pack_unit' => 'integer',
    ];

    public function speciesType()
    {
        return $this->belongsTo(SpeciesType::class);
    }
}
