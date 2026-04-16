<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ShippingTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    public function __construct(
        private ShippingTrackingService $trackingService,
    ) {}

    public function show(string $trackingNumber, Request $request): JsonResponse
    {
        $carrier = $request->query('carrier') ?? $this->trackingService->detectCarrier($trackingNumber);
        $status = $this->trackingService->getTrackingStatus($trackingNumber, $carrier);

        return response()->json([
            'success' => true,
            'data' => $status,
        ]);
    }
}
