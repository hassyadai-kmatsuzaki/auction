<?php

namespace App\Console\Commands;

use App\Services\GmoAozora\GmoAozoraOAuthService;
use Illuminate\Console\Command;

/**
 * GMOあおぞら OAuth の認可 URL を発行する（CLI から接続試験を始める用）。
 *
 *   sudo -u ec2-user php artisan gmo-aozora:auth-url
 *
 * 表示された URL をブラウザで開き、口座保有者がログイン・認可すると
 * redirect_uri（/api/gmo-aozora/oauth/callback）でトークンが保存される。state は10分有効。
 */
class GmoAozoraAuthUrlCommand extends Command
{
    protected $signature = 'gmo-aozora:auth-url';
    protected $description = 'GMOあおぞら OAuth 認可 URL を発行する';

    public function handle(GmoAozoraOAuthService $oauth): int
    {
        if (!$oauth->isConfigured()) {
            $this->error('GMO_AOZORA_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI が未設定です。');
            return self::FAILURE;
        }
        $auth = $oauth->buildAuthorizationUrl();
        $this->line('環境: ' . $oauth->environment());
        $this->line('scope: ' . $oauth->scopes());
        $this->line('redirect_uri: ' . $oauth->redirectUri());
        $this->newLine();
        $this->info('次の URL をブラウザで開いて認可してください（10分以内）:');
        $this->line($auth['url']);
        return self::SUCCESS;
    }
}
