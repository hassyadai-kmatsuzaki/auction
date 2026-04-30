<?php

use App\Http\Controllers\UnsubscribeController;
use App\Http\Controllers\Webhook\SesEventController;
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

// 配信停止リンク。catch-all より先に登録する必要あり。
Route::get('/unsubscribe/{token}', [UnsubscribeController::class, 'show'])
    ->where('token', '[A-Za-z0-9]{32,64}')
    ->name('unsubscribe.show');

// SES → SNS Webhook。CSRF ミドルウェアは VerifyCsrfToken の except 設定で除外する。
Route::post('/webhooks/ses/bounce', [SesEventController::class, 'bounce'])->name('webhook.ses.bounce');
Route::post('/webhooks/ses/complaint', [SesEventController::class, 'complaint'])->name('webhook.ses.complaint');

// React SPAのルートとして全てのルートをapp.blade.phpに向ける（API パスとルートを除外）
Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api/).+');
