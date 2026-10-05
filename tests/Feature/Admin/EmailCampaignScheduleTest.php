<?php

namespace Tests\Feature\Admin;

use App\Jobs\DispatchEmailCampaignJob;
use App\Models\EmailCampaign;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * F-093 一斉メールの予約配信
 */
class EmailCampaignScheduleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        Queue::fake();
    }

    private function create(array $extra = [])
    {
        return $this->actingAs($this->createAdmin(), 'sanctum')->postJson('/api/admin/email-campaigns', array_merge([
            'subject' => 'お知らせ',
            'body_markdown' => '本文',
            'target_type' => 'all',
        ], $extra));
    }

    public function test_scheduled_campaign_is_dispatched_with_delay(): void
    {
        config(['features.campaign_schedule' => true]);
        $at = now()->addDays(2)->startOfMinute();

        $this->create(['scheduled_at' => $at->toIso8601String()])
            ->assertStatus(201)
            ->assertJsonPath('message', '配信を予約しました');

        Queue::assertPushed(DispatchEmailCampaignJob::class, fn ($job) => $job->delay !== null && $job->delay->equalTo($at));
    }

    public function test_without_schedule_it_is_dispatched_immediately(): void
    {
        config(['features.campaign_schedule' => true]);

        $this->create()->assertStatus(201)->assertJsonPath('message', 'キャンペーンを投入しました');

        Queue::assertPushed(DispatchEmailCampaignJob::class, fn ($job) => $job->delay === null);
    }

    public function test_feature_off_keeps_immediate_dispatch(): void
    {
        $this->create(['scheduled_at' => now()->addDay()->toIso8601String()])->assertStatus(201);

        Queue::assertPushed(DispatchEmailCampaignJob::class, fn ($job) => $job->delay === null);
    }

    public function test_job_redelays_when_run_before_schedule_and_skips_cancelled(): void
    {
        config(['features.campaign_schedule' => true]);
        $campaign = EmailCampaign::create([
            'subject' => 's', 'body_markdown' => 'b', 'target_type' => 'all', 'status' => 'queued',
            'created_by' => $this->createAdmin()->id, 'scheduled_at' => now()->addHour(),
        ]);

        (new DispatchEmailCampaignJob($campaign->id))->handle();
        $this->assertSame('queued', $campaign->fresh()->status);
        Queue::assertPushed(DispatchEmailCampaignJob::class, fn ($job) => $job->delay !== null);

        $campaign->update(['status' => 'cancelled', 'scheduled_at' => now()->subMinute()]);
        (new DispatchEmailCampaignJob($campaign->id))->handle();
        $this->assertSame('cancelled', $campaign->fresh()->status);
    }
}
