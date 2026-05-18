<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\SellerProfile;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * 出品者支払通知書・精算詳細の消費税率を解決する。
 *
 * 落札金額の税率は、出品者が免税事業者（インボイス未登録）の場合のみ
 * 経過措置率に応じて変動する（8% / 5% / 0%）。
 * 手数料の税率は常に SystemSetting::tax_rate（既定 10%）を使う。
 *
 * 免税判定: seller_profiles.business_registration_number が
 * `T` + 13桁の数字（半角スペース・ハイフン除去後）に一致しなければ免税扱い。
 *
 * 基準日: auctions.event_date を採用。null または config 区間外の場合は
 * 通常消費税（手数料と同率）にフォールバックする。
 */
class InvoiceTaxResolver
{
    /**
     * 落札金額側の税率と免税メタを返す。
     *
     * @return array{
     *   is_tax_exempt: bool,
     *   winning_tax_rate: float,
     *   commission_tax_rate: float,
     *   transition_rate: float|null,
     *   basis_date: string|null,
     * }
     */
    public function resolve(Auction $auction, SellerProfile $seller): array
    {
        $commissionTaxRate = (float) SystemSetting::get('tax_rate', 10);
        $isTaxExempt = $this->isTaxExempt($seller);
        $basisDate = $auction->event_date instanceof CarbonInterface
            ? $auction->event_date
            : ($auction->event_date ? Carbon::parse($auction->event_date) : null);

        if (!$isTaxExempt) {
            return [
                'is_tax_exempt'      => false,
                'winning_tax_rate'   => $commissionTaxRate,
                'commission_tax_rate' => $commissionTaxRate,
                'transition_rate'    => null,
                'basis_date'         => $basisDate?->toDateString(),
            ];
        }

        $row = $this->findTransitionRow($basisDate);
        if ($row === null) {
            // 区間外（基準日未設定 or 設定漏れ）: 安全側で通常消費税にフォールバック
            return [
                'is_tax_exempt'      => true,
                'winning_tax_rate'   => $commissionTaxRate,
                'commission_tax_rate' => $commissionTaxRate,
                'transition_rate'    => null,
                'basis_date'         => $basisDate?->toDateString(),
            ];
        }

        return [
            'is_tax_exempt'      => true,
            'winning_tax_rate'   => (float) $row['winning_tax_rate'],
            'commission_tax_rate' => $commissionTaxRate,
            'transition_rate'    => (float) $row['transition_rate'],
            'basis_date'         => $basisDate?->toDateString(),
        ];
    }

    /**
     * `T` + 13桁の登録番号フォーマットを満たさなければ免税事業者とみなす。
     * 空白・ハイフンは正規化して比較する。
     */
    public function isTaxExempt(SellerProfile $seller): bool
    {
        $raw = (string) ($seller->business_registration_number ?? '');
        $normalized = preg_replace('/[\s\-]/u', '', $raw);
        return !preg_match('/^T\d{13}$/', (string) $normalized);
    }

    /**
     * config/invoice_transition_rates から基準日を含む区間を探す。
     */
    private function findTransitionRow(?CarbonInterface $basisDate): ?array
    {
        if ($basisDate === null) {
            return null;
        }
        $basis = $basisDate->copy()->startOfDay();

        foreach ((array) config('invoice_transition_rates.rates', []) as $row) {
            $start = isset($row['start_date']) ? Carbon::parse($row['start_date'])->startOfDay() : null;
            $end = isset($row['end_date']) && $row['end_date'] !== null
                ? Carbon::parse($row['end_date'])->startOfDay()
                : null;

            if ($start !== null && $basis->lt($start)) {
                continue;
            }
            if ($end !== null && $basis->gt($end)) {
                continue;
            }
            return $row;
        }
        return null;
    }
}
