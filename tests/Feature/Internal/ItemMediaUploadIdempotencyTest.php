<?php

namespace Tests\Feature\Internal;

use App\Models\Auction;
use App\Models\IdempotencyKey;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * /api/internal/items/{id}/media の冪等性キー (Idempotency-Key ヘッダ) の挙動を検証する。
 */
class ItemMediaUploadIdempotencyTest extends TestCase
{
    private User $admin;
    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->admin = $this->createAdmin();
        $seller = $this->createSeller();
        $sellerProfile = SellerProfile::factory()->create(['user_id' => $seller->id]);
        $auction = Auction::factory()->create(['created_by' => $this->admin->id]);
        $this->item = Item::factory()->create([
            'auction_id' => $auction->id,
            'seller_profile_id' => $sellerProfile->id,
        ]);
        Storage::fake('public');
    }

    public function test_Idempotency_Keyなしでも従来通りアップロードできる(): void
    {
        $file = UploadedFile::fake()->image('a.jpg', 10, 10);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file,
                'media_type' => 'image',
            ]);

        $response->assertStatus(201);
        $this->assertSame(1, ItemMedia::where('item_id', $this->item->id)->count());
        $this->assertSame(0, IdempotencyKey::count());
    }

    public function test_同じKeyで再送するとレスポンスがリプレイされDBに重複登録されない(): void
    {
        $key = 'test-key-001';
        $file1 = UploadedFile::fake()->image('a.jpg', 10, 10);

        $first = $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file1,
                'media_type' => 'image',
            ]);
        $first->assertStatus(201);
        $firstBody = $first->json();

        // 同一内容で再送（リプレイ）
        $file2 = UploadedFile::fake()->image('a.jpg', 10, 10);
        $second = $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file2,
                'media_type' => 'image',
            ]);

        $second->assertStatus(201);
        $second->assertHeader('Idempotent-Replayed', 'true');
        $this->assertSame($firstBody, $second->json(), 'リプレイ時は保存済みレスポンスがそのまま返る');
        $this->assertSame(1, ItemMedia::where('item_id', $this->item->id)->count(), '二重登録されない');
    }

    public function test_同じKeyで異なる内容を送ると422(): void
    {
        $key = 'test-key-002';
        $file1 = UploadedFile::fake()->image('a.jpg', 10, 10);

        $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file1,
                'media_type' => 'image',
            ])->assertStatus(201);

        // 同じキーで内容違い (画像サイズが違う = ハッシュが違う)
        $file2 = UploadedFile::fake()->image('b.jpg', 20, 20);
        $response = $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file2,
                'media_type' => 'image',
            ]);

        $response->assertStatus(422);
        $this->assertSame(1, ItemMedia::where('item_id', $this->item->id)->count());
    }

    public function test_異なるKeyなら同じ内容でも別レコードとして登録される(): void
    {
        $file1 = UploadedFile::fake()->image('a.jpg', 10, 10);
        $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', 'k1')
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file1,
                'media_type' => 'image',
            ])->assertStatus(201);

        $file2 = UploadedFile::fake()->image('a.jpg', 10, 10);
        $this->actingAs($this->admin, 'sanctum')
            ->withHeader('Idempotency-Key', 'k2')
            ->post("/api/internal/items/{$this->item->id}/media", [
                'file'       => $file2,
                'media_type' => 'image',
            ])->assertStatus(201);

        $this->assertSame(2, ItemMedia::where('item_id', $this->item->id)->count());
        $this->assertSame(2, IdempotencyKey::count());
    }
}
