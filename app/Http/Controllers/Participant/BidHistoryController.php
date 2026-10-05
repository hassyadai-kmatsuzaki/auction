<?php

namespace App\Http\Controllers\Participant;

use App\Http\Controllers\Controller;
use App\Models\BidEvent;
use App\Models\Item;
use App\Models\WonItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 入札履歴（F-022）。自分が入札に参加した生体と、その結果を新しい順に返す。
 * bid_events を読むだけ（入札処理には触れない）。アーカイブ済みの開催は含まれない
 */
class BidHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless(config('features.bid_history'), 404);

        $userId = $request->user()->id;
        $perPage = min(50, max(1, (int) $request->input('per_page', 20)));

        $page = BidEvent::query()
            ->where('user_id', $userId)
            ->where('event_type', BidEvent::TYPE_JOIN)
            ->groupBy('item_id')
            ->select('item_id', DB::raw('MAX(created_at) as last_bid_at'))
            ->orderByDesc('last_bid_at')
            ->paginate($perPage);

        $itemIds = collect($page->items())->pluck('item_id');
        $items = Item::with('auction:id,title,event_date')->whereIn('id', $itemIds)->get()->keyBy('id');
        $wonItems = WonItem::whereIn('item_id', $itemIds)->get(['item_id', 'winner_id', 'winning_price'])->keyBy('item_id');

        $rows = collect($page->items())->map(function ($row) use ($items, $wonItems, $userId) {
            $item = $items->get($row->item_id);
            $won = $wonItems->get($row->item_id);

            return [
                'item_id' => $row->item_id,
                'last_bid_at' => \Illuminate\Support\Carbon::parse($row->last_bid_at)->toIso8601String(),
                'species_name' => $item?->species_name,
                'item_number' => $item?->item_number,
                'exhibit_code' => $item?->exhibit_code,
                'thumbnail_path' => $item?->thumbnail_path,
                'auction' => $item?->auction ? [
                    'id' => $item->auction->id,
                    'title' => $item->auction->title,
                    'event_date' => $item->auction->event_date?->format('Y-m-d'),
                ] : null,
                'result' => $this->result($item, $won, $userId),
                'final_price' => $won ? (int) $won->winning_price : ($item ? (int) ($item->current_price ?? $item->start_price) : null),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'history' => $rows,
                'pagination' => [
                    'total' => $page->total(),
                    'current_page' => $page->currentPage(),
                    'last_page' => $page->lastPage(),
                ],
            ],
        ]);
    }

    /** won=落札 / lost=落札できず / unsold=不成立 / in_progress=開催中・開催前 */
    private function result(?Item $item, ?WonItem $won, int $userId): string
    {
        if ($won) {
            return (int) $won->winner_id === $userId ? 'won' : 'lost';
        }

        return match ($item?->status) {
            'sold' => 'lost',
            'unsold' => 'unsold',
            default => 'in_progress',
        };
    }
}
