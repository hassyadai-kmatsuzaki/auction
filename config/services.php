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
        // SES Configuration Set 名。設定するとバウンス/苦情イベントが SNS 経由で受け取れる。
        'configuration_set' => env('AWS_SES_CONFIGURATION_SET'),
        // バルク送信時の最大 TPS。SES アカウントの送信レート上限に合わせて設定
        'send_rate_per_second' => (int) env('AWS_SES_SEND_RATE_PER_SECOND', 14),
        // SNS 経由でバウンス/苦情通知を受ける Topic ARN（Webhook 側で許可リスト照合に使用）
        'sns_topic_arns' => array_values(array_filter([
            env('SES_SNS_TOPIC_ARN_BOUNCE'),
            env('SES_SNS_TOPIC_ARN_COMPLAINT'),
        ])),
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

    'ffmpeg' => [
        'bin' => env('FFMPEG_BIN', '/usr/local/bin/ffmpeg'),
    ],

    'square' => [
        'environment'        => env('SQUARE_ENVIRONMENT', 'sandbox'),
        'access_token'       => env('SQUARE_ACCESS_TOKEN', ''),
        'application_id'     => env('SQUARE_APPLICATION_ID', ''),
        'location_id'        => env('SQUARE_LOCATION_ID', ''),
        'webhook_signature_key' => env('SQUARE_WEBHOOK_SIGNATURE_KEY', ''),
        'webhook_url'        => env('SQUARE_WEBHOOK_URL', ''),
        'currency'           => env('SQUARE_CURRENCY', 'JPY'),
        'api_version'        => env('SQUARE_API_VERSION', '2024-10-17'),
    ],

];
