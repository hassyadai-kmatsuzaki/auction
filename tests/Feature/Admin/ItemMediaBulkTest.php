<?php

namespace Tests\Feature\Admin;

use App\Models\Auction;
use App\Models\Item;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

/**
 * AdminItemMediaBulkController::bulkUpload のテスト。
 *
 * - ZIP のバリデーション
 * - 生体未登録時の拒否
 * - ファイル名命名規則のパース
 * - 不正な拡張子の検出
 *
 * 注: 実際の DB 書き込みはコントローラ側の media_type が enum と
 * 不一致のため避け、エラー集約パスを主に検証する。
 */
class ItemMediaBulkTest extends TestCase
{
    private User $admin;
    private SellerProfile $sellerProfile;
    private Auction $auction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $this->sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $this->auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        Storage::fake('public');
    }

    /**
     * 指定された拡張子・名前で ZIP ファイル UploadedFile を組み立てる
     *
     * @param array<string, string> $files filename => content
     */
    private function makeZipUpload(array $files): UploadedFile
    {
        $zipPath = tempnam(sys_get_temp_dir(), 'bulk') . '.zip';
        $zip = new ZipArchive();
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        foreach ($files as $name => $content) {
            $zip->addFromString($name, $content);
        }
        $zip->close();

        return new UploadedFile($zipPath, 'images.zip', 'application/zip', null, true);
    }

    public function test_bulkUpload_ZIP未指定で422(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_bulkUpload_ZIP以外のmimeで422(): void
    {
        $file = UploadedFile::fake()->create('a.exe', 100);
        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $file])
            ->assertStatus(422);
    }

    public function test_bulkUpload_生体未登録のオークションで400(): void
    {
        $zip = $this->makeZipUpload(['001_1.jpg' => "\xFF\xD8\xFF body"]);

        $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $zip])
            ->assertStatus(400)
            ->assertJsonPath('success', false);
    }

    public function test_bulkUpload_存在しないオークションで404(): void
    {
        $zip = $this->makeZipUpload(['001_1.jpg' => 'body']);

        $this->actingAs($this->admin, 'sanctum')
            ->post('/api/admin/auctions/999999/items/media/bulk-upload', ['file' => $zip])
            ->assertStatus(404);
    }

    public function test_bulkUpload_命名規則違反と未対応拡張子はerrorsに集約される(): void
    {
        // 命名規則 OK な item_number=1 を登録（が、item_media insert は別バグでスキップされる想定）
        Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 1,
        ]);

        $zip = $this->makeZipUpload([
            'invalid_filename.jpg' => 'body',           // 命名規則違反
            'foo.exe' => 'body',                         // 未対応拡張子
            '999_1.jpg' => 'body',                        // 該当 item_number なし
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $zip]);
        $r->assertOk();

        $errors = $r->json('data.errors');
        $this->assertNotEmpty($errors);
        $errorText = implode("\n", $errors);
        $this->assertStringContainsString('命名規則', $errorText);
        $this->assertStringContainsString('対応していない', $errorText);
        $this->assertStringContainsString('生体番号', $errorText);
    }

    public function test_non_admin_cannot_bulk_upload(): void
    {
        $participant = $this->createParticipant();
        $this->actingAs($participant, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload")
            ->assertStatus(403);
    }

    public function test_bulkUpload_正常系_ItemMedia行が生成されサムネイルが設定される(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 1,
        ]);

        // 最小の有効 JPEG ヘッダ（中身は適当だがダウンロード可）
        $jpegBytes = "\xFF\xD8\xFF\xE0\x00\x10JFIF" . str_repeat("\x00", 100);
        $zip = $this->makeZipUpload([
            '001_1.jpg' => $jpegBytes,
            '001_2.jpg' => $jpegBytes,
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $zip]);
        $r->assertOk()
            ->assertJsonPath('data.uploaded', 2)
            ->assertJsonPath('data.skipped', 0);

        $this->assertSame(2, \App\Models\ItemMedia::where('item_id', $item->id)->count());
        // sequence=1 が photo_top + サムネイル
        $this->assertSame(1, \App\Models\ItemMedia::where('item_id', $item->id)
            ->where('media_type', 'photo_top')->where('is_thumbnail', true)->count());
        // sequence=2 が photo_other + サムネイルではない
        $this->assertSame(1, \App\Models\ItemMedia::where('item_id', $item->id)
            ->where('media_type', 'photo_other')->where('is_thumbnail', false)->count());

        // Item.thumbnail_path がセットされる
        $item->refresh();
        $this->assertNotNull($item->thumbnail_path);
    }

    public function test_bulkUpload_既存サムネイルがあれば新規アップロードはサムネイルにしない(): void
    {
        $item = Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 1,
        ]);
        \App\Models\ItemMedia::create([
            'item_id' => $item->id,
            'media_type' => 'photo_top',
            'file_path' => 'existing.jpg',
            'file_name' => 'existing.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 100,
            'is_thumbnail' => true,
            'display_order' => 1,
        ]);

        $zip = $this->makeZipUpload(['001_1.jpg' => 'body']);
        $r = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $zip]);
        $r->assertOk()->assertJsonPath('data.uploaded', 1);

        $thumbnailCount = \App\Models\ItemMedia::where('item_id', $item->id)
            ->where('is_thumbnail', true)->count();
        $this->assertSame(1, $thumbnailCount, '既存サムネイルが残り、新規はサムネイル扱いされない');
    }

    public function test_bulkUpload_複数生体への振り分け(): void
    {
        Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 1,
        ]);
        Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 2,
        ]);

        $zip = $this->makeZipUpload([
            '001_1.jpg' => 'a',
            '001_2.jpg' => 'b',
            '002_1.jpg' => 'c',
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $zip]);
        $r->assertOk()->assertJsonPath('data.uploaded', 3);

        $results = collect($r->json('data.results'))->keyBy('item_number');
        $this->assertSame(2, (int) $results[1]['uploaded_count']);
        $this->assertSame(1, (int) $results[2]['uploaded_count']);
    }

    public function test_bulkUpload_対応外拡張子_未登録item_number_命名違反_を別個にエラー集約(): void
    {
        Item::factory()->create([
            'auction_id' => $this->auction->id,
            'seller_profile_id' => $this->sellerProfile->id,
            'item_number' => 1,
        ]);

        $zip = $this->makeZipUpload([
            '001_1.jpg' => 'good',          // 成功
            '001_2.exe' => 'bad-ext',        // 未対応拡張子
            '999_1.jpg' => 'unknown-item',   // 該当アイテムなし
            'noformat.jpg' => 'bad-name',    // 命名規則違反
        ]);

        $r = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/admin/auctions/{$this->auction->id}/items/media/bulk-upload", ['file' => $zip]);
        $r->assertOk();
        $this->assertSame(1, $r->json('data.uploaded'));
        $this->assertSame(3, $r->json('data.skipped'));
        $this->assertSame(3, count($r->json('data.errors')));
    }
}
