<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EscrowTransaction;
use App\Services\EscrowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EscrowController extends Controller
{
    public function __construct(
        private EscrowService $escrowService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = EscrowTransaction::with(['buyer:id,name', 'seller:id,name', 'wonItem.item:id,species_name,item_number']);

        if ($request->status) {
            $query->where('status', $request->status);
        }

        $transactions = $query->orderByDesc('created_at')->paginate(20);

        return response()->json(['success' => true, 'data' => $transactions]);
    }

    public function confirmPayment(int $id): JsonResponse
    {
        $escrow = EscrowTransaction::findOrFail($id);
        $this->escrowService->confirmPayment($escrow);

        return response()->json(['success' => true, 'message' => '入金を確認しました']);
    }

    public function release(int $id): JsonResponse
    {
        $escrow = EscrowTransaction::findOrFail($id);
        $this->escrowService->releaseToSeller($escrow);

        return response()->json(['success' => true, 'message' => '出品者への支払いをリリースしました']);
    }

    public function refund(int $id, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:500']);
        $escrow = EscrowTransaction::findOrFail($id);
        $this->escrowService->refund($escrow, $request->reason);

        return response()->json(['success' => true, 'message' => '返金処理を実行しました']);
    }

    public function dispute(int $id, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:500']);
        $escrow = EscrowTransaction::findOrFail($id);
        $this->escrowService->openDispute($escrow, $request->reason);

        return response()->json(['success' => true, 'message' => '紛争を記録しました']);
    }
}
