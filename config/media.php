<?php

/**
 * 画像最適化配信（OptimizedMediaController / MediaOptimizer / media:warm）の調整値。
 * B-8 (2026-09-08): キャッシュミス時の変換を 1 プロセスに限定するロックの待ち時間。
 */
return [
    // 同じ variant を変換中の他プロセスを待つ秒数。超えたら元画像をそのまま返す（キャッシュはしない）
    'convert_wait_seconds' => (int) env('MEDIA_CONVERT_WAIT_SECONDS', 8),
    // 変換ロックの保持上限（変換が異常に長引いた場合の保険）
    'convert_lock_seconds' => (int) env('MEDIA_CONVERT_LOCK_SECONDS', 20),
];
