<?php

namespace App\DTOs;

use Illuminate\Http\JsonResponse;

readonly class ImportResultDto
{
    public function __construct(
        public int   $imported,
        public array $errors = [],
    ) {}

    public function isSuccess(): bool
    {
        return $this->imported > 0 || empty($this->errors);
    }

    public function buildMessage(): string
    {
        $message = "{$this->imported}件の生体をインポートしました。";
        if (!empty($this->errors)) {
            $message .= ' エラー: ' . count($this->errors) . '件';
        }
        return $message;
    }

    public function toArray(): array
    {
        return ['imported' => $this->imported, 'errors' => $this->errors];
    }

    public function toResponse(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $this->buildMessage(),
            'data'    => $this->toArray(),
        ]);
    }
}
