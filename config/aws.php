<?php

return [
    'region' => env('AWS_DEFAULT_REGION', 'ap-northeast-1'),

    // スケーリング対象のEC2インスタンスID
    'ec2_instance_id' => env('AWS_EC2_INSTANCE_ID'),

    // インスタンスタイプ定義（モード判定に使用）
    'normal_instance_type'  => env('AWS_NORMAL_INSTANCE_TYPE', 't3.small'),
    'auction_instance_type' => env('AWS_AUCTION_INSTANCE_TYPE', 'c6i.2xlarge'),

    // Lambda関数名（スケーリング実行用）
    'lambda_scale_up'   => env('AWS_LAMBDA_SCALE_UP'),
    'lambda_scale_down' => env('AWS_LAMBDA_SCALE_DOWN'),
];
