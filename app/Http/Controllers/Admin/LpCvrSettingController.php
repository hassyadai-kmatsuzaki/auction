<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LpCvrSetting;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class LpCvrSettingController extends Controller
{
    public function index(string $lpType)
    {
        $this->assertLpType($lpType);

        $items = LpCvrSetting::where('lp_type', $lpType)
            ->orderByDesc('updated_at')
            ->get();

        $defaultCtaUrl = (string) (SystemSetting::get('lp_default_cta_' . $lpType) ?? '');

        return response()->json([
            'success' => true,
            'data' => [
                'lp_type' => $lpType,
                'default_cta_url' => $defaultCtaUrl,
                'failsafe_cta_url' => LpCvrSetting::failsafeCtaUrl($lpType),
                'preview_base_url' => config('app.url') . '/' . $lpType,
                'items' => $items,
            ],
        ]);
    }

    public function store(Request $request, string $lpType)
    {
        $this->assertLpType($lpType);

        $validator = Validator::make($request->all(), [
            'rid' => [
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('lp_cvr_settings', 'rid')->where(fn ($q) => $q->where('lp_type', $lpType)),
            ],
            'cta_url' => 'required|string|max:512|url|starts_with:https://',
            'note' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $row = LpCvrSetting::create([
            'lp_type' => $lpType,
            'rid' => $request->input('rid'),
            'cta_url' => $request->input('cta_url'),
            'note' => $request->input('note'),
        ]);

        return response()->json([
            'success' => true,
            'data' => ['item' => $row],
        ], 201);
    }

    public function update(Request $request, string $lpType, int $id)
    {
        $this->assertLpType($lpType);

        $row = LpCvrSetting::where('lp_type', $lpType)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'rid' => [
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('lp_cvr_settings', 'rid')
                    ->where(fn ($q) => $q->where('lp_type', $lpType))
                    ->ignore($row->id),
            ],
            'cta_url' => 'required|string|max:512|url|starts_with:https://',
            'note' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $row->update([
            'rid' => $request->input('rid'),
            'cta_url' => $request->input('cta_url'),
            'note' => $request->input('note'),
        ]);

        return response()->json([
            'success' => true,
            'data' => ['item' => $row->fresh()],
        ]);
    }

    public function destroy(string $lpType, int $id)
    {
        $this->assertLpType($lpType);

        $row = LpCvrSetting::where('lp_type', $lpType)->findOrFail($id);
        $row->delete();

        return response()->json(['success' => true]);
    }

    public function updateDefault(Request $request, string $lpType)
    {
        $this->assertLpType($lpType);

        $validator = Validator::make($request->all(), [
            'default_cta_url' => 'nullable|string|max:512|url|starts_with:https://',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $key = 'lp_default_cta_' . $lpType;
        $value = (string) ($request->input('default_cta_url') ?? '');

        SystemSetting::set($key, $value);

        return response()->json([
            'success' => true,
            'data' => [
                'lp_type' => $lpType,
                'default_cta_url' => $value,
            ],
        ]);
    }

    private function assertLpType(string $lpType): void
    {
        if (!in_array($lpType, LpCvrSetting::LP_TYPES, true)) {
            abort(404);
        }
    }
}
