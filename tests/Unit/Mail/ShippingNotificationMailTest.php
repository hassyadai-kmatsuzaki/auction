<?php

namespace Tests\Unit\Mail;

use App\Mail\ShippingNotificationMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use Tests\TestCase;

/**
 * 発送通知メール。複数口（伝票番号が複数）でも 1 通にまとめ、全番号と追跡リンクを載せる。
 */
class ShippingNotificationMailTest extends TestCase
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
            'delivery_status' => 'shipped',
        ], $attrs))->fresh(['item', 'winner']);
    }

    public function test_複数伝票番号でも1通にまとめて全件と追跡リンクを載せる(): void
    {
        $attrs = ['shipping_company' => 'ヤマト運輸', 'tracking_number' => '1111-2222-3333,4444-5555-6666'];
        $w1 = $this->makeWonItem('幹之メダカ', $attrs);
        $this->makeWonItem('楊貴妃メダカ', $attrs);

        $mail = new ShippingNotificationMail($w1);
        $html = $mail->render();

        $this->assertCount(2, $mail->wonItems);
        $this->assertStringContainsString('幹之メダカ', $html);
        $this->assertStringContainsString('楊貴妃メダカ', $html);
        $this->assertStringContainsString('伝票番号（2件）', $html);
        $this->assertStringContainsString('1111-2222-3333', $html);
        $this->assertStringContainsString('4444-5555-6666', $html);
        $this->assertStringContainsString('pno=111122223333', $html);
        $this->assertStringContainsString('pno=444455556666', $html);
        $this->assertStringContainsString('複数口', $html);
    }

    public function test_単一伝票番号は従来どおり1行で表示する(): void
    {
        $w = $this->makeWonItem('幹之メダカ', ['shipping_company' => '佐川急便', 'tracking_number' => '1234-5678-9012']);

        $html = (new ShippingNotificationMail($w))->render();

        $this->assertStringContainsString('伝票番号', $html);
        $this->assertStringNotContainsString('伝票番号（', $html);
        $this->assertStringContainsString('1234-5678-9012', $html);
        $this->assertStringContainsString('okurijoNo=123456789012', $html);
    }
}
