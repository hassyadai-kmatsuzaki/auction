<?php

namespace App\Console\Commands;

use App\Services\InvoiceTaxResolver;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * 出品者支払通知書の税計算ロジックを DB を使わずにシミュレートする。
 *
 * 使い方:
 *   php artisan invoice:simulate-tax                                # 仕様書 §6 のケース1〜5を一括表示
 *   php artisan invoice:simulate-tax --date=2026-05-18 --winning=150950 --commission=15095
 *   php artisan invoice:simulate-tax --date=2027-01-15 --winning=10005 --commission=1001 --taxable
 *
 * オプション:
 *   --date       基準日（auction.event_date 相当, YYYY-MM-DD）。省略時 2026-05-18
 *   --winning    落札金額（税抜）
 *   --commission 手数料（税抜）
 *   --taxable    課税事業者（インボイス登録あり）として計算
 *
 * 本番では:
 *   sudo -u ec2-user php artisan invoice:simulate-tax
 */
class SimulateInvoiceTaxCommand extends Command
{
    protected $signature = 'invoice:simulate-tax
                            {--date= : 基準日 (auction.event_date) YYYY-MM-DD}
                            {--winning= : 落札金額（税抜）}
                            {--commission= : 手数料（税抜）}
                            {--taxable : 課税事業者として計算}';

    protected $description = '出品者支払通知書の税計算ロジックを検算（仕様書 §6 ケース1〜5）';

    public function handle(): int
    {
        if ($this->option('date') || $this->option('winning') || $this->option('commission')) {
            return $this->runSingle();
        }
        return $this->runSpecCases();
    }

    private function runSingle(): int
    {
        $date = $this->option('date') ?? '2026-05-18';
        $winning = (int) ($this->option('winning') ?? 150950);
        $commission = (int) ($this->option('commission') ?? 15095);
        $taxable = (bool) $this->option('taxable');

        $this->renderHeader();
        $this->renderCase('カスタム', $date, $winning, $commission, $taxable);
        return self::SUCCESS;
    }

    private function runSpecCases(): int
    {
        $this->renderHeader();
        // 仕様書 §6 のテストケース1〜5 を順に検算
        $this->renderCase('ケース1: 80%期', '2026-05-18', 150950, 15095, false, 146422);
        $this->renderCase('ケース2: 50%期', '2027-01-15', 150950, 15095, false, 141893);
        $this->renderCase('ケース3: 0%期',  '2030-01-15', 150950, 15095, false, 134346);
        $this->renderCase('ケース4: 端数(80%期)', '2026-05-18', 10005, 1001, false, 9704);
        $this->renderCase('ケース5: 課税事業者', '2026-05-18', 150950, 15095, true, 149441);
        return self::SUCCESS;
    }

    private function renderHeader(): void
    {
        $this->line('');
        $this->info('===== 出品者支払通知書 税計算シミュレーション =====');
        $this->line('（落札金額側のみ免税事業者は経過措置率、手数料は常に 10%）');
        $this->line('');
    }

    private function renderCase(
        string $label,
        string $dateStr,
        int $winning,
        int $commission,
        bool $isTaxable,
        ?int $expectedNet = null,
    ): void {
        $basis = Carbon::parse($dateStr);

        // resolver を使わず、設定を直接読んで純粋計算（DB非依存にするため）
        $taxMeta = $this->pureResolve($basis, $isTaxable);
        $winningTaxRate = $taxMeta['winning_tax_rate'];
        $commissionTaxRate = $taxMeta['commission_tax_rate'];

        $taxWinning = (int) floor($winning * $winningTaxRate / 100);
        $taxCommission = (int) floor($commission * $commissionTaxRate / 100);
        $totalWinningWithTax = $winning + $taxWinning;
        $totalCommissionWithTax = $commission + $taxCommission;
        $netAmount = $totalWinningWithTax - $totalCommissionWithTax;

        $modeLabel = $isTaxable ? '課税事業者' : '免税事業者';
        $transitionStr = $taxMeta['transition_rate'] !== null
            ? sprintf('経過措置 %s%%', $this->fmt($taxMeta['transition_rate'] * 100))
            : '—';

        $this->line(sprintf('▼ %s （%s / 基準日 %s / %s）',
            $label, $modeLabel, $basis->toDateString(), $transitionStr));

        $rows = [
            ['落札金額（税抜）',            '¥' . number_format($winning)],
            [sprintf('  消費税%s（%s%%）',
                $isTaxable ? '' : '相当額',
                $this->fmt($winningTaxRate)),
                '¥' . number_format($taxWinning)],
            ['  落札金額（税込相当）',       '¥' . number_format($totalWinningWithTax)],
            ['手数料（税抜）',              '¥' . number_format($commission)],
            [sprintf('  消費税（%s%%）', $this->fmt($commissionTaxRate)),
                '¥' . number_format($taxCommission)],
            ['  手数料（税込）',            '¥' . number_format($totalCommissionWithTax)],
            ['お振込み額',                  '¥' . number_format($netAmount)],
        ];
        $this->table(['項目', '金額'], $rows);

        if ($expectedNet !== null) {
            if ($netAmount === $expectedNet) {
                $this->info(sprintf('  ✓ 仕様書の期待値 ¥%s と一致', number_format($expectedNet)));
            } else {
                $this->error(sprintf('  ✗ 仕様書の期待値 ¥%s と不一致（差分 %d）',
                    number_format($expectedNet), $netAmount - $expectedNet));
            }
        }
        $this->line('');
    }

    /**
     * config/invoice_transition_rates から区間を探す純粋関数。
     * InvoiceTaxResolver と同じロジックだが、Auction/SellerProfile モデルなしで動かせる。
     *
     * @return array{winning_tax_rate: float, commission_tax_rate: float, transition_rate: float|null}
     */
    private function pureResolve(Carbon $basisDate, bool $isTaxable): array
    {
        $commissionTaxRate = (float) (config('app.fallback_tax_rate') ?? 10);
        // SystemSetting に値があればそちらを優先（DBが使える環境のみ）
        try {
            if (class_exists(\App\Models\SystemSetting::class)) {
                $val = \App\Models\SystemSetting::get('tax_rate', null);
                if ($val !== null) {
                    $commissionTaxRate = (float) $val;
                }
            }
        } catch (\Throwable $e) {
            // DB 未接続でも動かせるようにフォールバック
        }

        if ($isTaxable) {
            return [
                'winning_tax_rate' => $commissionTaxRate,
                'commission_tax_rate' => $commissionTaxRate,
                'transition_rate' => null,
            ];
        }

        $basis = $basisDate->copy()->startOfDay();
        foreach ((array) config('invoice_transition_rates.rates', []) as $row) {
            $start = isset($row['start_date']) ? Carbon::parse($row['start_date'])->startOfDay() : null;
            $end = isset($row['end_date']) && $row['end_date'] !== null
                ? Carbon::parse($row['end_date'])->startOfDay() : null;
            if ($start !== null && $basis->lt($start)) continue;
            if ($end !== null && $basis->gt($end)) continue;
            return [
                'winning_tax_rate' => (float) $row['winning_tax_rate'],
                'commission_tax_rate' => $commissionTaxRate,
                'transition_rate' => (float) $row['transition_rate'],
            ];
        }
        // 区間外フォールバック（通常消費税）
        return [
            'winning_tax_rate' => $commissionTaxRate,
            'commission_tax_rate' => $commissionTaxRate,
            'transition_rate' => null,
        ];
    }

    private function fmt(float $rate): string
    {
        return rtrim(rtrim(number_format($rate, 2), '0'), '.');
    }
}
