<?php

namespace App\Http\Controllers\MediaEditor;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuctionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->input('per_page', 20);
        $search  = $request->input('search');

        $query = Auction::query()
            ->whereIn('status', ['preparing', 'scheduled'])
            ->withCount('items');

        if ($search) {
            $query->where('title', 'like', '%' . $search . '%');
        }

        $auctions = $query
            ->orderBy('event_date', 'asc')
            ->orderBy('id', 'asc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'auctions' => $auctions->map(function (Auction $a) {
                    return [
                        'id'          => $a->id,
                        'title'       => $a->title,
                        'event_date'  => optional($a->event_date)->format('Y-m-d'),
                        'status'      => $a->status,
                        'items_count' => $a->items_count,
                        'is_test'     => (bool) ($a->is_test ?? false),
                    ];
                }),
                'pagination' => [
                    'total'        => $auctions->total(),
                    'per_page'     => $auctions->perPage(),
                    'current_page' => $auctions->currentPage(),
                    'last_page'    => $auctions->lastPage(),
                ],
            ],
        ]);
    }
}
