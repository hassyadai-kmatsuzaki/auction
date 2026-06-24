<?php

namespace App\Models;

/**
 * 品種名（生体名 = items.species_name）の候補マスタ。
 * 出品申込フォームの入力補助（変換候補）に使う。items.species_name は自由テキストのまま。
 */
class SpeciesName extends BaseModel
{
    protected $fillable = [
        'name',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];
}
