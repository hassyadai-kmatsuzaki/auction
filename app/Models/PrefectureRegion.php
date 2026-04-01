<?php

namespace App\Models;

class PrefectureRegion extends BaseModel
{
    public $timestamps = false;

    protected $fillable = ['prefecture', 'region'];
}
