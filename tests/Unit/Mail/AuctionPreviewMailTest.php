<?php

namespace Tests\Unit\Mail;

use App\Mail\AuctionPreviewMail;
use App\Models\Auction;
use Tests\TestCase;

/**
 * A-11 (2026-09-08): 予告メールは <x-mail::message> を使うので markdown: で描画できなければならない。
 * view: のままだと「No hint path defined for [mail]」で 5/21・8/27 のように全件失敗する。
 */
class AuctionPreviewMailTest extends TestCase
{
    public function test_予告メールは_描画できてタイトルを含む(): void
    {
        $this->seedRoles();
        $admin = $this->createAdmin();
        $auction = Auction::factory()->scheduled()->create(['created_by' => $admin->id, 'title' => '第9回テスト開催']);
        $user = $this->createParticipant();

        $html = (new AuctionPreviewMail($auction, $user))->render();

        $this->assertStringContainsString('第9回テスト開催', $html);
        $this->assertStringContainsString('明日', $html);
    }
}
