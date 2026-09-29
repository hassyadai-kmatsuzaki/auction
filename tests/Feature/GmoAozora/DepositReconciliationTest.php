<?php

namespace Tests\Feature\GmoAozora;

use App\Models\Auction;
use App\Models\GmoDepositNotification;
use App\Models\GmoVirtualAccount;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\WonItem;
use App\Services\GmoAozora\GmoDepositReconciliationService;
use App\Services\InvoiceService;
use App\Services\NotificationService;
use Tests\TestCase;

/**
 * 入金明細 → 落札の入金消込（突合ルールと自動確認トグル）。
 */
class DepositReconciliationTest extends TestCase
{
    private User $admin;
    private User $winner;
    private Auction $auction;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->winner = $this->createParticipant();
        $this->auction = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);

        // 通知はモック（メール/LINE の実送信は対象外）
        $this->mock(NotificationService::class, function ($mock) {
            $mock->shouldReceive('sendPaymentConfirmedNotification')->andReturn(true);
        });

        config(['services.gmo_aozora.environment' => 'development']);
        // マイグレーションで投入済みのキーを ON にする
        SystemSetting::set('gmo_aozora_auto_confirm_payment', '1');
    }

    private function wonItem(Auction $auction, User $winner, int $price, int $commission, int $shipping = 0): WonItem
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        return WonItem::factory()->create([
            'item_id' => $item->id,
            'winner_id' => $winner->id,
            'winning_price' => $price,
            'quantity' => 1,
            'commission_amount' => $commission,
            'total_amount' => $price + $commission,
            'shipping_fee' => $shipping,
            'payment_status' => 'pending',
        ]);
    }

    private function va(?User $user): GmoVirtualAccount
    {
        return GmoVirtualAccount::create([
            'environment' => 'development', 'va_id' => '5021099622', 'branch_code' => '502',
            'account_number' => '1099622', 'holder_name_kana' => 'ﾃｽﾄ', 'status_code' => '1',
            'user_id' => $user?->id, 'assigned_at' => $user ? now() : null,
        ]);
    }

    private function notification(int $amount, string $vaId = '5021099622'): GmoDepositNotification
    {
        return GmoDepositNotification::create([
            'message_id' => 'msg-' . uniqid(), 'source' => 'webhook', 'va_id' => $vaId,
            'item_key' => '20260924175959112541', 'deposit_amount' => $amount,
            'transaction_date' => '2026-09-24', 'payload' => '{}', 'status' => 'received', 'received_at' => now(),
        ]);
    }

    public function test_exact_amount_confirms_group_and_records_bank_transfer(): void
    {
        $this->va($this->winner);
        $w1 = $this->wonItem($this->auction, $this->winner, 10000, 500, 700);
        $w2 = $this->wonItem($this->auction, $this->winner, 20000, 1000, 0);
        $expected = InvoiceService::buyerTotals(WonItem::with('item')->whereIn('id', [$w1->id, $w2->id])->get())['grand_total'];
        $this->assertSame((int) floor(32200 * 1.1), $expected);

        $n = $this->notification($expected);
        app(GmoDepositReconciliationService::class)->process($n);

        $n->refresh();
        $this->assertSame('confirmed', $n->status);
        $this->assertSame($this->winner->id, $n->matched_user_id);
        $this->assertEqualsCanonicalizing([$w1->id, $w2->id], $n->won_item_ids);
        $this->assertSame($expected, $n->expected_amount);
        $this->assertNull($n->confirmed_by);

        foreach ([$w1, $w2] as $w) {
            $w->refresh();
            $this->assertSame('confirmed', $w->payment_status);
            $this->assertSame('bank_transfer', $w->payment_method);
            $this->assertSame('2026-09-24', $w->paid_at->toDateString());
            $this->assertNotNull($w->payment_confirmed_at);
            $this->assertNotNull($w->shipping_locked_at);
            $this->assertSame('preparing', $w->delivery_status);
        }
    }

    public function test_amount_mismatch_is_left_unmatched_with_expected_amount(): void
    {
        $this->va($this->winner);
        $w = $this->wonItem($this->auction, $this->winner, 10000, 500);
        $n = $this->notification(9999);

        app(GmoDepositReconciliationService::class)->process($n);

        $n->refresh();
        $this->assertSame('unmatched', $n->status);
        $this->assertSame('amount_mismatch', $n->unmatched_reason);
        $this->assertSame($this->winner->id, $n->matched_user_id);
        $this->assertSame((int) floor(10500 * 1.1), $n->expected_amount);
        $this->assertSame('pending', $w->refresh()->payment_status);
    }

    public function test_unknown_or_unassigned_va_is_unmatched(): void
    {
        $n1 = $this->notification(1000, '9999999999');
        app(GmoDepositReconciliationService::class)->process($n1);
        $this->assertSame('no_va', $n1->refresh()->unmatched_reason);

        $this->va(null);
        $n2 = $this->notification(1000);
        app(GmoDepositReconciliationService::class)->process($n2);
        $this->assertSame('va_unassigned', $n2->refresh()->unmatched_reason);
    }

    public function test_no_open_items_is_unmatched(): void
    {
        $this->va($this->winner);
        $n = $this->notification(1000);
        app(GmoDepositReconciliationService::class)->process($n);
        $this->assertSame('no_open_items', $n->refresh()->unmatched_reason);
    }

    public function test_sum_of_all_open_auctions_matches_all_groups(): void
    {
        $this->va($this->winner);
        $other = Auction::factory()->finished()->create(['created_by' => $this->admin->id]);
        $w1 = $this->wonItem($this->auction, $this->winner, 10000, 500);
        $w2 = $this->wonItem($other, $this->winner, 5000, 300);
        $total = (int) floor(10500 * 1.1) + (int) floor(5300 * 1.1);

        $n = $this->notification($total);
        app(GmoDepositReconciliationService::class)->process($n);

        $this->assertSame('confirmed', $n->refresh()->status);
        $this->assertSame('confirmed', $w1->refresh()->payment_status);
        $this->assertSame('confirmed', $w2->refresh()->payment_status);
    }

    public function test_auto_confirm_off_leaves_matched_for_admin(): void
    {
        SystemSetting::set('gmo_aozora_auto_confirm_payment', '0');
        $this->va($this->winner);
        $w = $this->wonItem($this->auction, $this->winner, 10000, 500);
        $n = $this->notification((int) floor(10500 * 1.1));

        app(GmoDepositReconciliationService::class)->process($n);
        $this->assertSame('matched', $n->refresh()->status);
        $this->assertSame('pending', $w->refresh()->payment_status);

        // 管理者が確定
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/gmo-aozora/deposits/{$n->id}/confirm")
            ->assertStatus(200)->assertJson(['success' => true]);
        $this->assertSame('confirmed', $n->refresh()->status);
        $this->assertSame($this->admin->id, $n->confirmed_by);
        $this->assertSame('confirmed', $w->refresh()->payment_status);
    }

    public function test_process_is_idempotent(): void
    {
        $this->va($this->winner);
        $w = $this->wonItem($this->auction, $this->winner, 10000, 500);
        $n = $this->notification((int) floor(10500 * 1.1));
        $svc = app(GmoDepositReconciliationService::class);
        $svc->process($n);
        $first = $n->refresh()->confirmed_at;
        $svc->process($n);
        $this->assertEquals($first, $n->refresh()->confirmed_at);
        $this->assertSame('confirmed', $w->refresh()->payment_status);
    }

    public function test_admin_manual_match_confirms_and_assigns_va(): void
    {
        $this->va(null);
        $w = $this->wonItem($this->auction, $this->winner, 10000, 500);
        $n = $this->notification(11000);
        app(GmoDepositReconciliationService::class)->process($n);
        $this->assertSame('unmatched', $n->refresh()->status);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/gmo-aozora/deposits/{$n->id}/match", ['won_item_id' => $w->id])
            ->assertStatus(200)->assertJson(['success' => true]);

        $this->assertSame('confirmed', $n->refresh()->status);
        $this->assertSame($this->admin->id, $n->confirmed_by);
        $this->assertSame('confirmed', $w->refresh()->payment_status);
        $this->assertSame($this->winner->id, GmoVirtualAccount::where('va_id', '5021099622')->first()->user_id);
    }

    public function test_admin_confirm_payment_endpoint_still_works(): void
    {
        $w = $this->wonItem($this->auction, $this->winner, 10000, 500);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/won-items/{$w->id}/confirm-payment")
            ->assertStatus(200)->assertJson(['success' => true, 'data' => ['affected_count' => 1]]);
        $w->refresh();
        $this->assertSame('confirmed', $w->payment_status);
        $this->assertNull($w->payment_method);
        $this->assertNull($w->paid_at);
    }
}
