<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Services\Payment\SubscriptionService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(private readonly SubscriptionService $service) {}

    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 30);

        $query = Subscription::query()
            ->with(['user:id,name,email,status', 'plan:id,code,name,amount']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('plan_id')) {
            $query->where('plan_id', $request->plan_id);
        }
        if ($request->filled('search')) {
            $q = $request->search;
            $query->whereHas('user', function ($w) use ($q) {
                $w->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%");
            });
        }

        $sortBy    = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy(in_array($sortBy, ['created_at', 'current_period_end', 'status']) ? $sortBy : 'created_at', $sortOrder === 'asc' ? 'asc' : 'desc');

        $subscriptions = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'subscriptions' => $subscriptions->items(),
                'pagination' => [
                    'total' => $subscriptions->total(),
                    'per_page' => $subscriptions->perPage(),
                    'current_page' => $subscriptions->currentPage(),
                    'last_page' => $subscriptions->lastPage(),
                ],
            ],
        ]);
    }

    public function show($id)
    {
        $subscription = Subscription::with(['user:id,name,email,status', 'plan', 'payments' => fn($q) => $q->latest()->limit(20)])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => ['subscription' => $subscription],
        ]);
    }

    /**
     * 管理者による強制解約
     */
    public function cancel(Request $request, $id)
    {
        $subscription = Subscription::findOrFail($id);
        $this->service->cancel($subscription, $request->input('reason'));
        return response()->json([
            'success' => true,
            'message' => 'サブスクリプションを解約しました',
        ]);
    }

    /**
     * 管理者による再課金（停止解除を試みる）
     */
    public function retry($id)
    {
        $subscription = Subscription::with('plan')->findOrFail($id);
        $payment = $this->service->retryCharge($subscription);

        if ($payment->status === 'completed') {
            $this->service->reactivateUser($subscription->fresh());
            return response()->json([
                'success' => true,
                'message' => '再課金に成功しました',
                'data' => ['payment' => $payment],
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => '再課金に失敗しました: ' . $payment->failure_reason,
            'data' => ['payment' => $payment],
        ], 402);
    }
}
