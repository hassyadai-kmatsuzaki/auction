<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SpeciesName;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * 品種名（生体名）マスタ管理 API
 *
 * 出品申込フォームの入力補助（変換候補）に使う品種名候補を管理者が CRUD する。
 * items.species_name は自由テキストのままで、ここはあくまで「サジェスト元」。
 */
class SpeciesNameController extends Controller
{
    public function index()
    {
        $names = SpeciesName::orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['success' => true, 'data' => $names]);
    }

    public function store(Request $request)
    {
        $validator = $this->validatorFor($request, null);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        // sort_order 未指定なら末尾に追加
        if (!array_key_exists('sort_order', $data) || $data['sort_order'] === null) {
            $data['sort_order'] = (int) (SpeciesName::max('sort_order') ?? -1) + 1;
        }
        $data['is_active'] = $request->boolean('is_active', true);

        $name = SpeciesName::create($data);
        return response()->json(['success' => true, 'data' => $name], 201);
    }

    public function update(Request $request, int $id)
    {
        $name = SpeciesName::findOrFail($id);

        $validator = $this->validatorFor($request, $name);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $name->fill($validator->validated());
        if ($request->has('is_active')) {
            $name->is_active = $request->boolean('is_active');
        }
        $name->save();

        return response()->json(['success' => true, 'data' => $name]);
    }

    public function destroy(int $id)
    {
        $name = SpeciesName::findOrFail($id);
        $name->delete();
        return response()->json(['success' => true]);
    }

    /**
     * 並び順の一括更新。orders: [{id, sort_order}, ...]
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'orders' => 'required|array',
            'orders.*.id' => 'required|integer|exists:species_names,id',
            'orders.*.sort_order' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request) {
            foreach ($request->input('orders') as $row) {
                SpeciesName::where('id', $row['id'])->update(['sort_order' => $row['sort_order']]);
            }
        });

        return response()->json(['success' => true]);
    }

    private function validatorFor(Request $request, ?SpeciesName $existing): \Illuminate\Validation\Validator
    {
        $nameRule = Rule::unique('species_names', 'name');
        if ($existing) {
            $nameRule = $nameRule->ignore($existing->id);
        }

        $rules = [
            'name' => [$existing ? 'sometimes' : 'required', 'string', 'max:255', $nameRule],
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ];

        return Validator::make($request->all(), $rules);
    }
}
