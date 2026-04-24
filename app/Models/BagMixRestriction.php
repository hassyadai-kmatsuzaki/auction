<?php

namespace App\Models;

class BagMixRestriction extends BaseModel
{
    protected $fillable = [
        'species_type_id',
        'box_size',
        'bag_size_a',
        'bag_size_b',
    ];

    protected $casts = [
        'box_size' => 'integer',
    ];

    public function speciesType()
    {
        return $this->belongsTo(SpeciesType::class);
    }
}
