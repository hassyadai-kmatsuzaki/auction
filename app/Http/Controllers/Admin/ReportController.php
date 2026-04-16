<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ReportController extends Controller
{
    public function __construct(
        private ReportService $reportService,
    ) {}

    public function weekly(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date')
            ? Carbon::parse($request->query('start_date'))
            : null;

        return response()->json([
            'success' => true,
            'data' => $this->reportService->generateWeeklyReport($startDate),
        ]);
    }

    public function monthly(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date')
            ? Carbon::parse($request->query('start_date'))
            : null;

        return response()->json([
            'success' => true,
            'data' => $this->reportService->generateMonthlyReport($startDate),
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'required|in:weekly,monthly',
        ]);

        \Illuminate\Support\Facades\Artisan::call('reports:generate', [
            'type' => $request->type,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'レポート生成を開始しました',
        ]);
    }
}
