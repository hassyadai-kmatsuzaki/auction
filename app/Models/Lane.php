<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lane extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'auction_id',
        'lane_number',
        'lane_name',
        'current_item_id',
        'status',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'lane_number' => 'integer',
    ];

    /**
     * オークションとのリレーション
     */
    public function auction()
    {
        return $this->belongsTo(Auction::class);
    }

    /**
     * 現在の商品とのリレーション
     */
    public function currentItem()
    {
        return $this->belongsTo(Item::class, 'current_item_id');
    }

    /**
     * レーンに割り当てられた商品とのリレーション
     */
    public function items()
    {
        return $this->belongsToMany(Item::class, 'lane_items')
                    ->withPivot(['sequence_order', 'started_at', 'finished_at'])
                    ->withTimestamps()
                    ->orderBy('lane_items.sequence_order');
    }
}
