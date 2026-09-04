<?php

namespace Tests\Unit\Mail;

use App\Mail\PaymentReminderMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * 入金催促メールの金額表示。
 *
 * won_items.total_amount は税抜（手数料込）なので、合計は請求書と同じく
 * 消費税を上乗せした税込額でなければならない（2026-09-02 報告の不具合）。
 */
class PaymentReminderMailTest extends TestCase
{
    private User $winner;
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->finished()->create(['created_by' => $admin->id]);
        $this->winner = $this->createParticipant();
    }

    private function makeWonItem(string $speciesName, array $attrs): WonItem
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => $speciesName,
        ]);

        return WonItem::factory()->create(array_merge([
            'item_id' => $item->id,
            'winner_id' => $this->winner->id,
            'payment_status' => 'pending',
            'payment_deadline' => now()->addHours(20),
        ], $attrs))->fresh(['item', 'winner']);
    }

    public function test_合計は消費税込みで明細は税抜として表示する(): void
    {
        // 5000×3 + 手数料1500 = 16500、送料 1500
        $w1 = $this->makeWonItem('幹之メダカ', [
            'winning_price' => 5000, 'quantity' => 3, 'commission_amount' => 1500, 'total_amount' => 16500, 'shipping_fee' => 1500,
        ]);
        // 5000×2 + 手数料1000 = 11000、送料なし
        $w2 = $this->makeWonItem('楊貴妃メダカ', [
            'winning_price' => 5000, 'quantity' => 2, 'commission_amount' => 1000, 'total_amount' => 11000, 'shipping_fee' => 0,
        ]);

        $html = (new PaymentReminderMail(collect([$w1, $w2]), '24時間以内'))->render();

        $this->assertStringContainsString('幹之メダカ', $html);
        $this->assertStringContainsString('¥16,500', $html);
        $this->assertStringContainsString('¥11,000', $html);
        $this->assertStringContainsString('金額（税抜）', $html);
        $this->assertStringContainsString('送料', $html);
        $this->assertStringContainsString('¥1,500', $html);
        // (16500 + 11000 + 1500) = 29000 → 税 2900 → 31900
        $this->assertStringContainsString('消費税（10%）', $html);
        $this->assertStringContainsString('¥2,900', $html);
        $this->assertStringContainsString('合計金額（税込）', $html);
        $this->assertStringContainsString('¥31,900', $html);
        // 税抜合計を合計として出さない
        $this->assertStringNotContainsString('¥29,000', $html);
        $this->assertStringContainsString('税抜金額', $html);
    }

    public function test_送料ゼロなら送料行を出さない(): void
    {
        $w = $this->makeWonItem('幹之メダカ', [
            'winning_price' => 1000, 'quantity' => 1, 'commission_amount' => 100, 'total_amount' => 1100, 'shipping_fee' => 0,
        ]);

        $html = (new PaymentReminderMail(collect([$w]), '1時間以内'))->render();

        $this->assertStringNotContainsString('>送料<', $html);
        // 1100 → 税 110 → 1210
        $this->assertStringContainsString('¥110', $html);
        $this->assertStringContainsString('¥1,210', $html);
    }
}
