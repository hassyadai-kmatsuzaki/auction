<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Favorite extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'item_id',
    ];

    /**
     * ユーザーとのリレーション
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * 商品とのリレーション
     */
    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
