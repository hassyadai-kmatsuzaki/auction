<?php

namespace Tests\Feature\Admin;

use App\Actions\Item\ApplyThumbnailByViewAction;
use App\Jobs\ReapplyThumbnailViewJob;
use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Models\SpeciesThumbnailView;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * 撮影ビュー（生体名→上見/横見）と自動サムネ・遡及再適用・手動例外の挙動を検証する。
 */
class ThumbnailViewTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        Storage::fake('public');
    }

    private function makeItem(string $species, string $status = 'scheduled', bool $manual = false): Item
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => $status]);

        return Item::factory()->create([
            'auction_id'          => $auction->id,
            'seller_profile_id'   => $this->sellerProfile->id,
            'species_name'        => $species,
            'thumbnail_is_manual' => $manual,
        ]);
    }

    private function makeMedia(Item $item, string $type, int $order, bool $thumb = false): ItemMedia
    {
        return ItemMedia::create([
            'item_id'       => $item->id,
            'media_type'    => $type,
            'file_path'     => "items/{$item->auction_id}/{$item->id}/{$type}-{$order}.jpg",
            'file_name'     => "{$type}-{$order}.jpg",
            'file_size'     => 1234,
            'mime_type'     => 'image/jpeg',
            'is_processed'  => true,
            'is_thumbnail'  => $thumb,
            'display_order' => $order,
        ]);
    }

    private function apply(Item $item): array
    {
        return app(ApplyThumbnailByViewAction::class)->execute($item->fresh());
    }

    public function test_登録済みsideビューは横見写真をサムネにする(): void
    {
        $item = $this->makeItem('白ブチ');
        $top  = $this->makeMedia($item, 'photo_top', 1);
        $side = $this->makeMedia($item, 'photo_side', 2);
        SpeciesThumbnailView::create(['species_name' => '白ブチ', 'thumbnail_view' => 'side']);

        $result = $this->apply($item);

        $this->assertTrue($result['changed']);
        $this->assertSame('matched', $result['reason']);
        $this->assertTrue($side->fresh()->is_thumbnail);
        $this->assertFalse($top->fresh()->is_thumbnail);
        $this->assertFalse($item->fresh()->thumbnail_is_manual);
    }

    public function test_未登録の生体名は上見デフォルト(): void
    {
        $item = $this->makeItem('謎メダカ');
        $top  = $this->makeMedia($item, 'photo_top', 1);
        $side = $this->makeMedia($item, 'photo_side', 2);

        $result = $this->apply($item);

        $this->assertSame('top', $result['view']);
        $this->assertTrue($top->fresh()->is_thumbnail);
        $this->assertFalse($side->fresh()->is_thumbnail);
    }

    public function test_手動指定の個体は自動適用でスキップされる(): void
    {
        $item = $this->makeItem('白ブチ', 'scheduled', manual: true);
        $top  = $this->makeMedia($item, 'photo_top', 1, thumb: true);
        $this->makeMedia($item, 'photo_side', 2);
        SpeciesThumbnailView::create(['species_name' => '白ブチ', 'thumbnail_view' => 'side']);

        $result = $this->apply($item);

        $this->assertFalse($result['changed']);
        $this->assertSame('manual', $result['reason']);
        // 手動で選ばれた上見のままで、横見に奪われない。
        $this->assertTrue($top->fresh()->is_thumbnail);
    }

    public function test_向き写真が無ければ暫定で先頭写真を立てる(): void
    {
        $item  = $this->makeItem('白ブチ');
        $other = $this->makeMedia($item, 'photo_other', 1);
        SpeciesThumbnailView::create(['species_name' => '白ブチ', 'thumbnail_view' => 'side']);

        $result = $this->apply($item);

        $this->assertSame('interim', $result['reason']);
        $this->assertTrue($other->fresh()->is_thumbnail);
    }

    public function test_遡及ジョブは開催前かつ非手動だけを直す(): void
    {
        // 開催前・自動 → 直る
        $scheduled = $this->makeItem('白ブチ', 'scheduled');
        $sTop  = $this->makeMedia($scheduled, 'photo_top', 1, thumb: true);
        $sSide = $this->makeMedia($scheduled, 'photo_side', 2);

        // 開催中 → 触らない
        $live = $this->makeItem('白ブチ', 'live');
        $lTop = $this->makeMedia($live, 'photo_top', 1, thumb: true);
        $this->makeMedia($live, 'photo_side', 2);

        // 開催前だが手動 → 触らない
        $manual = $this->makeItem('白ブチ', 'scheduled', manual: true);
        $mTop = $this->makeMedia($manual, 'photo_top', 1, thumb: true);
        $this->makeMedia($manual, 'photo_side', 2);

        SpeciesThumbnailView::create(['species_name' => '白ブチ', 'thumbnail_view' => 'side']);

        (new ReapplyThumbnailViewJob('白ブチ'))->handle(app(ApplyThumbnailByViewAction::class));

        $this->assertTrue($sSide->fresh()->is_thumbnail, '開催前の個体は横見に切替');
        $this->assertFalse($sTop->fresh()->is_thumbnail);
        $this->assertTrue($lTop->fresh()->is_thumbnail, '開催中は据え置き');
        $this->assertTrue($mTop->fresh()->is_thumbnail, '手動は据え置き');
    }

    public function test_ビュー登録APIで遡及ジョブが投入される(): void
    {
        Queue::fake();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/masters/thumbnail-views', [
                'species_name'   => '  白ブチ  ', // 前後スペースは trim される
                'thumbnail_view' => 'side',
            ])->assertStatus(201)
            ->assertJsonPath('data.species_name', '白ブチ');

        $this->assertDatabaseHas('species_thumbnail_views', ['species_name' => '白ブチ']);
        Queue::assertPushed(ReapplyThumbnailViewJob::class);
    }

    public function test_unregistered一覧はtrim突合で登録済みを除外する(): void
    {
        // items 側に前後スペース付きで存在
        $this->makeMedia($this->makeItem('白ブチ '), 'photo_top', 1);
        $this->makeMedia($this->makeItem('青水 '), 'photo_top', 1);
        // 「白ブチ」を登録 → trim 突合で未登録から外れる
        SpeciesThumbnailView::create(['species_name' => '白ブチ', 'thumbnail_view' => 'side']);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/masters/thumbnail-views/unregistered')
            ->assertStatus(200);

        $names = collect($res->json('data.species'))->pluck('species_name');
        $this->assertContains('青水', $names);
        $this->assertNotContains('白ブチ', $names);
    }

    public function test_internalアップロードでviewに応じたmedia_typeで保存され自動サムネされる(): void
    {
        $item = Item::factory()->create([
            'auction_id'        => Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled'])->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'species_name'      => '白ブチ',
            'exhibit_code'      => 'A-001',
        ]);
        SpeciesThumbnailView::create(['species_name' => '白ブチ', 'thumbnail_view' => 'side']);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$item->auction_id}/items/A-001/media", [
                'file'       => UploadedFile::fake()->image('s.jpg', 10, 10),
                'media_type' => 'image',
                'view'       => 'side',
            ])->assertStatus(201);

        $media = ItemMedia::where('item_id', $item->id)->first();
        $this->assertSame('photo_side', $media->media_type);
        $this->assertTrue($media->fresh()->is_thumbnail, '横見写真が自動でサムネになる');
        $res->assertJsonPath('data.thumbnail.view', 'side');
    }

    public function test_手動サムネ写真を削除すると手動フラグが解除される(): void
    {
        $item  = $this->makeItem('白ブチ');
        $thumb = $this->makeMedia($item, 'photo_top', 1, thumb: true);
        $item->update(['thumbnail_is_manual' => true, 'thumbnail_path' => 'x']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$item->auction_id}/items/{$item->id}/media/{$thumb->id}")
            ->assertStatus(200);

        $this->assertFalse($item->fresh()->thumbnail_is_manual);
    }
}
