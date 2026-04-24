<?php

namespace App\Models;

class SpeciesType extends BaseModel
{
    public const MODE_AUTO = 'auto';
    public const MODE_MANUAL = 'manual';

    public const UNIT_FISH = 'fish';
    public const UNIT_KG = 'kg';
    public const UNIT_BAG = 'bag';

    protected $fillable = [
        'code',
        'name',
        'calculation_mode',
        'is_mixable',
        'is_default',
        'allowed_quantity_units',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_mixable' => 'boolean',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'allowed_quantity_units' => 'array',
    ];

    public function bagSpecs()
    {
        return $this->hasMany(BagSpec::class);
    }

    public function boxCapacities()
    {
        return $this->hasMany(BoxCapacity::class);
    }

    public function bagMixRestrictions()
    {
        return $this->hasMany(BagMixRestriction::class);
    }

    public function items()
    {
        return $this->hasMany(Item::class);
    }

    public function isAuto(): bool
    {
        return $this->calculation_mode === self::MODE_AUTO;
    }

    public function isManual(): bool
    {
        return $this->calculation_mode === self::MODE_MANUAL;
    }

    public function allowsQuantityUnit(string $unit): bool
    {
        $allowed = $this->allowed_quantity_units ?? [self::UNIT_FISH];
        return in_array($unit, $allowed, true);
    }
}
