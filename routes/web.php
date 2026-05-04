<?php

use App\Http\Controllers\ContactController;
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

// LP（業者向けオンラインオークション）— 公開前のため noindex 必須。
$noindexLp = function (string $view) {
    return response()
        ->view($view)
        ->header('X-Robots-Tag', 'noindex, nofollow');
};
Route::get('/buyer', fn () => $noindexLp('lp-buyer'));
Route::get('/seller', fn () => $noindexLp('lp-seller'));

// LP の問い合わせフォーム送信。スパム抑止のためレートリミットを併用。
Route::post('/contact', [ContactController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('contact.store');

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
