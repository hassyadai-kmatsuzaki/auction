<?php

namespace Tests\Unit\Services;

use App\Services\ShippingCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * 配送料金 v5 仕様（2026-05-15）境界テスト。
 *
 * 仕様書 §6 の 11 例をそのまま実装。期待値は全て「関東」配送先。
 *
 *  | # | 注文                       | 袋構成      | 箱構成               | 関東合計 |
 *  |---|----------------------------|-------------|----------------------|----------|
 *  | 1 | 1出品 1匹                  | S×1         | 80×1                 | ¥1,004   |
 *  | 2 | 1出品 20匹                 | S×1         | 80×1                 | ¥1,004   |
 *  | 3 | 1出品 50匹                 | M×1         | 80×1                 | ¥1,004   |
 *  | 4 | 1出品 100匹                | L×1         | 80×1（特例）         | ¥1,004   |
 *  | 5 | 2出品 10+80                | S+L         | 100×1                | ¥1,197   |
 *  | 6 | 2出品 15+30                | S+M         | 100×1                | ¥1,197   |
 *  | 7 | 2出品 40+40                | M×2         | 100×1                | ¥1,197   |
 *  | 8 | 5出品×100                  | L×5         | 140×1 + 80×1（特例） | ¥2,774   |
 *  | 9 | 10出品×20                  | S×10        | 140×1                | ¥1,770   |
 *  | 10| 13出品×20                  | S×13        | 140×1                | ¥1,770   |
 *  | 11| 6出品×30 + 1出品×20        | M×6 + S×1   | 140×1                | ¥1,770   |
 */
class ShippingCalculatorServiceV5Test extends TestCase
{
    use RefreshDatabase;

    private int $medakaId;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->medakaId = (int) DB::table('species_types')->where('code', 'medaka')->value('id');
    }

    private function items(int ...$quantities): array
    {
        return array_map(
            fn ($q) => ['quantity' => $q, 'species_type_id' => $this->medakaId],
            $quantities
        );
    }

    /** @test */
    public function v5_case01_1出品1匹_S袋1個_80箱1個_関東1004円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(1), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(80, $r['boxes'][0]['box_size']);
        $this->assertSame(1004, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case02_1出品20匹_S袋1個_80箱1個_関東1004円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(20), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(80, $r['boxes'][0]['box_size']);
        $this->assertSame(1004, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case03_1出品50匹_M袋1個_80箱1個_関東1004円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(50), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(80, $r['boxes'][0]['box_size']);
        $this->assertSame(1004, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case04_1出品100匹_L袋1個_80箱単独特例で関東1004円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(100), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(80, $r['boxes'][0]['box_size']);
        $this->assertSame(1004, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case05_2出品_S袋とL袋_100箱に同梱_関東1197円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(10, 80), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(100, $r['boxes'][0]['box_size']);
        $this->assertSame(1197, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case06_2出品_S袋とM袋_100箱に同梱_関東1197円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(15, 30), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(100, $r['boxes'][0]['box_size']);
        $this->assertSame(1197, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case07_2出品_M袋2個_100箱_関東1197円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(40, 40), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(100, $r['boxes'][0]['box_size']);
        $this->assertSame(1197, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case08_5出品100匹_L袋5個_140箱と80箱特例_関東2774円(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(100, 100, 100, 100, 100), '関東');

        $boxSizes = array_map(fn ($b) => $b['box_size'], $r['boxes']);
        sort($boxSizes);
        $this->assertSame([80, 140], $boxSizes);
        $this->assertSame(2774, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case09_10出品20匹_S袋10個_140箱単独が最安_関東1770円(): void
    {
        $r = (new ShippingCalculatorService())->calculate(
            $this->items(20, 20, 20, 20, 20, 20, 20, 20, 20, 20),
            '関東'
        );

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(140, $r['boxes'][0]['box_size']);
        $this->assertSame(1770, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case10_13出品20匹_S袋13個_140箱満杯_関東1770円(): void
    {
        $items = array_fill(0, 13, 20);
        $r = (new ShippingCalculatorService())->calculate($this->items(...$items), '関東');

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(140, $r['boxes'][0]['box_size']);
        $this->assertSame(1770, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_case11_M袋6個とS袋1個_140箱満杯_関東1770円(): void
    {
        // M×6（30匹×6）+ S×1（20匹×1）= 単位 13、重量 13.5kg
        $r = (new ShippingCalculatorService())->calculate(
            $this->items(30, 30, 30, 30, 30, 30, 20),
            '関東'
        );

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(140, $r['boxes'][0]['box_size']);
        $this->assertSame(1770, $r['total_shipping_fee']);
    }

    // ──────────────────────────────────────────────────────────────
    // 補助テスト：地域別料金と特例まわり
    // ──────────────────────────────────────────────────────────────

    /** @test */
    public function v5_沖縄向けは送料が高い(): void
    {
        $r = (new ShippingCalculatorService())->calculate($this->items(10), '沖縄');

        $this->assertSame(80, $r['boxes'][0]['box_size']);
        // 沖縄80 = ¥1,573 + 資材 ¥300 = ¥1,873
        $this->assertSame(1873, $r['total_shipping_fee']);
    }

    /** @test */
    public function v5_100箱と140箱の混在が必要なケースで全パターン探索される(): void
    {
        // L×3 + M×2: 単位 3×3 + 2×2 = 13, 重量 4.5×3 + 2×2 = 17.5kg
        // → 140×1 単独で収まる（単位 13 == 上限）
        $r = (new ShippingCalculatorService())->calculate(
            $this->items(80, 80, 80, 40, 40),
            '関東'
        );

        $this->assertCount(1, $r['boxes']);
        $this->assertSame(140, $r['boxes'][0]['box_size']);
        $this->assertSame(1770, $r['total_shipping_fee']);
    }
}
