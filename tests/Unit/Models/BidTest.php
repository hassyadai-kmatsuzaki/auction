<?php

namespace Tests\Unit\Models;

use App\Models\Bid;
use App\Models\Item;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Tests\TestCase;

/**
 * Bid モデルの Unit テスト。
 *
 * 注意: bids テーブルは drop_bids_table マイグレーションで削除されている
 * （bid_participants / bid_events に置換）。
 * そのためここでは DB 永続化を伴わないモデル定義（fillable / casts / リレーション）の
 * 構造的検証のみを行う。
 */
class BidTest extends TestCase
{
    public function test_fillable_に必要な属性が含まれる(): void
    {
        $bid = new Bid();

        $this->assertSame(
            ['item_id', 'user_id', 'price', 'is_active'],
            $bid->getFillable()
        );
    }

    public function test_is_active_は_boolean_キャストされる(): void
    {
        $bid = new Bid();
        $bid->is_active = 1;

        $this->assertTrue($bid->is_active);
        $this->assertIsBool($bid->is_active);
    }

    public function test_is_active_の0は_falseにキャストされる(): void
    {
        $bid = new Bid();
        $bid->is_active = 0;

        $this->assertFalse($bid->is_active);
        $this->assertIsBool($bid->is_active);
    }

    public function test_item_リレーションがItemへのbelongsToである(): void
    {
        $bid = new Bid();
        $relation = $bid->item();

        $this->assertInstanceOf(BelongsTo::class, $relation);
        $this->assertInstanceOf(Item::class, $relation->getRelated());
    }

    public function test_user_リレーションがUserへのbelongsToである(): void
    {
        $bid = new Bid();
        $relation = $bid->user();

        $this->assertInstanceOf(BelongsTo::class, $relation);
        $this->assertInstanceOf(User::class, $relation->getRelated());
    }

    public function test_mass_assignmentで属性が設定される(): void
    {
        $bid = new Bid([
            'item_id' => 1,
            'user_id' => 2,
            'price' => 12345.67,
            'is_active' => true,
        ]);

        $this->assertSame(1, $bid->item_id);
        $this->assertSame(2, $bid->user_id);
        $this->assertEquals(12345.67, $bid->price);
        $this->assertTrue($bid->is_active);
    }

    public function test_fillable外の属性は無視される(): void
    {
        $bid = new Bid([
            'price' => 100,
            'unknown_column' => 'malicious',
        ]);

        $this->assertEquals(100, $bid->price);
        $this->assertNull($bid->unknown_column);
    }
}
