<?php

namespace Tests\Unit\Services;

use App\Models\SpeciesType;
use App\Services\ShippingCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * ShippingCalculatorService のリグレッションテスト。
 *
 * マイグレーションと初期シードで投入された「メダカ」マスタを使い、
 * 旧ロジック相当の計算結果が得られること、および種別分岐（auto/manual/mixed）
 * の挙動を検証する。
 */
class ShippingCalculatorServiceTest extends TestCase
{
    use RefreshDatabase;

    private int $medakaId;
    private int $otherId;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->medakaId = (int) DB::table('species_types')->where('code', 'medaka')->value('id');
        $this->otherId = (int) DB::table('species_types')->where('code', 'other')->value('id');
    }

    /** @test */
    public function 都道府県から地域への変換が動く(): void
    {
        $calculator = new ShippingCalculatorService();
        $this->assertSame('関東', $calculator->getRegionByPrefecture('東京都'));
        $this->assertSame('関西', $calculator->getRegionByPrefecture('大阪府'));
    }

    /** @test */
    public function getRegionByPrefecture_は_都道府県の接尾辞を許容する(): void
    {
        $calculator = new ShippingCalculatorService();
        // 「東京都」と「東京」のどちらでも引ける
        $this->assertSame($calculator->getRegionByPrefecture('東京都'), $calculator->getRegionByPrefecture('東京'));
        $this->assertSame($calculator->getRegionByPrefecture('北海道'), $calculator->getRegionByPrefecture('北海'));
    }

    /** @test */
    public function getRegionByPrefecture_は_未知の県を_null_で返す(): void
    {
        $calculator = new ShippingCalculatorService();
        $this->assertNull($calculator->getRegionByPrefecture('未知の県'));
    }

    /** @test */
    public function apportionFee_は_数量0件で空配列を返す(): void
    {
        $this->assertSame([], ShippingCalculatorService::apportionFee(1000, []));
    }

    /** @test */
    public function apportionFee_は_数量比に従って按分し誤差を最後の要素に寄せる(): void
    {
        // 1000 を 1:3 で按分 → 250 / 750
        $this->assertSame([250, 750], ShippingCalculatorService::apportionFee(1000, [1, 3]));

        // 1000 を 1:1:1 で按分 → 333,333,334（端数寄せ）
        $result = ShippingCalculatorService::apportionFee(1000, [1, 1, 1]);
        $this->assertSame(1000, array_sum($result));
        $this->assertCount(3, $result);

        // 0 円は全員 0
        $this->assertSame([0, 0], ShippingCalculatorService::apportionFee(0, [2, 3]));
    }

    /** @test */
    public function apportionFee_は_数量合計0なら均等割で誤差を末尾に寄せる(): void
    {
        // 1000 を quantity=0,0,0 で按分 → 333/333/334
        $result = ShippingCalculatorService::apportionFee(1000, [0, 0, 0]);
        $this->assertSame(1000, array_sum($result));
        $this->assertSame(333, $result[0]);
        $this->assertSame(333, $result[1]);
        $this->assertSame(334, $result[2]);
    }

    /** @test */
    public function apportionFee_は_負端数を含めても合計を維持する(): void
    {
        // 100 を 1:2:3:4:5:6 で按分 → 合計 100 を維持
        $result = ShippingCalculatorService::apportionFee(100, [1, 2, 3, 4, 5, 6]);
        $this->assertSame(100, array_sum($result));
        $this->assertCount(6, $result);
    }

    /** @test */
    public function メダカ単独_少量_関東_S袋1個80号箱(): void
    {
        $calculator = new ShippingCalculatorService();
        $result = $calculator->calculate(
            [['quantity' => 10, 'species_type_id' => $this->medakaId]],
            '関東'
        );

        $this->assertSame('auto', $result['calculation_mode']);
        $this->assertCount(1, $result['boxes']);
        $this->assertSame(80, $result['boxes'][0]['box_size']);
        // 関東80号 = 704, 資材(80号) = 250+50 = 300 → 合計 1004
        $this->assertSame(704, $result['shipping_cost']);
        $this->assertSame(300, $result['packing_material_cost']);
        $this->assertSame(1004, $result['total_shipping_fee']);
    }

    /** @test */
    public function v5_メダカ単独_中量50匹_関東_M袋1個_80号箱単独(): void
    {
        // v5: M袋は単位2、80箱は単位上限2＋重量5kg以内なので 80号単独で済む
        $calculator = new ShippingCalculatorService();
        $result = $calculator->calculate(
            [['quantity' => 50, 'species_type_id' => $this->medakaId]],
            '関東'
        );

        $this->assertSame('auto', $result['calculation_mode']);
        $this->assertSame(80, $result['boxes'][0]['box_size']);
        $this->assertSame(704, $result['shipping_cost']);
        $this->assertSame(300, $result['packing_material_cost']);
        $this->assertSame(1004, $result['total_shipping_fee']);
    }

    /** @test */
    public function v5_メダカ単独_最大100匹_L袋1個_80号箱特例で1004円(): void
    {
        // v5: 100匹は L袋(単位3)、80箱の単位上限2を超えるが L×1単独特例で許可
        $calculator = new ShippingCalculatorService();
        $result = $calculator->calculate(
            [['quantity' => 100, 'species_type_id' => $this->medakaId]],
            '関東'
        );

        $this->assertSame('auto', $result['calculation_mode']);
        $this->assertSame(80, $result['boxes'][0]['box_size']);
        $this->assertSame(1004, $result['total_shipping_fee']);
    }

    /** @test */
    public function v5_メダカ_S袋とM袋は100号箱で同梱可能(): void
    {
        // v5: S(単位1)+M(単位2) = 単位3 ≤ 100号箱(上限7)、重量3.5kg ≤ 10kg → 同梱OK
        $calculator = new ShippingCalculatorService();
        $result = $calculator->calculate(
            [
                ['quantity' => 10, 'species_type_id' => $this->medakaId],  // S×1
                ['quantity' => 50, 'species_type_id' => $this->medakaId],  // M×1
            ],
            '関東'
        );

        $this->assertSame(1, count($result['boxes']));
        $this->assertSame(100, $result['boxes'][0]['box_size']);
        $this->assertSame(1197, $result['total_shipping_fee']);
    }

    /** @test */
    public function その他を含むと_manual_モードで返る(): void
    {
        $calculator = new ShippingCalculatorService();
        $result = $calculator->calculate(
            [
                ['quantity' => 10, 'species_type_id' => $this->medakaId],
                ['quantity' => 1,  'species_type_id' => $this->otherId],
            ],
            '関東'
        );

        $this->assertSame('manual', $result['calculation_mode']);
        $this->assertNull($result['total_shipping_fee']);
        $this->assertEmpty($result['boxes']);
        $this->assertNotEmpty($result['species_breakdown']);
    }

    /** @test */
    public function species_type_id未指定ならデフォルト_メダカ_で計算される(): void
    {
        $calculator = new ShippingCalculatorService();
        $result = $calculator->calculate([['quantity' => 10]], '関東');

        $this->assertSame('auto', $result['calculation_mode']);
        $this->assertSame(1004, $result['total_shipping_fee']);
    }

    /** @test */
    public function 按分_端数は末尾要素で吸収され合計が一致する(): void
    {
        $apportioned = ShippingCalculatorService::apportionFee(1000, [1, 1, 1]);
        $this->assertSame(1000, array_sum($apportioned));
        $this->assertCount(3, $apportioned);
    }

    /** @test */
    public function 按分_数量ゼロ配列でも合計が一致する(): void
    {
        $apportioned = ShippingCalculatorService::apportionFee(500, [0, 0, 0]);
        $this->assertSame(500, array_sum($apportioned));
    }
}
