<?php

namespace Tests\Unit\Services;

use App\Models\Auction;
use App\Models\BidParticipant;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Services\BidService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * B-4 (2026-09-14): getLiveState の共有部分キャッシュ。
 *
 * 商品切替のたびに参加者全員（9/20 は 500 名）が同時に /live を取りに来る。
 * レーン構成・商品の静的項目・次の商品・画像 URL はオークション単位で短時間キャッシュし、
 * 現在価格・入札者数・カウントダウン・自分の状態は毎回取る。
 * キャッシュの現在商品 ID が DB と食い違えば、その要求内で作り直す。
 */
class BidServiceSharedStateTest extends TestCase
{
    private BidService $service;
    private Auction $auction;
    private Lane $lane;
    private Item $item;
    private Item $nextItem;
    private $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        config(['live.shared_state_ttl' => 60]); // テスト中に自然失効しないよう長めにする

        $this->service     = new BidService();
        $admin             = $this->createAdmin();
        $this->participant = $this->createParticipant();
        $this->auction     = Auction::factory()->live()->create(['created_by' => $admin->id]);
        $this->lane        = Lane::factory()->active()->create(['auction_id' => $this->auction->id]);

        $seller  = $this->createSeller();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $this->item = Item::factory()->live()->create([
            'auction_id' => $this->auction->id, 'seller_profile_id' => $profile->id,
            'species_name' => '楊貴妃', 'start_price' => 1000, 'current_price' => 1000,
        ]);
        $this->nextItem = Item::factory()->create([
            'auction_id' => $this->auction->id, 'seller_profile_id' => $profile->id,
            'status' => 'registered', 'species_name' => '幹之', 'start_price' => 2000, 'current_price' => 2000,
        ]);
        $this->lane->items()->attach($this->item->id, ['sequence_order' => 1]);
        $this->lane->items()->attach($this->nextItem->id, ['sequence_order' => 2]);
        $this->lane->update(['current_item_id' => $this->item->id]);
        Cache::flush();
    }

    private function state(?int $userId = null): array
    {
        return $this->service->getLiveState($this->auction->fresh(), $userId);
    }

    public function test_共有部分は2回目からキャッシュで組み立てられる(): void
    {
        $first = $this->state();
        $this->assertTrue(Cache::has(BidService::sharedStateKey($this->auction->id)));
        $this->assertSame($this->item->id, $first['lanes'][0]['current_item']['id']);
        $this->assertSame('楊貴妃', $first['lanes'][0]['current_item']['species_name']);
        $this->assertSame($this->nextItem->id, $first['lanes'][0]['upcoming_items'][0]['id']);

        // 静的項目を DB だけ書き換える（モデルイベントを出さない）→ キャッシュ中は旧値のまま
        DB::table('items')->where('id', $this->item->id)->update(['species_name' => '改名後']);
        $second = $this->state();
        $this->assertSame('楊貴妃', $second['lanes'][0]['current_item']['species_name']);

        // 毎回取る項目は反映される
        DB::table('items')->where('id', $this->item->id)->update(['current_price' => 1500]);
        BidParticipant::create(['item_id' => $this->item->id, 'user_id' => $this->participant->id, 'is_active' => true, 'activated_at' => now()]);
        $third = $this->state();
        $this->assertSame(1500, (int) $third['lanes'][0]['current_item']['current_price']);
        $this->assertSame(1, $third['lanes'][0]['current_item']['active_bidders_count']);
    }

    public function test_共有部分のDB問い合わせは2回目に減る(): void
    {
        $this->state($this->participant->id);

        DB::enableQueryLog();
        $this->state($this->participant->id);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // state() の $this->auction->fresh() はテスト側の 1 本なので除く
        $queries = array_filter($queries, fn ($q) => !str_contains($q['query'], 'from "auctions"'));
        $sql = implode("\n", array_column($queries, 'query'));
        // レーンの eager load（media / seller_profiles）と次の商品の問い合わせは走らない
        $this->assertStringNotContainsString('"media"', $sql);
        $this->assertStringNotContainsString('seller_profiles', $sql);
        $this->assertStringNotContainsString('sequence_order', $sql);
        // ログインあり: 鮮度確認 1 + 入札者数 1 + 自分の状態 4 = 6 本以内
        $this->assertLessThanOrEqual(6, count($queries), $sql);
    }

    public function test_レーンの現在商品が変わると次の要求で作り直される(): void
    {
        $this->state();

        // 切替を DB 直書きで再現（モデルイベントなし＝フックが効かない最悪の場合）
        DB::table('items')->where('id', $this->item->id)->update(['status' => 'sold']);
        DB::table('items')->where('id', $this->nextItem->id)->update(['status' => 'live']);
        DB::table('lanes')->where('id', $this->lane->id)->update(['current_item_id' => $this->nextItem->id]);

        $after = $this->state();
        $this->assertSame($this->nextItem->id, $after['lanes'][0]['current_item']['id']);
        $this->assertSame('幹之', $after['lanes'][0]['current_item']['species_name']);
        $this->assertSame([], $after['lanes'][0]['upcoming_items']);
    }

    public function test_レーンモデルの更新で共有キャッシュが捨てられる(): void
    {
        $this->state();
        $key = BidService::sharedStateKey($this->auction->id);
        $this->assertTrue(Cache::has($key));

        $this->lane->update(['status' => 'paused']);
        $this->assertFalse(Cache::has($key), 'Lane::saved で共有キャッシュが消える');

        // トランザクション内の更新は commit 後に消える
        $this->state();
        DB::beginTransaction();
        $this->lane->update(['status' => 'active']);
        $this->assertTrue(Cache::has($key), 'commit 前は残る');
        DB::commit();
        $this->assertFalse(Cache::has($key), 'commit 後に消える');
    }

    public function test_自分の状態はキャッシュを共有しても利用者ごとに分かれる(): void
    {
        $other = $this->createParticipant();
        BidParticipant::create(['item_id' => $this->item->id, 'user_id' => $this->participant->id, 'is_active' => true, 'activated_at' => now()]);

        $mine   = $this->state($this->participant->id);
        $theirs = $this->state($other->id);
        $anon   = $this->state();

        $this->assertSame('active', $mine['lanes'][0]['current_item']['my_bid_status']);
        $this->assertNull($theirs['lanes'][0]['current_item']['my_bid_status']);
        $this->assertNull($anon['lanes'][0]['current_item']['my_bid_status']);
        $this->assertArrayHasKey('is_favorited', $mine['lanes'][0]['upcoming_items'][0]);
        $this->assertArrayNotHasKey('is_favorited', $anon['lanes'][0]['upcoming_items'][0]);
        // 共有部分は 1 回しか作られていない
        $this->assertSame(1, (int) $this->state()['lanes'][0]['current_item']['active_bidders_count']);
    }

    public function test_TTL0ならキャッシュしない(): void
    {
        config(['live.shared_state_ttl' => 0]);
        $this->state();
        $this->assertFalse(Cache::has(BidService::sharedStateKey($this->auction->id)));
    }

    public function test_応答の形は従来と同じ(): void
    {
        $r = $this->state($this->participant->id);
        $this->assertSame(['auction_id', 'auction_title', 'status', 'countdown_seconds', 'price_increment_tiers', 'countdown_tiers', 'lanes'], array_keys($r));
        $lane = $r['lanes'][0];
        $this->assertSame(['lane_id', 'lane_number', 'lane_name', 'status', 'current_item', 'upcoming_items'], array_keys($lane));
        foreach (['id', 'item_number', 'exhibit_code', 'species_name', 'seller_name', 'seller_profile_image_url', 'quantity', 'quantity_unit',
                  'current_price', 'estimated_price', 'inspection_info', 'individual_info', 'is_premium', 'is_anonymous', 'thumbnail_path', 'media',
                  'active_bidders_count', 'countdown_seconds', 'my_bid_status', 'phase', 'pre_bid_remaining_seconds', 'countdown_mode',
                  'countdown_seconds_competitive', 'freeze_countdown_seconds', 'my_limit_price', 'my_limit_triggered'] as $k) {
            $this->assertArrayHasKey($k, $lane['current_item'], $k);
        }
        $this->assertArrayNotHasKey('current_price_at_build', $lane['current_item']);
        foreach (['id', 'item_number', 'exhibit_code', 'species_name', 'quantity', 'start_price', 'thumbnail_path', 'is_premium', 'is_anonymous',
                  'is_favorited', 'my_limit_price', 'my_limit_triggered'] as $k) {
            $this->assertArrayHasKey($k, $lane['upcoming_items'][0], $k);
        }
    }
}
