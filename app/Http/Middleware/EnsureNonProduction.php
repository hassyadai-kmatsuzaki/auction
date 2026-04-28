<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureNonProduction
 *
 * テストヘルパー (api-test.php) を本番環境で誤って公開してしまうのを防ぐためのミドルウェア。
 *
 * 動作:
 *   - APP_ENV が local / testing / staging のときのみ通過
 *   - それ以外 (= production) のときは 404 で abort し、ルートの存在自体を隠蔽する
 *
 * 重要: 本ミドルウェアは routes/api-test.php 内のすべてのルートに必ず適用すること。
 *       多重防御として bootstrap/app.php 側でも staging/local 環境のときのみ
 *       api-test.php をロードする実装になっている前提。
 */
class EnsureNonProduction
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->environment(['local', 'testing', 'staging'])) {
            abort(404);
        }

        return $next($request);
    }
}
