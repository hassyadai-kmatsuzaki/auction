<?php

namespace Tests\Feature\Console;

use App\Models\ActivityEvent;
use App\Models\Item;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BackfillLoginHistoryCommandTest extends TestCase
{
    private User $bidder;
    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->bidder = $this->createParticipant();
        $this->item = Item::factory()->create();

        // 計測開始（本物のログイン記録の最古）= 2026-07-09 10:00
        $this->insertRealLogin($this->bidder->id, '2026-07-09 10:00:00');
    }

    public function test_backfills_token_and_manual_bid_logins_before_tracking_start(): void
    {
        // ① 計測開始前のトークン（確定）と、開始後のトークン（対象外）
        $this->insertToken($this->bidder->id, '2026-06-01 09:00:00');
        $this->insertToken($this->bidder->id, '2026-07-10 09:00:00');

        // ② 6/1 はトークンがあるので推定は入らない。6/5 は2件のうち最初の1件だけ
        $this->insertBidEvent($this->bidder->id, 'join', '2026-06-01 12:00:00', '203.0.113.1', 'Mozilla/5.0');
        $this->insertBidEvent($this->bidder->id, 'join', '2026-06-05 13:00:00', '203.0.113.5', 'Mozilla/5.0 (iPhone)');
        $this->insertBidEvent($this->bidder->id, 'leave', '2026-06-05 14:00:00', '203.0.113.6', 'Mozilla/5.0');
        // 指値の自動発動・システム記録は本人操作ではないので対象外
        $this->insertBidEvent($this->bidder->id, 'join', '2026-06-07 13:00:00', null, 'auto-bid-from-limit');
        $this->insertBidEvent($this->bidder->id, 'win', '2026-06-08 13:00:00', null, null);

        $this->artisan('activity:backfill-logins')->assertSuccessful();

        $rows = ActivityEvent::query()
            ->where('user_id', $this->bidder->id)
            ->where('dedup_key', 'like', 'bf:%')
            ->orderBy('created_at')
            ->get();

        $this->assertCount(2, $rows);
        $this->assertSame('2026-06-01 09:00:00', $rows[0]->created_at->toDateTimeString());
        $this->assertSame('token', $rows[0]->meta['source']);
        $this->assertNull($rows[0]->ip_address);

        $this->assertSame('2026-06-05 13:00:00', $rows[1]->created_at->toDateTimeString());
        $this->assertSame('bid', $rows[1]->meta['source']);
        $this->assertSame('203.0.113.5', $rows[1]->ip_address);
        $this->assertTrue($rows[1]->meta['backfilled']);
    }

    public function test_wider_before_skips_periods_already_recorded(): void
    {
        // 計測開始後のトークン＋本物のログイン（同一リクエストなので数秒差）
        $this->insertToken($this->bidder->id, '2026-07-09 09:59:58');
        // 本物のログインがある日の入札は推定を入れない
        $this->insertBidEvent($this->bidder->id, 'join', '2026-07-09 13:00:00', '203.0.113.9', 'Mozilla/5.0');
        // 記録の無い日は入る
        $this->insertToken($this->bidder->id, '2026-07-12 08:00:00');

        $this->artisan('activity:backfill-logins --before=2026-08-01')->assertSuccessful();

        $rows = ActivityEvent::query()->where('dedup_key', 'like', 'bf:%')->get();
        $this->assertCount(1, $rows);
        $this->assertSame('2026-07-12 08:00:00', $rows[0]->created_at->toDateTimeString());
    }

    public function test_rerun_does_not_duplicate(): void
    {
        $this->insertToken($this->bidder->id, '2026-06-01 09:00:00');
        $this->insertBidEvent($this->bidder->id, 'join', '2026-06-05 13:00:00', '203.0.113.5', 'Mozilla/5.0');

        $this->artisan('activity:backfill-logins')->assertSuccessful();
        $this->artisan('activity:backfill-logins')->assertSuccessful();

        $this->assertSame(2, ActivityEvent::query()->where('dedup_key', 'like', 'bf:%')->count());
    }

    public function test_dry_run_writes_nothing(): void
    {
        $this->insertToken($this->bidder->id, '2026-06-01 09:00:00');
        $this->insertBidEvent($this->bidder->id, 'join', '2026-06-05 13:00:00', '203.0.113.5', 'Mozilla/5.0');

        $this->artisan('activity:backfill-logins --dry-run')->assertSuccessful();

        $this->assertSame(0, ActivityEvent::query()->where('dedup_key', 'like', 'bf:%')->count());
    }

    public function test_users_without_any_action_are_skipped(): void
    {
        $idle = $this->createParticipant();
        $this->insertToken($idle->id, '2026-06-01 09:00:00');

        $this->artisan('activity:backfill-logins')->assertSuccessful();

        $this->assertSame(0, ActivityEvent::query()->where('user_id', $idle->id)->where('dedup_key', 'like', 'bf:%')->count());
    }

    public function test_login_history_api_marks_backfilled_rows(): void
    {
        $admin = $this->createAdmin();
        $this->insertToken($this->bidder->id, '2026-06-01 09:00:00');
        $this->insertBidEvent($this->bidder->id, 'join', '2026-06-05 13:00:00', '203.0.113.5', 'Mozilla/5.0');
        $this->artisan('activity:backfill-logins')->assertSuccessful();

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/users/{$this->bidder->id}/login-history")
            ->assertStatus(200)
            ->assertJsonPath('data.total', 3)
            ->assertJsonPath('data.history.0.backfill_source', null)
            ->assertJsonPath('data.history.1.backfill_source', 'bid')
            ->assertJsonPath('data.history.2.backfill_source', 'token');
    }

    private function insertRealLogin(int $userId, string $at): void
    {
        DB::table('activity_events')->insert([
            'user_id' => $userId,
            'event_type' => ActivityEvent::LOGIN,
            'created_at' => $at,
        ]);
    }

    private function insertToken(int $userId, string $at): void
    {
        DB::table('personal_access_tokens')->insert([
            'tokenable_type' => User::class,
            'tokenable_id' => $userId,
            'name' => 'auth-token',
            'token' => hash('sha256', uniqid('', true)),
            'abilities' => '["*"]',
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    private function insertBidEvent(int $userId, string $type, string $at, ?string $ip, ?string $ua): void
    {
        DB::table('bid_events')->insert([
            'item_id' => $this->item->id,
            'user_id' => $userId,
            'event_type' => $type,
            'price_at_event' => 1000,
            'ip_address' => $ip,
            'user_agent' => $ua,
            'created_at' => $at,
        ]);
    }
}
