<?php

namespace Tests\Unit\Actions\Line;

use App\Actions\Line\NotifyFavoriteApproachingAction;
use App\Models\Auction;
use App\Models\Favorite;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\SystemSetting;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** B-5（N+1 解消）/ B-6（通知 OFF スイッチ） */
class NotifyFavoriteApproachingActionTest extends TestCase
{
    private Lane $lane;
    /** @var Item[] seq 1..5 */
    private array $items = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $admin = $this->createAdmin();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $this->createSeller()->id]);
        $auction = Auction::factory()->live()->create(['created_by' => $admin->id]);
        $this->lane = Lane::factory()->active()->create(['auction_id' => $auction->id, 'lane_number' => 1]);

        for ($seq = 1; $seq <= 5; $seq++) {
            $item = Item::factory()->create([
                'auction_id' => $auction->id,
                'seller_profile_id' => $sellerProfile->id,
                'status' => $seq === 1 ? 'live' : 'registered',
                'species_name' => "生体{$seq}",
            ]);
            $this->lane->items()->attach($item->id, ['sequence_order' => $seq]);
            $this->items[$seq] = $item;
        }
        $this->lane->update(['current_item_id' => $this->items[1]->id]);
    }

    private function favorite(int $seq, int $n): void
    {
        for ($i = 0; $i < $n; $i++) {
            Favorite::create(['user_id' => $this->createParticipant()->id, 'item_id' => $this->items[$seq]->id]);
        }
    }

    public function test_3個先の商品のお気に入り登録者へ_あと3番目として通知する(): void
    {
        $this->favorite(4, 2);
        $this->favorite(5, 1); // 4個先は対象外

        $mock = $this->mock(NotificationService::class);
        $mock->shouldReceive('sendFavoriteApproachingNotification')
            ->twice()
            ->withArgs(fn ($userId, $species, $ahead, $laneName, $title, $auctionId) => $species === '生体4' && $ahead === 3 && $laneName === 'レーン1');

        app(NotifyFavoriteApproachingAction::class)->execute($this->lane, $this->items[1]);
    }

    public function test_SQL本数は_お気に入り件数に依存しない(): void
    {
        $this->favorite(4, 1);
        $this->mock(NotificationService::class)->shouldReceive('sendFavoriteApproachingNotification');

        // 初回だけ発生する設定キャッシュ／lane->auction のロードを済ませてから計測する
        app(NotifyFavoriteApproachingAction::class)->execute($this->lane, $this->items[1]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(NotifyFavoriteApproachingAction::class)->execute($this->lane, $this->items[1]);
        $one = count(DB::getQueryLog());

        $this->favorite(4, 6);
        DB::flushQueryLog();
        app(NotifyFavoriteApproachingAction::class)->execute($this->lane, $this->items[1]);
        $seven = count(DB::getQueryLog());

        $this->assertSame($one, $seven, "1件: {$one} 本 / 7件: {$seven} 本 — 件数で増えてはいけない");
        $this->assertLessThanOrEqual(6, $seven);
    }

    public function test_縮退スイッチOFFなら何も送らない(): void
    {
        $this->favorite(4, 2);
        SystemSetting::updateOrCreate(['setting_key' => 'live_notify_favorite_approaching'], [
            'setting_value' => '0', 'value_type' => 'boolean',
            'category' => 'live_operation', 'display_name' => 'x', 'description' => '', 'is_public' => false,
        ]);
        SystemSetting::clearCache();

        $this->mock(NotificationService::class)->shouldNotReceive('sendFavoriteApproachingNotification');
        app(NotifyFavoriteApproachingAction::class)->execute($this->lane, $this->items[1]);
    }

    public function test_対象商品が無ければ何もしない(): void
    {
        $this->mock(NotificationService::class)->shouldNotReceive('sendFavoriteApproachingNotification');
        app(NotifyFavoriteApproachingAction::class)->execute($this->lane, $this->items[4]); // 4+3=7 は存在しない
    }
}
