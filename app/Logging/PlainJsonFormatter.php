<?php

namespace App\Logging;

use Monolog\Formatter\LineFormatter;
use Monolog\LogRecord;

/**
 * Alerts チャネル用のフォーマッタ。
 * MetricRecorder が既に JSON 化した文字列をメッセージとして渡してくるので、
 * そのまま1行=1JSONで出力する（Monolog デフォルトの `[時刻] env.level: message {ctx}` を避ける）。
 *
 * CloudWatch は1行ごとのJSONを自動でパースし、EMFメトリクスを抽出する。
 */
class PlainJsonFormatter
{
    public function __invoke($logger): void
    {
        foreach ($logger->getHandlers() as $handler) {
            if (method_exists($handler, 'setFormatter')) {
                $handler->setFormatter(new class extends LineFormatter {
                    public function format(LogRecord $record): string
                    {
                        return $record->message . "\n";
                    }
                });
            }
        }
    }
}
