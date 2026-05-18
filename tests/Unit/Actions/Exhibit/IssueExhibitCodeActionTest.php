<?php

namespace Tests\Unit\Actions\Exhibit;

use App\Actions\Exhibit\IssueExhibitCodeAction;
use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class IssueExhibitCodeActionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Auction $auction;
    protected Lane $laneA;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->scheduled()->create(['created_by' => $this->admin->id]);
        $this->laneA = Lane::factory()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 1,
            'lane_name' => 'A',
        ]);

        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    public function test_発行されていないアイテムに対して規定フォーマットの出品IDがセットされる(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        DB::table('lane_items')->insert([
            'lane_id' => $this->laneA->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $action = new IssueExhibitCodeAction();
        $code = $action->execute($item->fresh(), silent: true);

        $this->assertSame('A001', $code);
        $this->assertSame('A001', $item->fresh()->exhibit_code);
        $this->assertNotNull($item->fresh()->exhibit_code_issued_at);
    }

    public function test_同じレーンに連続割当した場合連番がレーン内sequenceOrderに合わせて振られる(): void
    {
        $items = [];
        for ($i = 1; $i <= 3; $i++) {
            $items[$i] = Item::factory()->registered()->create([
                'auction_id' => $this->auction->id,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);
            DB::table('lane_items')->insert([
                'lane_id' => $this->laneA->id,
                'item_id' => $items[$i]->id,
                'sequence_order' => $i,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $action = new IssueExhibitCodeAction();
        foreach ($items as $i => $item) {
            $action->execute($item->fresh(), silent: true);
        }

        $this->assertSame('A001', $items[1]->fresh()->exhibit_code);
        $this->assertSame('A002', $items[2]->fresh()->exhibit_code);
        $this->assertSame('A003', $items[3]->fresh()->exhibit_code);
    }

    public function test_既に発行済みのアイテムには再採番されない(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'exhibit_code' => 'A099',
            'exhibit_code_issued_at' => now()->subDay(),
        ]);
        DB::table('lane_items')->insert([
            'lane_id' => $this->laneA->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $action = new IssueExhibitCodeAction();
        $result = $action->execute($item, silent: true);

        $this->assertSame('A099', $result);
        $this->assertSame('A099', $item->fresh()->exhibit_code);
    }

    public function test_レーン未割当のアイテムには発行されない(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $action = new IssueExhibitCodeAction();
        $result = $action->execute($item, silent: true);

        $this->assertNull($result);
        $this->assertNull($item->fresh()->exhibit_code);
    }

    public function test_lane_nameが空の場合は発行をスキップしてnullを返す(): void
    {
        $blankLane = Lane::factory()->create([
            'auction_id' => $this->auction->id,
            'lane_number' => 2,
            'lane_name' => null,
        ]);
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        DB::table('lane_items')->insert([
            'lane_id' => $blankLane->id,
            'item_id' => $item->id,
            'sequence_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $action = new IssueExhibitCodeAction();
        $result = $action->execute($item, silent: true);

        $this->assertNull($result);
        $this->assertNull($item->fresh()->exhibit_code);
    }

    public function test_発行後にsequenceOrderが変わってもexhibitCodeは固定される(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        DB::table('lane_items')->insert([
            'lane_id' => $this->laneA->id,
            'item_id' => $item->id,
            'sequence_order' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $action = new IssueExhibitCodeAction();
        $action->execute($item, silent: true);

        $this->assertSame('A005', $item->fresh()->exhibit_code);

        // 並び替え: sequence_order を変更しても exhibit_code は変わらない
        DB::table('lane_items')
            ->where('item_id', $item->id)
            ->update(['sequence_order' => 2]);

        $action->execute($item->fresh(), silent: true);

        $this->assertSame('A005', $item->fresh()->exhibit_code);
    }
}
