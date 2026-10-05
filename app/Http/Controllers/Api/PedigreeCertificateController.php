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
    private const FIELD_RULES = [
        'breed_name' => 'required|string|max:100',
        'breed_type' => 'nullable|string|max:100',
        'fixation_rate' => 'nullable|numeric|min:0|max:100',
        'expression' => 'nullable|string|max:200',
        'parent_male' => 'nullable|array',
        'parent_female' => 'nullable|array',
        'lineage' => 'nullable|array',
        'breeding_notes' => 'nullable|string|max:1000',
    ];

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
            'data' => $certificate ? $this->withVerifyUrl($certificate) : null,
        ]);
    }

    /**
     * 血統証明書を作成
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate(['item_id' => 'required|integer|exists:items,id'] + self::FIELD_RULES);

        $item = Item::findOrFail($request->item_id);
        $certificate = $this->service->create($item, $request->user()->id, $request->all());

        return response()->json([
            'success' => true,
            'data' => $this->withVerifyUrl($certificate),
        ], 201);
    }

    /**
     * 下書きの血統証明書を更新
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(self::FIELD_RULES);

        $certificate = PedigreeCertificate::findOrFail($id);
        $this->service->update($certificate, $validated);

        return response()->json([
            'success' => true,
            'data' => $this->withVerifyUrl($certificate->fresh('issuer:id,name')),
        ]);
    }

    /**
     * 血統証明書を発行（draft → issued）
     */
    public function issue(Request $request, int $id): JsonResponse
    {
        $certificate = PedigreeCertificate::findOrFail($id);
        $this->service->issue($certificate, $request->user()?->id);

        return response()->json([
            'success' => true,
            'message' => '血統証明書を発行しました',
            'data' => $this->withVerifyUrl($certificate->fresh('issuer:id,name')),
        ]);
    }

    /**
     * 血統証明書を取消（issued → revoked）
     */
    public function revoke(int $id): JsonResponse
    {
        $certificate = PedigreeCertificate::findOrFail($id);
        $this->service->revoke($certificate);

        return response()->json([
            'success' => true,
            'message' => '血統証明書を取り消しました',
            'data' => $this->withVerifyUrl($certificate->fresh('issuer:id,name')),
        ]);
    }

    /**
     * 血統証明書PDFダウンロード
     */
    public function download(int $id)
    {
        $certificate = PedigreeCertificate::findOrFail($id);
        $pdf = $this->service->generatePdf($certificate);

        return $pdf->download($this->service->pdfFilename($certificate));
    }

    /**
     * 落札者向け PDF（署名付き URL・有効期限付き）。発行済みのみ。
     * LINE 内ブラウザ等 Blob ダウンロードできない環境でもそのまま開けるよう inline で返す
     */
    public function signedDownload(int $id)
    {
        abort_unless(config('features.pedigree_certificate'), 404);

        $certificate = PedigreeCertificate::where('status', 'issued')->findOrFail($id);
        $content = $this->service->generatePdf($certificate)->output();
        $filename = $this->service->pdfFilename($certificate);

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Content-Length' => strlen($content),
        ]);
    }

    /**
     * 証明書番号による真正性確認（認証不要）
     */
    public function verify(string $certificateNumber): JsonResponse
    {
        // 表示スイッチ OFF の間は照会ページごと公開しない
        abort_unless(config('features.pedigree_certificate'), 404);

        $certificate = $this->service->findForVerification($certificateNumber);

        if (!$certificate) {
            return response()->json([
                'success' => false,
                'message' => '該当する証明書は見つかりませんでした',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->service->toPublicArray($certificate),
        ]);
    }

    private function withVerifyUrl(PedigreeCertificate $certificate): array
    {
        return $certificate->toArray() + ['verify_url' => $this->service->verificationUrl($certificate)];
    }
}
