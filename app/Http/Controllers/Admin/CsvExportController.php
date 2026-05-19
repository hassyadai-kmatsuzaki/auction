<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\CsvExportService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CsvExportController extends Controller
{
    public function __construct(
        private CsvExportService $csvExportService,
    ) {}

    /**
     * GET /api/admin/exports/auctions-summary.csv
     */
    public function auctionsSummary(Request $request): StreamedResponse
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'include_test' => 'nullable|boolean',
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->input('from')) : null;
        $to = $request->filled('to') ? Carbon::parse($request->input('to')) : null;
        $includeTest = $request->boolean('include_test');

        return $this->csvExportService->streamAuctionSummary($from, $to, $includeTest);
    }

    /**
     * GET /api/admin/exports/auction-items.csv
     */
    public function auctionItems(Request $request): StreamedResponse
    {
        $request->validate([
            'auction_id' => 'nullable|integer|exists:auctions,id',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'include_test' => 'nullable|boolean',
        ]);

        $auctionId = $request->filled('auction_id') ? (int) $request->input('auction_id') : null;
        $from = $request->filled('from') ? Carbon::parse($request->input('from')) : null;
        $to = $request->filled('to') ? Carbon::parse($request->input('to')) : null;
        $includeTest = $request->boolean('include_test');

        return $this->csvExportService->streamAuctionItems($auctionId, $from, $to, $includeTest);
    }

    /**
     * GET /api/admin/exports/members.csv
     */
    public function members(Request $request): StreamedResponse
    {
        return $this->csvExportService->streamMembers();
    }

    /**
     * GET /api/admin/exports/subscriptions.csv
     */
    public function subscriptions(Request $request): StreamedResponse
    {
        return $this->csvExportService->streamSubscriptions();
    }
}
