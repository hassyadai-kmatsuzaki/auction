<?php

namespace App\DTOs;

readonly class BidResultDto
{
    private function __construct(
        public bool   $success,
        public string $message,
        public array  $data = [],
        public bool   $silent = false,
    ) {}

    public static function success(array $data = [], string $message = ''): self
    {
        return new self(true, $message, $data);
    }

    /**
     * @param bool $silent true=フロントでトースト非表示。
     *                     ユーザーの誤操作ではなくサーバー再検証で正常に弾かれた競合
     *                     （pre_bid/freeze 中の滑り込み・価格不一致・他者が落札権利者）に使用。
     *                     状態は WS イベント経由で自然に同期されるため、エラー文言を見せると誤解を招く。
     */
    public static function failure(string $message, array $data = [], bool $silent = false): self
    {
        return new self(false, $message, $data, $silent);
    }

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'message' => $this->message,
            'silent'  => $this->silent,
            'data'    => $this->data,
        ];
    }

    public function toResponse(int $successCode = 200, int $failureCode = 400): \Illuminate\Http\JsonResponse
    {
        $code = $this->success ? $successCode : $failureCode;
        return response()->json($this->toArray(), $code);
    }
}
