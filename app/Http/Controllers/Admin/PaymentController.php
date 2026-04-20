<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Payment\SquareClient;
use App\Services\Payment\SquareApiException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PaymentController extends Controller
{
    public function __construct(private readonly SquareClient $square) {}

    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 30);

        $query = Payment::query()
            ->with(['user:id,name,email', 'plan:id,code,name']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('plan_id')) {
            $query->where('plan_id', $request->plan_id);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('from')) {
            $query->where('paid_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('paid_at', '<=', $request->to);
        }
        if ($request->filled('search')) {
            $q = $request->search;
            $query->whereHas('user', function ($w) use ($q) {
                $w->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%");
            });
        }

        $payments = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'payments' => $payments->items(),
                'pagination' => [
                    'total' => $payments->total(),
                    'per_page' => $payments->perPage(),
                    'current_page' => $payments->currentPage(),
                    'last_page' => $payments->lastPage(),
                ],
            ],
        ]);
    }

    public function show($id)
    {
        $payment = Payment::with(['user:id,name,email', 'plan', 'subscription'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => ['payment' => $payment],
        ]);
    }

    public function refund(Request $request, $id)
    {
        $payment = Payment::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'amount' => 'nullable|integer|min:1',
            'reason' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        if ($payment->status !== Payment::STATUS_COMPLETED) {
            return response()->json(['success' => false, 'message' => '完了済みの決済のみ返金できます'], 409);
        }
        if (!$payment->square_payment_id) {
            return response()->json(['success' => false, 'message' => 'Square決済IDが紐付いていません'], 409);
        }

        $amount = (int) ($request->input('amount') ?? $payment->amount);
        if ($amount > $payment->amount) {
            return response()->json(['success' => false, 'message' => '決済金額を超える返金はできません'], 422);
        }

        try {
            $refund = $this->square->refundPayment($payment->square_payment_id, $amount, (string) $request->input('reason', ''));
        } catch (SquareApiException $e) {
            return response()->json(['success' => false, 'message' => 'Square 返金エラー: ' . $e->getMessage()], 502);
        }

        $payment->update([
            'status'          => Payment::STATUS_REFUNDED,
            'refunded_at'     => now(),
            'refunded_amount' => $amount,
            'raw_response'    => array_merge($payment->raw_response ?? [], ['refund' => $refund]),
        ]);

        return response()->json([
            'success' => true,
            'message' => '返金しました',
            'data' => ['payment' => $payment->fresh()],
        ]);
    }
}
