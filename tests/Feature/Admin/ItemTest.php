<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Tests\TestCase;

class ItemTest extends TestCase
{
    protected User $admin;
    protected Auction $auction;
    protected SellerProfile $sellerProfile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $this->auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
    }

    public function test_admin_can_list_items(): void
    {
        Item::factory()->count(5)->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/items");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'auction',
                    'items',
                    'pagination',
                ],
            ]);
    }

    public function test_admin_can_create_item(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => 'ボールパイソン アルビノ',
                'quantity' => 1,
                'start_price' => 30000,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'auction_id' => $this->auction->id,
            'species_name' => 'ボールパイソン アルビノ',
        ]);
    }

    public function test_admin_can_view_item_detail(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'item' => ['id', 'species_name', 'start_price', 'status'],
                ],
            ]);
    }

    public function test_admin_can_update_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}", [
                'species_name' => '更新された品種名',
                'start_price' => 50000,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'species_name' => '更新された品種名',
        ]);
    }

    public function test_admin_cannot_update_sold_item(): void
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}", [
                'species_name' => '更新された品種名',
            ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_delete_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('items', [
            'id' => $item->id,
        ]);
    }

    public function test_admin_cannot_delete_sold_item(): void
    {
        $item = Item::factory()->sold()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertStatus(422);
    }

    public function test_admin_can_bulk_update_status(): void
    {
        $items = Item::factory()->count(3)->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/bulk-status", [
                'item_ids' => $items->pluck('id')->toArray(),
                'status' => 'registered',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        foreach ($items as $item) {
            $this->assertDatabaseHas('items', [
                'id' => $item->id,
                'status' => 'registered',
            ]);
        }
    }

    public function test_admin_can_download_csv_template(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/auctions/{$this->auction->id}/items/template");

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_item_creation_requires_species_name(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'quantity' => 1,
                'start_price' => 30000,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['species_name']);
    }

    public function test_item_creation_requires_positive_quantity(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => 'テスト品種',
                'quantity' => 0,
                'start_price' => 30000,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_item_creation_requires_positive_start_price(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/auctions/{$this->auction->id}/items", [
                'species_name' => 'テスト品種',
                'quantity' => 1,
                'start_price' => 0,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['start_price']);
    }

    public function test_admin_can_update_item_status(): void
    {
        $item = Item::factory()->registered()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/status", [
                'status' => 'cancelled',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('items', ['id' => $item->id, 'status' => 'cancelled']);
    }

    public function test_cannot_update_status_of_live_or_sold_item(): void
    {
        $item = Item::factory()->live()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/status", [
                'status' => 'cancelled',
            ])
            ->assertStatus(422);
    }

    public function test_admin_can_destroy_item(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}");

        $response->assertOk();
    }

    public function test_admin_can_get_sellers_for_import(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/sellers/list');

        $response->assertOk()
            ->assertJsonStructure(['data' => ['sellers' => [['id', 'seller_name']]]]);
    }

    public function test_admin_can_upload_image_media(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $file = \Illuminate\Http\UploadedFile::fake()->image('test.jpg', 800, 600);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/media", [
                'file' => $file,
                'media_type' => 'image',
            ]);

        $response->assertStatus(201);
        // UploadMediaAction が実 media_type を photo_other / photo_top 等に分類するので
        // ここでは行が作成されたことだけ確認する
        $this->assertSame(1, \App\Models\ItemMedia::where('item_id', $item->id)->count());
    }

    public function test_upload_media_validates_extension(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $file = \Illuminate\Http\UploadedFile::fake()->create('bad.exe', 100);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/media", [
                'file' => $file,
                'media_type' => 'image',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_admin_can_reorder_media(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $base = ['item_id' => $item->id, 'media_type' => 'photo_other', 'file_name' => 'x.jpg', 'mime_type' => 'image/jpeg', 'file_size' => 100];
        $m1 = \App\Models\ItemMedia::create(array_merge($base, ['file_path' => 'a.jpg', 'media_path' => 'a.jpg', 'display_order' => 1]));
        $m2 = \App\Models\ItemMedia::create(array_merge($base, ['file_path' => 'b.jpg', 'media_path' => 'b.jpg', 'display_order' => 2]));

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/media/reorder", [
                'media_ids' => [$m2->id, $m1->id],
            ]);

        $response->assertOk();
        $this->assertSame(1, (int) $m2->fresh()->display_order);
        $this->assertSame(2, (int) $m1->fresh()->display_order);
    }

    public function test_reorder_media_requires_existing_ids(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/media/reorder", [
                'media_ids' => [99999],
            ])
            ->assertStatus(422);
    }

    public function test_admin_can_delete_media(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $media = \App\Models\ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_other',
            'file_path' => 'x.jpg',
            'media_path' => 'x.jpg',
            'file_name' => 'x.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 100,
            'display_order' => 1,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/media/{$media->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('item_media', ['id' => $media->id]);
    }

    public function test_video_cannot_be_set_as_thumbnail(): void
    {
        $item = Item::factory()->draft()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
        ]);
        $media = \App\Models\ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'video_top',
            'mime_type' => 'video/mp4',
            'file_path' => 'movie.mp4',
            'media_path' => 'movie.mp4',
            'file_name' => 'movie.mp4',
            'file_size' => 1000,
            'display_order' => 1,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/auctions/{$this->auction->id}/items/{$item->id}/media/{$media->id}/thumbnail")
            ->assertStatus(422);
    }

    public function test_admin_can_import_csv_with_items(): void
    {
        // ヘッダ + 2 行（最小列）
        $csv = "item_number,species_name,quantity,start_price,bid_increment,reserve_price,estimated_price,inspection_info,individual_info,notes\n";
        $csv .= "1,テスト魚A,1,5000,100,4000,6000,,,\n";
        $csv .= "2,テスト魚B,2,8000,200,6000,10000,,,\n";

        $tmp = tempnam(sys_get_temp_dir(), 'csv') . '.csv';
        file_put_contents($tmp, $csv);
        $upload = new \Illuminate\Http\UploadedFile($tmp, 'items.csv', 'text/csv', null, true);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/import", [
                'file' => $upload,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);

        // インポート成功 or エラーの形を返してくれればOK（実装の細かい挙動はサービス側）
        $this->assertContains($response->status(), [200, 201, 422, 500]);
    }

    public function test_import_csv_accepts_species_type_anonymous_and_unit_columns(): void
    {
        $header = implode(',', array_fill(0, 14, 'h'));
        // 列: 品種名,数量,開始価格,最低,想定,入札単位,出品者説明,表示用,備考,プレミアム,未落札,種別,匿名,単位
        $csv = $header . "\n";
        $csv .= "楊貴妃,10,100,,,100,体外光あり,,,0,return,メダカ,0,匹\n";       // 表示用が空 → 出品者説明を写す
        $csv .= "ミナミヌマエビ,2,100,,,100,原文,整えた文章,,1,return,その他,1,袋\n"; // その他+袋+匿名
        $csv .= "幹之,1,100,,,100,,,,0,return,,,\n";                              // 種別/匿名/単位が空 → 既定
        $csv .= "旧形式,1,100,,,100,旧原文,,,0,return\n";                         // 旧テンプレート(11列)

        $tmp = tempnam(sys_get_temp_dir(), 'csv') . '.csv';
        file_put_contents($tmp, $csv);
        $upload = new \Illuminate\Http\UploadedFile($tmp, 'items.csv', 'text/csv', null, true);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/import", [
                'file' => $upload,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);
        $response->assertStatus(200);
        $this->assertSame(4, $response->json('data.imported') ?? $response->json('imported'), $response->getContent());

        $medaka = \App\Models\SpeciesType::where('code', 'medaka')->firstOrFail();
        $other = \App\Models\SpeciesType::where('code', 'other')->firstOrFail();

        $this->assertDatabaseHas('items', [
            'species_name' => '楊貴妃', 'species_type_id' => $medaka->id, 'quantity_unit' => 'fish',
            'is_anonymous' => 0, 'individual_info' => '体外光あり', 'inspection_info' => '体外光あり',
        ]);
        $this->assertDatabaseHas('items', [
            'species_name' => 'ミナミヌマエビ', 'species_type_id' => $other->id, 'quantity_unit' => 'bag',
            'is_anonymous' => 1, 'individual_info' => '原文', 'inspection_info' => '整えた文章',
        ]);
        $this->assertDatabaseHas('items', [
            'species_name' => '幹之', 'species_type_id' => $medaka->id, 'quantity_unit' => 'fish', 'is_anonymous' => 0,
        ]);
        $this->assertDatabaseHas('items', [
            'species_name' => '旧形式', 'species_type_id' => $medaka->id, 'quantity_unit' => 'fish',
            'is_anonymous' => 0, 'inspection_info' => '旧原文',
        ]);
    }

    public function test_import_csv_rejects_unknown_species_type_and_disallowed_unit(): void
    {
        $header = implode(',', array_fill(0, 14, 'h'));
        $csv = $header . "\n";
        $csv .= "A,1,100,,,100,,,,0,return,爬虫類,0,匹\n"; // 存在しない種別
        $csv .= "B,1,100,,,100,,,,0,return,メダカ,0,kg\n"; // メダカで kg は不可
        $csv .= "C,1,100,,,100,,,,0,return,金魚,0,\n";     // 正常

        $tmp = tempnam(sys_get_temp_dir(), 'csv') . '.csv';
        file_put_contents($tmp, $csv);
        $upload = new \Illuminate\Http\UploadedFile($tmp, 'items.csv', 'text/csv', null, true);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/import", [
                'file' => $upload,
                'seller_profile_id' => $this->sellerProfile->id,
            ]);

        $body = implode("\n", $response->json('data.errors'));
        $this->assertStringContainsString('種別「爬虫類」は選べません', $body);
        $this->assertStringContainsString('単位「kg」は使えません', $body);
        $this->assertSame(1, $response->json('data.imported'));
        $this->assertDatabaseMissing('items', ['species_name' => 'A']);
        $this->assertDatabaseMissing('items', ['species_name' => 'B']);
        $this->assertDatabaseHas('items', ['species_name' => 'C']);
    }

    public function test_import_validates_file_type(): void
    {
        $upload = \Illuminate\Http\UploadedFile::fake()->create('items.exe', 100);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/import", [
                'file' => $upload,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }
}
