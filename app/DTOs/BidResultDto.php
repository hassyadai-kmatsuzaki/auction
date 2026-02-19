<?php

namespace App\DTOs;

readonly class BidResultDto
{
    private function __construct(
        public bool   $success,
        public string $message,
        public array  $data = [],
    ) {}

    public static function success(array $data = [], string $message = ''): self
    {
        return new self(true, $message, $data);
    }

    public static function failure(string $message, array $data = []): self
    {
        return new self(false, $message, $data);
    }

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'message' => $this->message,
            'data'    => $this->data,
        ];
    }

    public function toResponse(int $successCode = 200, int $failureCode = 400): \Illuminate\Http\JsonResponse
    {
        $code = $this->success ? $successCode : $failureCode;
        return response()->json($this->toArray(), $code);
    }
}
