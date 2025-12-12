<?php

use Illuminate\Support\Facades\Route;

// React SPAのルートとして全てのルートをapp.blade.phpに向ける
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
