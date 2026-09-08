<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\WonItem;
use App\Services\LineFlexBuilder;
use Tests\TestCase;

/**
 * LineFlexBuilder の Unit テスト。
 *
 * 各通知種別が正しい構造の Flex Message bubble を返すことを確認する。
 * すべてのメソッドはピュアな配列構築なので I/O はない（DB のリレーションのみ）。
 */
class LineFlexBuilderTest extends TestCase
{
    private LineFlexBuilder $builder;
    private User $admin;
    private SellerProfile $sellerProfile;
    private Auction $auction;
    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->builder = new LineFlexBuilder();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => '幹之メダカ',
        ]);
    }

    private function makeWonItem(array $override = []): WonItem
    {
        return WonItem::factory()->create(array_merge([
            'item_id' => $this->item->id,
            'winner_id' => $this->createParticipant()->id,
            'winning_price' => 5000,
            'quantity' => 3,
            // 通知の金額は winning_price × quantity + commission_amount（請求書と同じ基準）
            'commission_amount' => 1500,
            'total_amount' => 16500,
        ], $override))->fresh('item');
    }

    private function assertBubble(array $bubble): void
    {
        $this->assertSame('bubble', $bubble['type']);
        $this->assertArrayHasKey('body', $bubble);
        $this->assertSame('box', $bubble['body']['type']);
    }

    public function test_wonItem_は_落札通知_bubbleを生成(): void
    {
        $bubble = $this->builder->wonItem($this->makeWonItem());
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('落札おめでとう', $contents);
        $this->assertStringContainsString('幹之メダカ', $contents);
        $this->assertStringContainsString('¥5,000', $contents);
        // 落札時点の合計は税抜（手数料込）。「税込」と誤表示しない
        $this->assertStringContainsString('¥16,500（税抜・手数料込）', $contents);
        $this->assertStringNotContainsString('（税込）', $contents);
    }

    public function test_paymentConfirmed_は_入金確認通知_bubbleを生成(): void
    {
        $bubble = $this->builder->paymentConfirmed($this->makeWonItem());
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('入金が確認', $contents);
        // A-10 (2026-09-08): 弊社預かり・弊社発送モデルへの移行で「発送準備中」の文言は廃止済み。
        // 現行の本文（ご入金ありがとうございました）で検証する。
        $this->assertStringContainsString('ご入金ありがとうございました', $contents);
    }

    public function test_shippingCompleted_は_運送会社と追跡番号を含む(): void
    {
        $w = $this->makeWonItem([
            'shipping_company' => 'ヤマト運輸',
            'tracking_number' => '1234-5678-9012',
        ]);
        $bubble = $this->builder->shippingCompleted($w);
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('発送が完了', $contents);
        $this->assertStringContainsString('ヤマト運輸', $contents);
        $this->assertStringContainsString('1234-5678-9012', $contents);
    }

    public function test_shippingCompleted_は_運送会社未設定でも生成できる(): void
    {
        $bubble = $this->builder->shippingCompleted($this->makeWonItem());
        $this->assertBubble($bubble);
    }

    /**
     * 複数口の発送は 1 バブルにまとめ、伝票番号を全件列挙する（2026-09-02 中北さん依頼）。
     */
    public function test_shippingCompleted_は_複数伝票番号と複数生体を1バブルに集約する(): void
    {
        $attrs = ['shipping_company' => 'ヤマト運輸', 'tracking_number' => '1111-2222-3333,4444-5555-6666'];
        $w1 = $this->makeWonItem($attrs);
        // won_items.item_id は一意なので 2 件目は別の生体を用意する
        $item2 = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => '楊貴妃メダカ',
        ]);
        $w2 = $this->makeWonItem(array_merge($attrs, ['item_id' => $item2->id, 'winner_id' => $w1->winner_id]));

        $bubble = $this->builder->shippingCompleted($w1, collect([$w1, $w2]));
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('生体（2点）', $contents);
        $this->assertStringContainsString('伝票番号（2件）', $contents);
        $this->assertStringContainsString('1111-2222-3333', $contents);
        $this->assertStringContainsString('4444-5555-6666', $contents);
        // 複数件のときは特定生体の hero 画像を出さない
        $this->assertArrayNotHasKey('hero', $bubble);
    }

    public function test_bidLimitReached_は_上限価格と現在価格を含む(): void
    {
        $bubble = $this->builder->bidLimitReached('楊貴妃メダカ', 30000, 28000);
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('上限価格に到達', $contents);
        $this->assertStringContainsString('楊貴妃メダカ', $contents);
        $this->assertStringContainsString('¥30,000', $contents);
        $this->assertStringContainsString('¥28,000', $contents);
    }

    public function test_auctionStart_は_オークションタイトルを含む(): void
    {
        $bubble = $this->builder->auctionStart($this->auction);
        $this->assertBubble($bubble);
        $this->assertStringContainsString($this->auction->title, json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public function test_newAuction_は_audience別に切り替わる(): void
    {
        $forParticipant = $this->builder->newAuction($this->auction, 'participant');
        $forSeller = $this->builder->newAuction($this->auction, 'seller');
        $this->assertBubble($forParticipant);
        $this->assertBubble($forSeller);
        // 文言が違うことだけ確認
        $this->assertNotSame(json_encode($forParticipant), json_encode($forSeller));
    }

    public function test_favoriteApproaching_は_順番情報を含む(): void
    {
        $bubble = $this->builder->favoriteApproaching($this->auction->id, '紅薊メダカ', 3, 'A レーン', $this->auction->title);
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('紅薊メダカ', $contents);
        $this->assertStringContainsString('A レーン', $contents);
    }

    public function test_paymentReminder_は_緊急度文言を含む(): void
    {
        $bubble = $this->builder->paymentReminder(collect([$this->makeWonItem()]), '24時間前');
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('24時間前', $contents);
        $this->assertStringContainsString('幹之メダカ', $contents);
        // 1件のときは「対象 n 件」行を出さない
        $this->assertStringNotContainsString('"対象"', $contents);
    }

    public function test_paymentReminder_は_複数件を1バブルに集約し合計を出す(): void
    {
        $winner = $this->createParticipant();
        $item2 = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name' => '楊貴妃メダカ',
        ]);
        // 5000×3 + 手数料1500 = 16500（税抜）、送料 1500
        $w1 = $this->makeWonItem(['winner_id' => $winner->id, 'total_amount' => 16500, 'shipping_fee' => 1500]);
        // 5000×2 + 手数料1000 = 11000（税抜）、送料なし
        $w2 = $this->makeWonItem([
            'winner_id' => $winner->id,
            'item_id' => $item2->id,
            'quantity' => 2,
            'commission_amount' => 1000,
            'total_amount' => 11000,
            'shipping_fee' => 0,
        ]);

        $bubble = $this->builder->paymentReminder(collect([$w1, $w2]), '1時間以内');
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $this->assertStringContainsString('2 件', $contents);
        $this->assertStringContainsString('幹之メダカ', $contents);
        $this->assertStringContainsString('楊貴妃メダカ', $contents);
        $this->assertStringContainsString('¥16,500', $contents);
        $this->assertStringContainsString('¥11,000', $contents);
        // 送料行 + 消費税行 + 税込合計: (16500 + 11000 + 1500) = 29000 → 税 2900 → 31900
        $this->assertStringContainsString('¥1,500', $contents);
        $this->assertStringContainsString('"消費税"', $contents);
        $this->assertStringContainsString('¥2,900', $contents);
        $this->assertStringContainsString('¥31,900（税込）', $contents);
        // 税抜合計を「税込」と表示しない（2026-09-02 報告の不具合）
        $this->assertStringNotContainsString('¥29,000', $contents);
        $this->assertStringContainsString('税抜金額', $contents);
        // 複数件のときは特定生体の hero 画像を出さない
        $this->assertArrayNotHasKey('hero', $bubble);
    }

    public function test_paymentReminder_の合計は請求書PDFの税込合計と一致する(): void
    {
        $winner = $this->createParticipant();
        $w = $this->makeWonItem([
            'winner_id' => $winner->id,
            'winning_price' => 7200,
            'quantity' => 1,
            'commission_amount' => 720,
            'total_amount' => 7920,
            'shipping_fee' => 350,
        ]);

        $expected = \App\Services\InvoiceService::buyerTotals(collect([$w]))['grand_total'];
        // (7200 + 720 + 350) = 8270 → 税 827 → 9097
        $this->assertSame(9097, $expected);

        $contents = json_encode($this->builder->paymentReminder(collect([$w]), '24時間以内'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('¥9,097（税込）', $contents);
        $this->assertStringNotContainsString('¥8,270', $contents);
    }

    public function test_paymentReminder_は_11件以上を省略表記にする(): void
    {
        $winner = $this->createParticipant();
        // won_items.item_id は UNIQUE なので落札品ごとに Item を用意する
        $items = collect(range(1, 12))->map(function (int $i) use ($winner) {
            $item = Item::factory()->sold()->create([
                'auction_id' => $this->auction->id,
                'seller_profile_id' => $this->sellerProfile->id,
                'species_name' => "テスト生体{$i}",
            ]);
            // 1000×1 + 手数料0 = 1000（税抜）
            return $this->makeWonItem([
                'winner_id' => $winner->id,
                'item_id' => $item->id,
                'winning_price' => 1000,
                'quantity' => 1,
                'commission_amount' => 0,
                'total_amount' => 1000,
            ]);
        });

        $bubble = $this->builder->paymentReminder($items, '24時間以内');
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $this->assertStringContainsString('12 件', $contents);
        $this->assertStringContainsString('他 2 件', $contents);
        // 12000（税抜）→ 税 1200 → 13200
        $this->assertStringContainsString('¥13,200（税込）', $contents);
    }

    public function test_itemSold_は_出品者向けの落札通知(): void
    {
        $bubble = $this->builder->itemSold($this->makeWonItem());
        $this->assertBubble($bubble);
        $this->assertStringContainsString('幹之メダカ', json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public function test_sellerAuctionStart_は_出品者向けオークション開始(): void
    {
        $bubble = $this->builder->sellerAuctionStart($this->auction);
        $this->assertBubble($bubble);
    }

    public function test_invoiceReady_は_請求金額とPDFリンクを含む(): void
    {
        $bubble = $this->builder->invoiceReady($this->auction, 12345, 'https://example.com/inv.pdf');
        $this->assertBubble($bubble);
        $contents = json_encode($bubble, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->assertStringContainsString('¥12,345', $contents);
        $this->assertStringContainsString('https://example.com/inv.pdf', $contents);
    }
}
