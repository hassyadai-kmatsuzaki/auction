<?php

namespace App\Services\GmoAozora;

use RuntimeException;

/**
 * GMOあおぞら API のエラー応答（共通エラー: errorCode / errorMessage）。
 */
class GmoAozoraApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 0,
        public readonly ?string $errorCode = null,
        public readonly array $body = [],
        public readonly string $context = '',
    ) {
        parent::__construct($message, $status);
    }

    public function toArray(): array
    {
        return [
            'context'    => $this->context,
            'status'     => $this->status,
            'error_code' => $this->errorCode,
            'message'    => $this->getMessage(),
        ];
    }
}
