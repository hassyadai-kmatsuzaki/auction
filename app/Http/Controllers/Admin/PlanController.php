<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PlanController extends Controller
{
    public function index(Request $request)
    {
        $query = Plan::query();
        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }
        $plans = $query->orderBy('sort_order')->orderBy('id')->get();

        return response()->json([
            'success' => true,
            'data' => ['plans' => $plans],
        ]);
    }

    public function show($id)
    {
        $plan = Plan::findOrFail($id);
        return response()->json([
            'success' => true,
            'data' => ['plan' => $plan],
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code'        => 'required|string|max:50|unique:plans,code',
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string',
            'amount'      => 'required|integer|min:0|max:99999999',
            'allows_bid'  => 'required|boolean',
            'allows_sell' => 'required|boolean',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer|min:0',
        ], [
            'code.required' => 'コードは必須です',
            'code.unique'   => '同じコードのプランが既に存在します',
            'name.required' => 'プラン名は必須です',
            'amount.required' => '年会費を入力してください',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        if (!$request->boolean('allows_bid') && !$request->boolean('allows_sell')) {
            return response()->json([
                'success' => false,
                'message' => '落札・出品のいずれかは有効にしてください',
            ], 422);
        }

        $plan = Plan::create($validator->validated() + [
            'is_active' => $request->boolean('is_active', true),
            'sort_order' => (int) $request->input('sort_order', 0),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'プランを作成しました',
            'data'    => ['plan' => $plan],
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $plan = Plan::findOrFail($id);

        // code / amount は既存契約者の課金に直結するため編集不可。
        // 料金改定は新コードのプランを別途作成し、旧プランは is_active=false で受付停止する運用。
        $validator = Validator::make($request->all(), [
            'name'        => 'sometimes|required|string|max:100',
            'description' => 'nullable|string',
            'allows_bid'  => 'sometimes|required|boolean',
            'allows_sell' => 'sometimes|required|boolean',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $allowsBid  = $request->boolean('allows_bid', $plan->allows_bid);
        $allowsSell = $request->boolean('allows_sell', $plan->allows_sell);
        if (!$allowsBid && !$allowsSell) {
            return response()->json([
                'success' => false,
                'message' => '落札・出品のいずれかは有効にしてください',
            ], 422);
        }

        $plan->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'プランを更新しました',
            'data'    => ['plan' => $plan->fresh()],
        ]);
    }
}
