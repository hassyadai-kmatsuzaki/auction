<?php

namespace App\Http\Middleware;

use App\Models\Auction;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAuctionEditable
{
    public function handle(Request $request, Closure $next): Response
    {
        $auctionId = $request->route('auctionId');

        if ($auctionId === null) {
            return response()->json([
                'success' => false,
                'message' => 'オークションが指定されていません。',
            ], 400);
        }

        $auction = Auction::find($auctionId);

        if (!$auction) {
            return response()->json([
                'success' => false,
                'message' => '対象のオークションが見つかりませんでした。',
            ], 404);
        }

        if (!$auction->canEdit()) {
            return response()->json([
                'success' => false,
                'message' => 'このオークションは開催中または終了済みのため編集できません。',
            ], 403);
        }

        return $next($request);
    }
}
