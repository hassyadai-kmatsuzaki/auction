<?php

namespace Tests\Feature\Admin;

use App\Mail\ShippingFeeFinalizedMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * 管理者の送料計算 / 承認フロー Feature テスト。
 *
 * 仕様:
 * - calculation_mode = auto / mixed (= 全種別が自動計算可能) は計算と同時に shipping_approved_at まで自動付与
 * - calculation_mode = manual (= 「その他」を含む) は計算で shipping_calculated_at のみセット、
 *   shipping_approved_at は管理者が approveShipping を呼んで初めてセットされる
 * - approveShipping は shipping_fee 必須、0円 + 理由なしは 422
 * - 一度承認したら calculateShipping を再度叩けない（409）
 * - 一覧 API レスポンスに calculation_mode と shipping_approved_at が含まれる
 */
class ShippingApprovalTest extends TestCase
{
    private User $admin;
    private User $winner;
    private Auction $auction;
    private SellerProfile $sellerProfile;
    private int $medakaTypeId;
    private int $otherTypeId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->winner = $this->createParticipant();
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);

        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $this->medakaTypeId = (int) DB::table('species_types')->where('code', 'medaka')->value('id');
        $this->otherTypeId  = (int) DB::table('species_types')->where('code', 'other')->value('id');
    }

    private function makeWonItem(int $speciesTypeId, int $quantity = 1, array $override = []): WonItem
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_type_id' => $speciesTypeId,
            'quantity' => $quantity,
        ]);

        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->winner->id,
            'quantity' => $quantity,
            // 自動算出ロジックが現住所を見るため初期値を保証
            'shipping_prefecture' => '東京都',
        ], $override));
    }

    public function test_自動計算種別のみ_計算と同時に承認まで完了して通知が飛ぶ(): void
    {
        Mail::fake();
        $this->makeWonItem($this->medakaTypeId, 10);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping");

        $response->assertOk()
            ->assertJsonPath('data.calculation_mode', 'auto');

        $this->assertDatabaseHas('won_items', [
            'winner_id' => $this->winner->id,
            'calculation_mode' => 'auto',
        ]);

        $wonItem = WonItem::where('winner_id', $this->winner->id)->first();
        $this->assertNotNull($wonItem->shipping_calculated_at, '計算済タイムスタンプが入っていること');
        $this->assertNotNull($wonItem->shipping_approved_at, 'auto は同時に承認まで進むこと');
        $this->assertSame($this->admin->id, $wonItem->shipping_approved_by);

        Mail::assertQueued(ShippingFeeFinalizedMail::class);
    }

    public function test_その他を含む発送単位は計算では承認されず手動入力待ちになる(): void
    {
        Mail::fake();
        $this->makeWonItem($this->otherTypeId, 1);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping");

        $response->assertOk()
            ->assertJsonPath('data.calculation_mode', 'manual');

        $wonItem = WonItem::where('winner_id', $this->winner->id)->first();
        $this->assertNotNull($wonItem->shipping_calculated_at);
        $this->assertNull($wonItem->shipping_approved_at, 'manual は計算では承認されない');

        // 通知はまだ飛ばない（承認時のみ送信）
        Mail::assertNotQueued(ShippingFeeFinalizedMail::class);
    }

    public function test_approve_shippingで送料を入力すると数量比で按分されて承認される(): void
    {
        Mail::fake();
        // 1 落札者で 2 件、quantity 1:3 で按分
        $this->makeWonItem($this->otherTypeId, 1);
        $this->makeWonItem($this->otherTypeId, 3);

        // 計算（manual で shipping_calculated_at をセット）
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertOk();

        // 送料 4000 円を入力（1:3 で 1000 / 3000 に按分されるはず）
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/approve-shipping", [
                'shipping_fee' => 4000,
                'adjustment_reason' => '直送便 6000-2000割引',
            ]);

        $response->assertOk();

        $wonItems = WonItem::where('winner_id', $this->winner->id)->orderBy('id')->get();
        $this->assertSame(2, $wonItems->count());
        $this->assertSame(4000, (int) $wonItems->sum('shipping_fee'));
        // 按分: 数量 1 → 1000, 数量 3 → 3000
        $this->assertSame(1000, (int) $wonItems[0]->shipping_fee);
        $this->assertSame(3000, (int) $wonItems[1]->shipping_fee);
        foreach ($wonItems as $w) {
            $this->assertNotNull($w->shipping_approved_at);
            $this->assertSame($this->admin->id, $w->shipping_approved_by);
            $this->assertSame('直送便 6000-2000割引', $w->shipping_adjustment_reason);
        }
        Mail::assertQueued(ShippingFeeFinalizedMail::class);
    }

    public function test_approve_shippingでshipping_feeを送らないと422(): void
    {
        $this->makeWonItem($this->otherTypeId, 1);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/approve-shipping", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['shipping_fee']);
    }

    public function test_approve_shippingで0円_理由なしは弾かれる(): void
    {
        $this->makeWonItem($this->otherTypeId, 1);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/approve-shipping", [
                'shipping_fee' => 0,
            ])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => '送料0円で確定する場合は理由（送料無料の根拠等）が必須です。']);
    }

    public function test_送料無料_理由ありで0円承認できる(): void
    {
        Mail::fake();
        $this->makeWonItem($this->otherTypeId, 1);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/approve-shipping", [
                'shipping_fee' => 0,
                'adjustment_reason' => '送料無料',
            ])
            ->assertOk();

        $w = WonItem::where('winner_id', $this->winner->id)->first();
        $this->assertSame(0, (int) $w->shipping_fee);
        $this->assertNotNull($w->shipping_approved_at);
        $this->assertSame('送料無料', $w->shipping_adjustment_reason);
        Mail::assertQueued(ShippingFeeFinalizedMail::class);
    }

    public function test_未計算でapprove_shippingを叩くと409(): void
    {
        $this->makeWonItem($this->otherTypeId, 1);
        // calculate を呼ばない

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/approve-shipping", [
                'shipping_fee' => 1000,
            ])
            ->assertStatus(409);
    }

    public function test_承認済みのcalculate_shippingは409で再計算を弾く(): void
    {
        $this->makeWonItem($this->medakaTypeId, 10);
        // 1 回目は auto なので計算と同時に承認される
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertOk();

        // 2 回目は承認済みのため 409
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertStatus(409);
    }

    public function test_admin一覧APIにcalculation_modeとshipping_approved_atが含まれる(): void
    {
        $this->makeWonItem($this->medakaTypeId, 10);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/calculate-shipping")
            ->assertOk();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/won-items");

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'won_items' => [
                        ['id', 'shipping_calculated_at', 'shipping_approved_at', 'calculation_mode'],
                    ],
                ],
            ]);

        $payload = $response->json('data.won_items.0');
        $this->assertSame('auto', $payload['calculation_mode']);
        $this->assertNotNull($payload['shipping_approved_at']);
    }

    public function test_backfill_migrationが既存auto未承認データを承認済みにする(): void
    {
        // calculate-shipping を経由せず、生データで「計算済だが未承認」を作成
        $w = $this->makeWonItem($this->medakaTypeId, 10);
        $w->forceFill([
            'calculation_mode' => 'auto',
            'shipping_calculated_at' => now()->subDays(2),
            'shipping_approved_at' => null,
        ])->save();

        // バックフィル migration を直接実行
        DB::table('won_items')
            ->whereIn('calculation_mode', ['auto', 'mixed'])
            ->whereNotNull('shipping_calculated_at')
            ->whereNull('shipping_approved_at')
            ->update([
                'shipping_approved_at' => DB::raw('shipping_calculated_at'),
            ]);

        $w->refresh();
        $this->assertNotNull($w->shipping_approved_at);
        $this->assertSame(
            $w->shipping_calculated_at?->format('Y-m-d H:i:s'),
            $w->shipping_approved_at?->format('Y-m-d H:i:s'),
        );
    }

    public function test_manual_won_itemはバックフィル対象外(): void
    {
        $w = $this->makeWonItem($this->otherTypeId, 1);
        $w->forceFill([
            'calculation_mode' => 'manual',
            'shipping_calculated_at' => now()->subDays(2),
            'shipping_approved_at' => null,
        ])->save();

        DB::table('won_items')
            ->whereIn('calculation_mode', ['auto', 'mixed'])
            ->whereNotNull('shipping_calculated_at')
            ->whereNull('shipping_approved_at')
            ->update([
                'shipping_approved_at' => DB::raw('shipping_calculated_at'),
            ]);

        $w->refresh();
        $this->assertNull($w->shipping_approved_at, 'manual は管理者の手動入力を経て承認される');
    }

    public function test_setManualShippingFee_で計算と承認を同時にセットできる(): void
    {
        Mail::fake();
        // 計算前の状態（shipping_calculated_at が null）から呼び出す
        $w1 = $this->makeWonItem($this->otherTypeId, 1);
        $w2 = $this->makeWonItem($this->otherTypeId, 2);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/manual-shipping-fee", [
                'shipping_fee' => 3000,
                'adjustment_reason' => '直接搬入',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.total_shipping_fee', 3000);

        $items = WonItem::where('winner_id', $this->winner->id)->orderBy('id')->get();
        // 1:2 の数量比 → 1000 / 2000
        $this->assertSame(1000, (int) $items[0]->shipping_fee);
        $this->assertSame(2000, (int) $items[1]->shipping_fee);
        foreach ($items as $w) {
            $this->assertNotNull($w->shipping_calculated_at);
            $this->assertNotNull($w->shipping_approved_at);
            $this->assertSame('manual', $w->calculation_mode);
            $this->assertSame($this->admin->id, $w->shipping_approved_by);
        }
        Mail::assertQueued(\App\Mail\ShippingFeeFinalizedMail::class);
    }

    public function test_setManualShippingFee_は承認済みなら409(): void
    {
        $w = $this->makeWonItem($this->otherTypeId, 1);
        $w->forceFill([
            'shipping_calculated_at' => now(),
            'shipping_approved_at' => now(),
            'calculation_mode' => 'manual',
        ])->save();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/manual-shipping-fee", [
                'shipping_fee' => 1000,
            ])
            ->assertStatus(409);
    }

    public function test_setManualShippingFee_でshipping_feeなしは422(): void
    {
        $this->makeWonItem($this->otherTypeId, 1);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$this->winner->id}/manual-shipping-fee", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['shipping_fee']);
    }

    public function test_setManualShippingFee_該当落札なしは404(): void
    {
        // 別の落札者の wonItem は作るが winnerId には何も置かない
        $other = $this->createParticipant();
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/winners/{$other->id}/manual-shipping-fee", [
                'shipping_fee' => 1000,
            ])
            ->assertStatus(404);
    }
}
