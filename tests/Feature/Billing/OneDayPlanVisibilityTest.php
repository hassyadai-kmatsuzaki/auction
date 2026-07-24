<?php

namespace Tests\Feature\Billing;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * 単発プラン（1Day会員）の提示範囲。
 *
 * 1Day は allows_sell=false のため、ロール絞り込み（出品者=allows_sell / 落札者=!allows_sell）
 * だけでは落札者ロール全員のモーダルに並んでしまう（2026-07-24 報告）。
 * intended_plan_code='one_day' マーカー保持者＝E-NE「1Day」契約者だけに提示する。
 */
class OneDayPlanVisibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    /** one_day 行は migration が投入済みのため updateOrCreate で揃える。 */
    private function makeAnnualPlan(): Plan
    {
        return Plan::updateOrCreate(['code' => 'bid_only'], [
            'name'          => '落札者プラン',
            'amount'        => 5500,
            'duration_days' => null,
            'allows_bid'    => true,
            'allows_sell'   => false,
            'is_active'     => true,
            'sort_order'    => 1,
        ]);
    }

    private function makeOneDayPlan(): Plan
    {
        return Plan::updateOrCreate(['code' => 'one_day'], [
            'name'          => '1Day会員',
            'amount'        => 500,
            'duration_days' => 14,
            'allows_bid'    => true,
            'allows_sell'   => false,
            'is_active'     => true,
            'sort_order'    => 3,
        ]);
    }

    public function test_participant_without_marker_is_not_offered_one_day_plan(): void
    {
        $this->makeAnnualPlan();
        $this->makeOneDayPlan();
        $user = $this->createParticipant();

        $res = $this->actingAs($user, 'sanctum')->getJson('/api/me/subscription');

        $res->assertOk();
        $codes = collect($res->json('data.plans'))->pluck('code')->all();
        $this->assertSame(['bid_only'], $codes);
    }

    public function test_marker_holder_is_offered_only_the_one_day_plan(): void
    {
        $this->makeAnnualPlan();
        $this->makeOneDayPlan();
        $user = $this->createParticipant();
        $user->update(['intended_plan_code' => 'one_day']);

        $res = $this->actingAs($user, 'sanctum')->getJson('/api/me/subscription');

        $res->assertOk();
        $codes = collect($res->json('data.plans'))->pluck('code')->all();
        $this->assertSame(['one_day'], $codes);
    }

    public function test_one_day_plan_is_hidden_when_marker_plan_is_deactivated(): void
    {
        // マーカーのプランが無効化されている場合は安全側=年会費プランを提示する
        // （マーカー1択にすると誰も加入できなくなるため）。
        $this->makeAnnualPlan();
        $this->makeOneDayPlan()->update(['is_active' => false]);
        $user = $this->createParticipant();
        $user->update(['intended_plan_code' => 'one_day']);

        $res = $this->actingAs($user, 'sanctum')->getJson('/api/me/subscription');

        $res->assertOk();
        $codes = collect($res->json('data.plans'))->pluck('code')->all();
        $this->assertSame(['bid_only'], $codes);
    }

    public function test_participant_without_marker_cannot_post_one_day_plan(): void
    {
        $this->makeAnnualPlan();
        $oneDay = $this->makeOneDayPlan();
        $user = $this->createParticipant();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/me/subscription', [
                'plan_id'        => $oneDay->id,
                'payment_method' => 'bank_transfer',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'ご契約の会員種別のプランをご選択ください');

        $this->assertDatabaseMissing('subscriptions', ['user_id' => $user->id]);
    }

    public function test_marker_holder_can_post_one_day_plan(): void
    {
        Mail::fake();
        $this->makeAnnualPlan();
        $oneDay = $this->makeOneDayPlan();
        $user = $this->createParticipant();
        $user->update(['intended_plan_code' => 'one_day']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/me/subscription', [
                'plan_id'        => $oneDay->id,
                'payment_method' => 'bank_transfer',
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $oneDay->id,
        ]);
        // 決済（申込）完了でマーカーは解除される
        $this->assertNull(User::find($user->id)->intended_plan_code);
    }

    public function test_seller_is_offered_only_the_sell_capable_plan(): void
    {
        $this->makeAnnualPlan();
        $this->makeOneDayPlan();
        Plan::updateOrCreate(['code' => 'both'], [
            'name'          => '落札出品者プラン',
            'amount'        => 11000,
            'duration_days' => null,
            'allows_bid'    => true,
            'allows_sell'   => true,
            'is_active'     => true,
            'sort_order'    => 2,
        ]);
        $seller = $this->createSeller();

        $res = $this->actingAs($seller, 'sanctum')->getJson('/api/me/subscription');

        $res->assertOk();
        // サーバーは単発プランを落とす。allows_sell の絞り込みはフロント側（出品者=both のみ表示）。
        $codes = collect($res->json('data.plans'))->pluck('code')->all();
        $this->assertNotContains('one_day', $codes);
    }
}
