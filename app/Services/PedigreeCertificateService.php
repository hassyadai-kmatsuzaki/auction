<?php

namespace App\Services;

use App\Models\Item;
use App\Models\PedigreeCertificate;
use Barryvdh\DomPDF\Facade\Pdf;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PedigreeCertificateService
{
    /** 下書きの仮番号の接頭辞。証明書番号は発行時に付与し、下書きは照会でヒットしない */
    public const DRAFT_PREFIX = 'DRAFT-';

    /** 下書き編集で受け付ける項目 */
    private const EDITABLE_FIELDS = [
        'breed_name', 'breed_type', 'fixation_rate', 'expression',
        'parent_male', 'parent_female', 'lineage', 'breeding_notes',
    ];

    /**
     * 血統証明書を作成（1商品1枚）。
     * item_id に一意制約が無いため、items 行をロックして同時作成を直列化する（items 先行ロックの規約どおり）
     */
    public function create(Item $item, int $issuedBy, array $data): PedigreeCertificate
    {
        return DB::transaction(function () use ($item, $issuedBy, $data) {
            Item::whereKey($item->id)->lockForUpdate()->first();

            if (PedigreeCertificate::where('item_id', $item->id)->exists()) {
                throw ValidationException::withMessages([
                    'item_id' => 'この生体には既に血統証明書があります',
                ]);
            }

            return $this->createDraft($item, $issuedBy, $data);
        });
    }

    private function createDraft(Item $item, int $issuedBy, array $data): PedigreeCertificate
    {
        return PedigreeCertificate::create([
            'item_id' => $item->id,
            'issued_by' => $issuedBy,
            // certificate_number は NOT NULL UNIQUE のため、下書きは仮番号を入れて発行時に本番号へ差し替える
            'certificate_number' => self::DRAFT_PREFIX . Str::uuid(),
            'breed_name' => $data['breed_name'],
            'breed_type' => $data['breed_type'] ?? null,
            'fixation_rate' => $data['fixation_rate'] ?? null,
            'expression' => $data['expression'] ?? null,
            'parent_male' => $data['parent_male'] ?? null,
            'parent_female' => $data['parent_female'] ?? null,
            'lineage' => $data['lineage'] ?? null,
            'breeding_notes' => $data['breeding_notes'] ?? null,
            'status' => 'draft',
        ]);
    }

    /**
     * 下書きを更新。発行後は内容を変えられない（証明の信用の根拠）
     */
    public function update(PedigreeCertificate $certificate, array $data): PedigreeCertificate
    {
        return $this->transition($certificate, 'draft', '発行済み・取消済みの証明書は編集できません',
            fn (PedigreeCertificate $c) => $c->update(array_intersect_key($data, array_flip(self::EDITABLE_FIELDS))));
    }

    /**
     * 血統証明書を発行（draft → issued）。証明書番号はここで付与する
     */
    public function issue(PedigreeCertificate $certificate, ?int $issuedBy = null): PedigreeCertificate
    {
        return $this->transition($certificate, 'draft', '下書きの証明書のみ発行できます',
            fn (PedigreeCertificate $c) => $c->update(array_filter([
                'certificate_number' => $this->generateCertificateNumber(),
                'status' => 'issued',
                'issued_at' => now(),
                'issued_by' => $issuedBy,
            ], fn ($v) => $v !== null)));
    }

    /**
     * 血統証明書を取消（issued → revoked）。照会では「取消済み」と表示される。
     * 取消の日時・実行者は監査ログ（audit ミドルウェア）に残る
     */
    public function revoke(PedigreeCertificate $certificate): PedigreeCertificate
    {
        return $this->transition($certificate, 'issued', '発行済みの証明書のみ取り消せます',
            fn (PedigreeCertificate $c) => $c->update(['status' => 'revoked']));
    }

    /**
     * 行ロックを取って状態を確認してから変更する（発行の二重実行で番号が振り直されるのを防ぐ）
     */
    private function transition(PedigreeCertificate $certificate, string $expected, string $message, callable $change): PedigreeCertificate
    {
        return DB::transaction(function () use ($certificate, $expected, $message, $change) {
            $locked = PedigreeCertificate::whereKey($certificate->id)->lockForUpdate()->firstOrFail();
            $this->assertStatus($locked, $expected, $message);
            $change($locked);
            $certificate->setRawAttributes($locked->getAttributes(), true);

            return $locked;
        });
    }

    public function isDraftNumber(string $certificateNumber): bool
    {
        return str_starts_with($certificateNumber, self::DRAFT_PREFIX);
    }

    /**
     * 公開照会用。下書きは存在しない扱いにする
     */
    public function findForVerification(string $certificateNumber): ?PedigreeCertificate
    {
        return PedigreeCertificate::where('certificate_number', strtoupper(trim($certificateNumber)))
            ->whereIn('status', ['issued', 'revoked'])
            ->with('item:id,auction_id,species_name,item_number,quantity,quantity_unit', 'item.auction:id,title')
            ->first();
    }

    /**
     * 公開照会で返す項目。発行者・出品者などの個人情報は含めない
     */
    public function toPublicArray(PedigreeCertificate $certificate): array
    {
        return [
            'certificate_number' => $certificate->certificate_number,
            'status' => $certificate->status,
            'breed_name' => $certificate->breed_name,
            'breed_type' => $certificate->breed_type,
            'fixation_rate' => $certificate->fixation_rate,
            'expression' => $certificate->expression,
            'parent_male' => $certificate->parent_male,
            'parent_female' => $certificate->parent_female,
            'lineage' => $certificate->lineage,
            'issued_at' => $certificate->issued_at?->toIso8601String(),
            'item' => $certificate->item ? [
                'species_name' => $certificate->item->species_name,
                'item_number' => $certificate->item->item_number,
                'auction_title' => $certificate->item->auction?->title,
            ] : null,
        ];
    }

    /**
     * 照会ページのURL（QRコードの中身）。下書きには番号が無いので null。
     * 本番は SPA と API が同一ドメインのため APP_URL を使う
     */
    public function verificationUrl(PedigreeCertificate $certificate): ?string
    {
        if ($certificate->status === 'draft') {
            return null;
        }

        return rtrim((string) config('app.url'), '/') . '/pedigree/verify/' . $certificate->certificate_number;
    }

    public function pdfFilename(PedigreeCertificate $certificate): string
    {
        return $certificate->status === 'draft'
            ? "pedigree_draft_{$certificate->id}.pdf"
            : "pedigree_{$certificate->certificate_number}.pdf";
    }

    /**
     * 血統証明書PDFを生成
     */
    public function generatePdf(PedigreeCertificate $certificate): \Barryvdh\DomPDF\PDF
    {
        $certificate->loadMissing(['item.media', 'issuer']);

        $verifyUrl = $this->verificationUrl($certificate);

        $data = [
            'certificate' => $certificate,
            'item' => $certificate->item,
            'issuer' => $certificate->issuer,
            'verifyUrl' => $verifyUrl,
            // 照会ページが公開されている（表示スイッチ ON）ときだけ QR を載せる
            'qrDataUri' => config('features.pedigree_certificate') && $certificate->status === 'issued' && $verifyUrl
                ? $this->qrDataUri($verifyUrl) : null,
        ];

        $pdf = Pdf::loadView('pdf.pedigree-certificate', $data);
        $pdf->setPaper('A4', 'portrait');
        // QR コードを data URI で埋め込むため、この帳票だけ data:// を許可する（共通設定は変えない）
        $pdf->setOption('allowed_protocols', $pdf->getDomPDF()->getOptions()->getAllowedProtocols() + ['data://' => ['rules' => []]]);

        return $pdf;
    }

    /**
     * QRコードを SVG の data URI で返す（PNG は GD 拡張が必要なため使わない）
     */
    private function qrDataUri(string $url): string
    {
        $options = new QROptions([
            'outputType' => QRCode::OUTPUT_MARKUP_SVG,
            'outputBase64' => true,
            'svgAddXmlHeader' => true,
            'drawLightModules' => false,
        ]);

        return (new QRCode($options))->render($url);
    }

    private function assertStatus(PedigreeCertificate $certificate, string $expected, string $message): void
    {
        if ($certificate->status !== $expected) {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }

    /**
     * 証明書番号を生成（発行日 + ランダム6桁。既存と衝突したら振り直す）
     */
    private function generateCertificateNumber(): string
    {
        do {
            $number = 'PD-' . now()->format('Ymd') . '-' . strtoupper(Str::random(6));
        } while (PedigreeCertificate::where('certificate_number', $number)->exists());

        return $number;
    }
}
