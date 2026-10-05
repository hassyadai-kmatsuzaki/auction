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

    /**
     * 期間指定レポート
     * GET /api/admin/reports/custom?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
     */
    public function custom(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => 'required|date_format:Y-m-d',
            'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date',
        ], [
            'start_date.required' => '開始日を指定してください。',
            'end_date.required' => '終了日を指定してください。',
            'end_date.after_or_equal' => '終了日は開始日以降の日付を指定してください。',
        ]);

        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);
        if ($start->diffInDays($end) > 366) {
            return response()->json(['success' => false, 'message' => '期間は1年以内で指定してください。'], 422);
        }

        return response()->json([
            'success' => true,
            'data' => $this->reportService->generateCustomReport($start, $end),
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
