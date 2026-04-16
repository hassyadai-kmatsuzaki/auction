<?php

namespace App\Services;

use App\Models\Item;
use App\Models\PedigreeCertificate;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;

class PedigreeCertificateService
{
    /**
     * 血統証明書を作成
     */
    public function create(Item $item, int $issuedBy, array $data): PedigreeCertificate
    {
        return PedigreeCertificate::create([
            'item_id' => $item->id,
            'issued_by' => $issuedBy,
            'certificate_number' => $this->generateCertificateNumber(),
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
     * 血統証明書を発行（ステータスを issued に変更）
     */
    public function issue(PedigreeCertificate $certificate): void
    {
        $certificate->update([
            'status' => 'issued',
            'issued_at' => now(),
        ]);
    }

    /**
     * 血統証明書PDFを生成
     */
    public function generatePdf(PedigreeCertificate $certificate): \Barryvdh\DomPDF\PDF
    {
        $certificate->loadMissing(['item.media', 'issuer']);

        $data = [
            'certificate' => $certificate,
            'item' => $certificate->item,
            'issuer' => $certificate->issuer,
        ];

        $pdf = Pdf::loadView('pdf.pedigree-certificate', $data);
        $pdf->setPaper('A4', 'portrait');

        return $pdf;
    }

    /**
     * 証明書番号を生成
     */
    private function generateCertificateNumber(): string
    {
        $prefix = 'PD';
        $date = now()->format('Ymd');
        $random = strtoupper(Str::random(6));
        return "{$prefix}-{$date}-{$random}";
    }
}
