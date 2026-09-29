<?php

namespace App\Services\GmoAozora;

use App\Models\GmoAozoraToken;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * GMOあおぞら OAuth 2.0（Authorization Code / client_secret_basic）。
 *
 * 仕様: オープンAPI仕様書 認可編（OAuth2.0）v1.8.0
 *  - 認可:   GET  {auth}/authorization?response_type=code&scope&client_id&state&redirect_uri
 *  - 発行:   POST {auth}/token  grant_type=authorization_code&code&redirect_uri（Basic: client_id:client_secret）
 *  - 再発行: POST {auth}/token  grant_type=refresh_token&refresh_token
 *
 * 自社法人口座を1回だけ認可し、以後はリフレッシュで維持する。
 * アクセストークンが失効すると入金明細通知（Webhook）も止まり、失効中の明細は再送されない。
 */
class GmoAozoraOAuthService
{
    private const STATE_CACHE_PREFIX = 'gmo_aozora:oauth_state:';
    private const STATE_TTL_SECONDS  = 600;

    public function environment(): string
    {
        return (string) config('services.gmo_aozora.environment', 'development');
    }

    public function isProduction(): bool
    {
        return $this->environment() === 'production';
    }

    public function isConfigured(): bool
    {
        return $this->clientId() !== '' && $this->clientSecret() !== '' && $this->redirectUri() !== '';
    }

    public function clientId(): string
    {
        return (string) config('services.gmo_aozora.client_id', '');
    }

    public function clientSecret(): string
    {
        return (string) config('services.gmo_aozora.client_secret', '');
    }

    public function redirectUri(): string
    {
        return (string) config('services.gmo_aozora.redirect_uri', '');
    }

    public function scopes(): string
    {
        return trim((string) config('services.gmo_aozora.scopes', ''));
    }

    public function authBaseUrl(): string
    {
        return $this->isProduction()
            ? 'https://api.gmo-aozora.com/ganb/api/auth/v1'
            : 'https://stg-api.gmo-aozora.com/ganb/api/auth/v1';
    }

    // ------------------------------------------------------------------
    // 認可 URL / state
    // ------------------------------------------------------------------

    /**
     * 認可 URL を生成し、state を10分間キャッシュに保持する。
     *
     * @return array{url:string, state:string}
     */
    public function buildAuthorizationUrl(): array
    {
        $state = Str::random(40);
        Cache::put(self::STATE_CACHE_PREFIX . $state, ['created_at' => now()->toIso8601String()], self::STATE_TTL_SECONDS);

        $query = http_build_query([
            'response_type' => 'code',
            'scope'         => $this->scopes(),
            'client_id'     => $this->clientId(),
            'state'         => $state,
            'redirect_uri'  => $this->redirectUri(),
        ], '', '&', PHP_QUERY_RFC3986);

        return [
            'url'   => $this->authBaseUrl() . '/authorization?' . $query,
            'state' => $state,
        ];
    }

    /**
     * コールバックで受け取った state を検証して消費する（1回限り）。
     */
    public function consumeState(string $state): bool
    {
        if ($state === '') {
            return false;
        }
        $key = self::STATE_CACHE_PREFIX . $state;
        if (!Cache::has($key)) {
            return false;
        }
        Cache::forget($key);
        return true;
    }

    // ------------------------------------------------------------------
    // トークン取得・更新
    // ------------------------------------------------------------------

    /**
     * 認可コードをアクセストークンに交換して保存する。
     */
    public function exchangeAuthorizationCode(string $code): GmoAozoraToken
    {
        $response = Http::asForm()
            ->withBasicAuth($this->clientId(), $this->clientSecret())
            ->acceptJson()
            ->timeout(30)
            ->post($this->authBaseUrl() . '/token', [
                'grant_type'   => 'authorization_code',
                'code'         => $code,
                'redirect_uri' => $this->redirectUri(),
            ]);

        $data = $this->ensureTokenResponse($response, 'exchangeAuthorizationCode');

        $token = GmoAozoraToken::updateOrCreate(
            ['environment' => $this->environment()],
            [
                'access_token'  => $data['access_token'],
                'refresh_token' => $data['refresh_token'],
                'scope'         => $data['scope'] ?? $this->scopes(),
                'token_type'    => $data['token_type'] ?? 'Bearer',
                'expires_at'    => Carbon::now()->addSeconds((int) ($data['expires_in'] ?? 0)),
                'authorized_at' => now(),
                'refreshed_at'  => null,
                'last_error'    => null,
            ]
        );

        Log::channel('audit')->info('GMO_AOZORA_AUTHORIZED', [
            'environment' => $token->environment,
            'scope'       => $token->scope,
            'expires_at'  => $token->expires_at?->toIso8601String(),
        ]);

        return $token;
    }

    /**
     * リフレッシュトークンでアクセストークンを更新して保存する。
     */
    public function refresh(?GmoAozoraToken $token = null): GmoAozoraToken
    {
        $token ??= $this->token();
        if (!$token) {
            throw new GmoAozoraApiException('GMOあおぞらのトークンが未取得です。先に認可を行ってください。', 0, null, [], 'refresh');
        }

        $response = Http::asForm()
            ->withBasicAuth($this->clientId(), $this->clientSecret())
            ->acceptJson()
            ->timeout(30)
            ->post($this->authBaseUrl() . '/token', [
                'grant_type'    => 'refresh_token',
                'refresh_token' => $token->refresh_token,
            ]);

        try {
            $data = $this->ensureTokenResponse($response, 'refresh');
        } catch (GmoAozoraApiException $e) {
            $token->forceFill(['last_error' => $e->getMessage()])->save();
            throw $e;
        }

        $token->forceFill([
            'access_token'  => $data['access_token'],
            // 仕様上は毎回 refresh_token も返るが、欠けていた場合は現行値を維持
            'refresh_token' => $data['refresh_token'] ?? $token->refresh_token,
            'scope'         => $data['scope'] ?? $token->scope,
            'expires_at'    => Carbon::now()->addSeconds((int) ($data['expires_in'] ?? 0)),
            'refreshed_at'  => now(),
            'last_error'    => null,
        ])->save();

        Log::info('GMO Aozora token refreshed', [
            'environment' => $token->environment,
            'expires_at'  => $token->expires_at?->toIso8601String(),
        ]);

        return $token;
    }

    /**
     * 保存済みトークン（現在の環境）。
     */
    public function token(): ?GmoAozoraToken
    {
        return GmoAozoraToken::where('environment', $this->environment())->first();
    }

    /**
     * API 呼び出しに使える access_token を返す。失効間近なら先にリフレッシュする。
     */
    public function accessToken(bool $forceRefresh = false): string
    {
        $token = $this->token();
        if (!$token) {
            throw new GmoAozoraApiException('GMOあおぞらのトークンが未取得です。先に認可を行ってください。', 0, null, [], 'accessToken');
        }

        $days = (int) config('services.gmo_aozora.refresh_before_days', 7);
        if ($forceRefresh || $token->isExpired() || $token->expiresWithin($days)) {
            $token = $this->refresh($token);
        }

        return $token->access_token;
    }

    /**
     * @return array{access_token:string, refresh_token?:string, scope?:string, token_type?:string, expires_in?:int}
     */
    private function ensureTokenResponse(\Illuminate\Http\Client\Response $response, string $context): array
    {
        $data = $response->json() ?? [];

        if ($response->failed() || empty($data['access_token'])) {
            $error = $data['error'] ?? null;
            $desc  = $data['error_description'] ?? $response->body();
            Log::error('GMO Aozora token endpoint error', [
                'context' => $context,
                'status'  => $response->status(),
                'error'   => $error,
                'error_description' => $desc,
            ]);
            throw new GmoAozoraApiException(
                sprintf('トークン取得に失敗しました (%s): %s', $error ?? 'http_' . $response->status(), is_string($desc) ? $desc : json_encode($desc)),
                $response->status(),
                is_string($error) ? $error : null,
                is_array($data) ? $data : [],
                $context
            );
        }

        return $data;
    }
}
