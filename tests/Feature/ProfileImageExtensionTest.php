<?php

namespace Tests\Feature;

use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * プロフィール画像の保存拡張子はファイルの中身から決める（2026-10-21 セキュリティ診断 H-1）。
 *
 * 先頭が JPEG で後ろに <script> を付けたファイルは image 検証を通る。申告された名前の拡張子
 * （.html）で保存すると /storage から同一オリジンの HTML として配信され、保存型 XSS になる。
 */
class ProfileImageExtensionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Storage::fake('public');
    }

    /**
     * 中身は本物の JPEG、名前は evil.html のファイル。
     * UploadedFile::fake() は MIME を名前から決めるため、実ファイルを test モードで包む。
     */
    private function jpegNamedHtml(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'h1');
        $image = imagecreatetruecolor(10, 10);
        imagejpeg($image, $path);
        imagedestroy($image);
        file_put_contents($path, '<script>alert(document.domain)</script>', FILE_APPEND);

        return new UploadedFile($path, 'evil.html', null, null, true);
    }

    private function assertStoredAsJpg(string $path): void
    {
        $this->assertStringEndsWith('.jpg', $path);
        Storage::disk('public')->assertExists($path);
    }

    public function test_participant_upload_is_saved_with_content_extension(): void
    {
        $participant = $this->createParticipant();

        $response = $this->actingAs($participant, 'sanctum')
            ->post('/api/participant/settings/profile/image', ['image' => $this->jpegNamedHtml()]);

        $response->assertStatus(200);
        $this->assertStoredAsJpg($participant->fresh()->profile_image_path);
    }

    public function test_seller_upload_is_saved_with_content_extension(): void
    {
        $seller = $this->createSeller();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($seller, 'sanctum')
            ->post('/api/seller/profile/image', ['image' => $this->jpegNamedHtml()]);

        $response->assertStatus(200);
        $this->assertStoredAsJpg($profile->fresh()->profile_image_path);
    }

    public function test_admin_user_icon_upload_is_saved_with_content_extension(): void
    {
        $admin = $this->createAdmin();
        $target = $this->createParticipant();

        $response = $this->actingAs($admin, 'sanctum')
            ->post("/api/admin/users/{$target->id}/profile-image", ['image' => $this->jpegNamedHtml()]);

        $response->assertStatus(200);
        $this->assertStoredAsJpg($target->fresh()->profile_image_path);
    }

    public function test_admin_seller_icon_upload_is_saved_with_content_extension(): void
    {
        $admin = $this->createAdmin();
        $seller = $this->createSeller();
        $profile = SellerProfile::factory()->create(['user_id' => $seller->id]);

        $response = $this->actingAs($admin, 'sanctum')
            ->post("/api/admin/users/{$seller->id}/seller-profile-image", ['image' => $this->jpegNamedHtml()]);

        $response->assertStatus(200);
        $this->assertStoredAsJpg($profile->fresh()->profile_image_path);
    }

    public function test_normal_png_keeps_png_extension(): void
    {
        $participant = $this->createParticipant();
        $file = UploadedFile::fake()->image('avatar.png', 50, 50);

        $this->actingAs($participant, 'sanctum')
            ->post('/api/participant/settings/profile/image', ['image' => $file])
            ->assertStatus(200);

        $path = $participant->fresh()->profile_image_path;
        $this->assertStringEndsWith('.png', $path);
        Storage::disk('public')->assertExists($path);
    }
}
