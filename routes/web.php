<?php

use Illuminate\Support\Facades\Route;

// 公開準備中ページ（LP / 法務関連を Coming Soon に差し向ける）
$comingSoon = function () {
    return response()
        ->view('coming-soon')
        ->header('X-Robots-Tag', 'noindex, nofollow');
};
Route::get('/', $comingSoon);
Route::get('/legal/tokushoho', $comingSoon);
Route::get('/legal/privacy', $comingSoon);
Route::get('/legal/terms', $comingSoon);

// React SPAのルートとして全てのルートをapp.blade.phpに向ける（API パスとルートを除外）
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api/).+');
