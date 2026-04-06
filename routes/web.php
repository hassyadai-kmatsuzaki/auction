<?php

use Illuminate\Support\Facades\Route;

// LP（トップページ）
Route::get('/', function () {
    return view('lp');
});

// React SPAのルートとして全てのルートをapp.blade.phpに向ける（API パスとルートを除外）
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api/).*');
