<?php

namespace App\Services\Payment;

use RuntimeException;

class SquareApiException extends RuntimeException
{
    public array $errors;

    public function __construct(string $message, int $code = 0, array $errors = [])
    {
        parent::__construct($message, $code);
        $this->errors = $errors;
    }
}
