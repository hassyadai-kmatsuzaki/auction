<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\PedigreeCertificate;
use App\Services\PedigreeCertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PedigreeCertificateController extends Controller
{
    public function __construct(
        private PedigreeCertificateService $service,
    ) {}

    /**
     * 商品の血統証明書を取得
     */
    public function show(int $itemId): JsonResponse
    {
        $certificate = PedigreeCertificate::where('item_id', $itemId)
            ->with('issuer:id,name')
            ->first();

        return response()->json([
            'success' => true,
            'data' => $certificate,
        ]);
    }

    /**
     * 血統証明書を作成
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'item_id' => 'required|integer|exists:items,id',
            'breed_name' => 'required|string|max:100',
            'breed_type' => 'nullable|string|max:100',
            'fixation_rate' => 'nullable|numeric|min:0|max:100',
            'expression' => 'nullable|string|max:200',
            'parent_male' => 'nullable|array',
            'parent_female' => 'nullable|array',
            'lineage' => 'nullable|array',
            'breeding_notes' => 'nullable|string|max:1000',
        ]);

        $item = Item::findOrFail($request->item_id);
        $certificate = $this->service->create($item, $request->user()->id, $request->all());

        return response()->json([
            'success' => true,
            'data' => $certificate,
        ], 201);
    }

    /**
     * 血統証明書を発行（draft → issued）
     */
    public function issue(int $id): JsonResponse
    {
        $certificate = PedigreeCertificate::findOrFail($id);
        $this->service->issue($certificate);

        return response()->json([
            'success' => true,
            'message' => '血統証明書を発行しました',
            'data' => $certificate->fresh(),
        ]);
    }

    /**
     * 血統証明書PDFダウンロード
     */
    public function download(int $id)
    {
        $certificate = PedigreeCertificate::findOrFail($id);
        $pdf = $this->service->generatePdf($certificate);

        return $pdf->download("pedigree_{$certificate->certificate_number}.pdf");
    }
}
