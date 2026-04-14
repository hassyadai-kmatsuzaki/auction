<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AwsScalingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScalingController extends Controller
{
    public function __construct(private readonly AwsScalingService $scaling) {}

    public function status(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => $this->scaling->getStatus(),
        ]);
    }

    public function scaleUp(Request $request): JsonResponse
    {
        $request->validate(['confirm' => 'required|in:SCALE_UP']);

        try {
            $action = $this->scaling->scaleUp($request->user()->id);
            return response()->json([
                'success' => true,
                'message' => 'スケールアップを開始しました。完了まで10〜20分ほどかかります。',
                'data'    => $action,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 409);
        }
    }

    public function scaleDown(Request $request): JsonResponse
    {
        $request->validate(['confirm' => 'required|in:SCALE_DOWN']);

        try {
            $action = $this->scaling->scaleDown($request->user()->id);
            return response()->json([
                'success' => true,
                'message' => 'スケールダウンを開始しました。完了まで10〜20分ほどかかります。',
                'data'    => $action,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 409);
        }
    }

    public function releaseLock(): JsonResponse
    {
        $this->scaling->releaseLock();
        return response()->json(['success' => true, 'message' => 'ロックを解除しました']);
    }
}
