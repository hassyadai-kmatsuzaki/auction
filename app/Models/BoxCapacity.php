<?php

namespace App\Models;

class BoxCapacity extends BaseModel
{
    protected $table = 'box_capacities';

    protected $fillable = [
        'species_type_id',
        'box_size',
        'bag_size',
        'max_count',
    ];

    protected $casts = [
        'box_size' => 'integer',
        'max_count' => 'integer',
    ];

    public function speciesType()
    {
        return $this->belongsTo(SpeciesType::class);
    }
}
