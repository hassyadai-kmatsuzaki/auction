<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BagMixRestriction;
use App\Models\BagSpec;
use App\Models\BoxCapacity;
use App\Models\SpeciesType;
use App\Services\ShippingCalculatorService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * 種別マスタ管理 API
 *
 * 管理者が species_types（メダカ含む生体カテゴリ）を CRUD し、
 * 種別ごとの袋 / 箱入数 / 混載制約を管理する。
 */
class SpeciesTypeController extends Controller
{
    private const ALLOWED_UNITS = [
        SpeciesType::UNIT_FISH,
        SpeciesType::UNIT_KG,
        SpeciesType::UNIT_BAG,
    ];

    // ═══════════════════════════════════════════════════════════
    // 種別本体
    // ═══════════════════════════════════════════════════════════

    public function index()
    {
        $types = SpeciesType::orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['success' => true, 'data' => $types]);
    }

    public function show(int $id)
    {
        $type = SpeciesType::with(['bagSpecs', 'boxCapacities', 'bagMixRestrictions'])->findOrFail($id);
        return response()->json(['success' => true, 'data' => $type]);
    }

    public function store(Request $request)
    {
        $validator = $this->speciesValidator($request, null);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $data = $this->normalizeSpeciesPayload($validator->validated());

        $type = DB::transaction(function () use ($data) {
            if (!empty($data['is_default'])) {
                SpeciesType::where('is_default', true)->update(['is_default' => false]);
            }
            return SpeciesType::create($data);
        });

        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true, 'data' => $type], 201);
    }

    public function update(Request $request, int $id)
    {
        $type = SpeciesType::findOrFail($id);

        $validator = $this->speciesValidator($request, $type);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $data = $this->normalizeSpeciesPayload($validator->validated());

        // auto への切替時は袋マスタが存在することを保証
        if (isset($data['calculation_mode'])
            && $data['calculation_mode'] === SpeciesType::MODE_AUTO
            && $type->calculation_mode !== SpeciesType::MODE_AUTO
            && !BagSpec::where('species_type_id', $type->id)->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'auto に切り替えるには袋マスタを先に登録してください。',
            ], 422);
        }

        DB::transaction(function () use ($type, $data) {
            if (!empty($data['is_default'])) {
                SpeciesType::where('is_default', true)->where('id', '!=', $type->id)->update(['is_default' => false]);
            }
            // code は保存後に変更不可
            unset($data['code']);
            $type->update($data);
        });

        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true, 'data' => $type->fresh()]);
    }

    public function destroy(int $id)
    {
        $type = SpeciesType::findOrFail($id);
        // 論理削除（is_active=false）
        $type->update(['is_active' => false, 'is_default' => false]);
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true]);
    }

    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'orders' => 'required|array|min:1',
            'orders.*.id' => 'required|integer|exists:species_types,id',
            'orders.*.sort_order' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request) {
            foreach ($request->input('orders') as $row) {
                SpeciesType::where('id', $row['id'])->update(['sort_order' => $row['sort_order']]);
            }
        });

        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true]);
    }

    // ═══════════════════════════════════════════════════════════
    // 配下: 袋マスタ
    // ═══════════════════════════════════════════════════════════

    public function bagSpecsIndex(int $id)
    {
        SpeciesType::findOrFail($id);
        $specs = BagSpec::where('species_type_id', $id)->orderBy('min_qty')->get();
        return response()->json(['success' => true, 'data' => $specs]);
    }

    public function bagSpecsStore(Request $request, int $id)
    {
        SpeciesType::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'bag_size' => 'required|string|max:8',
            'model' => 'nullable|string|max:10',
            'min_qty' => 'required|integer|min:1',
            'max_qty' => 'nullable|integer|min:1|gte:min_qty',
            'weight_kg' => 'required|numeric|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $exists = BagSpec::where('species_type_id', $id)
            ->where('bag_size', $request->input('bag_size'))->exists();
        if ($exists) {
            return response()->json(['success' => false, 'message' => '同じ袋サイズが既に登録されています。'], 409);
        }

        $spec = BagSpec::create($validator->validated() + ['species_type_id' => $id]);
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true, 'data' => $spec], 201);
    }

    public function bagSpecsUpdate(Request $request, int $id, int $specId)
    {
        $spec = BagSpec::where('species_type_id', $id)->findOrFail($specId);
        $validator = Validator::make($request->all(), [
            'bag_size' => 'sometimes|required|string|max:8',
            'model' => 'nullable|string|max:10',
            'min_qty' => 'sometimes|required|integer|min:1',
            'max_qty' => 'nullable|integer|min:1',
            'weight_kg' => 'sometimes|required|numeric|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }
        $spec->update($validator->validated());
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true, 'data' => $spec->fresh()]);
    }

    public function bagSpecsDestroy(int $id, int $specId)
    {
        $spec = BagSpec::where('species_type_id', $id)->findOrFail($specId);
        $spec->delete();
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true]);
    }

    // ═══════════════════════════════════════════════════════════
    // 配下: 箱入数マスタ（box_capacities）
    // ═══════════════════════════════════════════════════════════

    public function boxCapacitiesIndex(int $id)
    {
        SpeciesType::findOrFail($id);
        $caps = BoxCapacity::where('species_type_id', $id)
            ->orderBy('box_size')->orderBy('bag_size')->get();
        return response()->json(['success' => true, 'data' => $caps]);
    }

    public function boxCapacitiesUpsert(Request $request, int $id)
    {
        SpeciesType::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'capacities' => 'required|array|min:1',
            'capacities.*.box_size' => 'required|integer',
            'capacities.*.bag_size' => 'required|string|max:8',
            'capacities.*.max_count' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request, $id) {
            foreach ($request->input('capacities') as $row) {
                BoxCapacity::updateOrCreate(
                    ['species_type_id' => $id, 'box_size' => $row['box_size'], 'bag_size' => $row['bag_size']],
                    ['max_count' => $row['max_count']]
                );
            }
        });

        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true]);
    }

    public function boxCapacitiesDestroy(int $id, int $capId)
    {
        $cap = BoxCapacity::where('species_type_id', $id)->findOrFail($capId);
        $cap->delete();
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true]);
    }

    // ═══════════════════════════════════════════════════════════
    // 配下: 混載制約
    // ═══════════════════════════════════════════════════════════

    public function mixRestrictionsIndex(int $id)
    {
        SpeciesType::findOrFail($id);
        $rows = BagMixRestriction::where('species_type_id', $id)->get();
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function mixRestrictionsStore(Request $request, int $id)
    {
        SpeciesType::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'box_size' => 'nullable|integer',
            'bag_size_a' => 'required|string|max:8',
            'bag_size_b' => 'required|string|max:8|different:bag_size_a',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }
        $row = BagMixRestriction::create($validator->validated() + ['species_type_id' => $id]);
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true, 'data' => $row], 201);
    }

    public function mixRestrictionsDestroy(int $id, int $rowId)
    {
        $row = BagMixRestriction::where('species_type_id', $id)->findOrFail($rowId);
        $row->delete();
        ShippingCalculatorService::clearCache();
        return response()->json(['success' => true]);
    }

    // ═══════════════════════════════════════════════════════════
    // 内部
    // ═══════════════════════════════════════════════════════════

    private function speciesValidator(Request $request, ?SpeciesType $existing)
    {
        $codeRule = $existing
            ? 'sometimes|string|max:32|alpha_dash' // update 時は変更不可扱いだが受け取りは許容
            : 'required|string|max:32|alpha_dash|unique:species_types,code';

        return Validator::make($request->all(), [
            'code' => $codeRule,
            'name' => $existing ? 'sometimes|required|string|max:64' : 'required|string|max:64',
            'calculation_mode' => 'sometimes|required|in:auto,manual',
            'is_mixable' => 'sometimes|boolean',
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
            'allowed_quantity_units' => 'sometimes|required|array|min:1',
            'allowed_quantity_units.*' => 'in:' . implode(',', self::ALLOWED_UNITS),
        ]);
    }

    private function normalizeSpeciesPayload(array $data): array
    {
        if (!isset($data['allowed_quantity_units'])) {
            $data['allowed_quantity_units'] = [SpeciesType::UNIT_FISH];
        }
        return $data;
    }
}
