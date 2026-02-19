<?php

namespace App\DTOs;

use Illuminate\Http\JsonResponse;

readonly class AuctionResultDto
{
    private function __construct(
        public bool   $success,
        public string $message,
        public array  $data = [],
    ) {}

    public static function success(string $message = '', array $data = []): self
    {
        return new self(true, $message, $data);
    }

    public static function failure(string $message, array $data = []): self
    {
        return new self(false, $message, $data);
    }

    public function toArray(): array
    {
        return ['success' => $this->success, 'message' => $this->message, 'data' => $this->data];
    }

    public function toResponse(int $successCode = 200, int $failureCode = 400): JsonResponse
    {
        return response()->json($this->toArray(), $this->success ? $successCode : $failureCode);
    }
}
