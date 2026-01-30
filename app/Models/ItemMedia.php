<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ItemMedia extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'item_media';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'item_id',
        'media_type',
        'file_path',
        'file_name',
        'file_size',
        'mime_type',
        'duration',
        'width',
        'height',
        'display_order',
        'is_thumbnail',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'duration' => 'integer',
        'file_size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'display_order' => 'integer',
        'is_thumbnail' => 'boolean',
    ];

    /**
     * 商品とのリレーション
     */
    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
