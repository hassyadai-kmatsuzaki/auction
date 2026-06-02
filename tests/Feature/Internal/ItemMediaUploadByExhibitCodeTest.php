<?php

namespace Tests\Feature\Internal;

use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * /api/internal/auctions/{auctionId}/items/{exhibitCode}/media の挙動を検証する。
 * (auction_id + exhibit_code) で item を解決してメディアを紐付ける、AI動画パイプライン用の入口。
 */
class ItemMediaUploadByExhibitCodeTest extends TestCase
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

    private function makeItem(Auction $auction, ?string $exhibitCode): Item
    {
        return Item::factory()->create([
            'auction_id'        => $auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'exhibit_code'      => $exhibitCode,
        ]);
    }

    public function test_auction_idとexhibit_codeで紐付けてアップロードできる(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled']);
        $item = $this->makeItem($auction, 'A-001');
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$auction->id}/items/A-001/media", [
                'file'       => $file,
                'media_type' => 'image',
            ]);

        $response->assertStatus(201);
        $this->assertSame(1, ItemMedia::where('item_id', $item->id)->count());
    }

    public function test_存在しないauction_idは404(): void
    {
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $this->actingAs($this->admin, 'sanctum')
            ->post('/api/internal/auctions/999999/items/A-001/media', [
                'file'       => $file,
                'media_type' => 'image',
            ])->assertStatus(404);
    }

    public function test_開催中liveのオークションは422で弾く(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'live']);
        $this->makeItem($auction, 'A-001');
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$auction->id}/items/A-001/media", [
                'file'       => $file,
                'media_type' => 'image',
            ])->assertStatus(422);
    }

    public function test_preparing状態は許可される(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'preparing']);
        $item = $this->makeItem($auction, 'B-200');
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$auction->id}/items/B-200/media", [
                'file'       => $file,
                'media_type' => 'image',
            ])->assertStatus(201);

        $this->assertSame(1, ItemMedia::where('item_id', $item->id)->count());
    }

    public function test_該当exhibit_codeが無ければ404(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled']);
        $this->makeItem($auction, 'A-001');
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        // 同じオークションだが別コード
        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$auction->id}/items/A-002/media", [
                'file'       => $file,
                'media_type' => 'image',
            ])->assertStatus(404);
    }

    public function test_別オークションの同一exhibit_codeには誤爆しない(): void
    {
        $auctionA = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled']);
        $auctionB = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled']);
        $itemA = $this->makeItem($auctionA, 'A-001');
        $itemB = $this->makeItem($auctionB, 'A-001');
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$auctionA->id}/items/A-001/media", [
                'file'       => $file,
                'media_type' => 'image',
            ])->assertStatus(201);

        // auctionA の item にだけ付き、auctionB の item には付かない
        $this->assertSame(1, ItemMedia::where('item_id', $itemA->id)->count());
        $this->assertSame(0, ItemMedia::where('item_id', $itemB->id)->count());
    }

    public function test_該当が複数なら409(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled']);
        // 本来は起きないが、同一 auction 内に同一 exhibit_code を2件作って曖昧状態を再現
        $this->makeItem($auction, 'A-001');
        $this->makeItem($auction, 'A-001');
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/auctions/{$auction->id}/items/A-001/media", [
                'file'       => $file,
                'media_type' => 'image',
            ])->assertStatus(409);
    }

    public function test_Idempotency_Keyで再送するとリプレイされ重複登録されない(): void
    {
        $auction = Auction::factory()->create(['created_by' => $this->admin->id, 'status' => 'scheduled']);
        $item = $this->makeItem($auction, 'A-010');
        $key = 'exhibit-key-001';

        $first = $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/internal/auctions/{$auction->id}/items/A-010/media", [
                'file'       => UploadedFile::fake()->image('a.jpg', 10, 10),
                'media_type' => 'image',
            ]);
        $first->assertStatus(201);

        $second = $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/internal/auctions/{$auction->id}/items/A-010/media", [
                'file'       => UploadedFile::fake()->image('a.jpg', 10, 10),
                'media_type' => 'image',
            ]);
        $second->assertStatus(201);
        $second->assertHeader('Idempotent-Replayed', 'true');
        $this->assertSame($first->json(), $second->json());
        $this->assertSame(1, ItemMedia::where('item_id', $item->id)->count());
    }
}
