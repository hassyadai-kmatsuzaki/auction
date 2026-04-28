<?php

/*
|--------------------------------------------------------------------------
| Test Helper Routes (api-test.php)
|--------------------------------------------------------------------------
|
| Cypress E2E から呼ばれる「テスト用」ヘルパーエンドポイント群。
|
| ====== !!! 本番環境では絶対にロードされてはいけない !!! ======
|
| 多重防御の方針:
|   (A) bootstrap/app.php 側で APP_ENV in {local, testing, staging} の場合のみ
|       本ファイルを読み込む。詳しくは bootstrap/app.php のコメント参照。
|   (B) このファイル内の全ルートに EnsureNonProduction ミドルウェアを適用し、
|       APP_ENV が 'production' のときは 404 を返す。
|
|   (A) と (B) の双方が独立に効くので、万一どちらかの設定漏れがあっても
|   production にエンドポイントが露出することは無い。
|
| ====== bootstrap/app.php への追記例 (staging のみロード) ======
|
|   ->withRouting(
|       web:      __DIR__.'/../routes/web.php',
|       api:      __DIR__.'/../routes/api.php',
|       commands: __DIR__.'/../routes/console.php',
|       health:   '/up',
|       then: function () {
|           if (app()->environment(['local', 'testing', 'staging'])) {
|               Route::middleware('api')
|                    ->prefix('api')
|                    ->group(__DIR__.'/../routes/api-test.php');
|           }
|       }
|   )
|
| ※ 本番デプロイ時に APP_ENV=production になっていれば本ファイルは
|    決して include されない。仮に誤って include されても (B) の
|    ミドルウェアで 404 になる。
|
*/

use App\Http\Controllers\TestHelpers\SeedController;
use App\Http\Middleware\EnsureNonProduction;
use Illuminate\Support\Facades\Route;

Route::middleware([EnsureNonProduction::class])
    ->prefix('test-helpers')
    ->group(function () {
        // データシード (WonItem)
        Route::post('/seed-won-item', [SeedController::class, 'seedWonItem']);

        // データシード (Auction)
        Route::post('/seed-auction', [SeedController::class, 'seedAuction']);

        // schedule:run / 任意の artisan command
        Route::post('/run-schedule', [SeedController::class, 'runSchedule']);

        // LINE 通知履歴
        Route::get('/line-sent', [SeedController::class, 'lineSent']);
    });
