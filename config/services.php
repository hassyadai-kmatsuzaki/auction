<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'yamato' => [
        'api_key' => env('YAMATO_API_KEY'),
        'api_url' => env('YAMATO_API_URL', 'https://api.kuronekoyamato.co.jp/api/v1'),
    ],

    'sagawa' => [
        'api_key' => env('SAGAWA_API_KEY'),
        'api_url' => env('SAGAWA_API_URL', 'https://api.sagawa-exp.co.jp/api/v1'),
    ],

    'line' => [
        'login_channel_id'     => env('LINE_LOGIN_CHANNEL_ID', ''),
        'login_channel_secret' => env('LINE_LOGIN_CHANNEL_SECRET', ''),
        'login_redirect_uri'   => env('LINE_LOGIN_REDIRECT_URI', ''),
        'messaging_token'      => env('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN', ''),
    ],

];
