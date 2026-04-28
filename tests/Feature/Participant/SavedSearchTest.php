<?php

namespace Tests\Feature\Participant;

use App\Models\SavedSearch;
use App\Models\User;
use Tests\TestCase;

class SavedSearchTest extends TestCase
{
    protected User $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
    }

    public function test_unauthenticated_user_cannot_access_saved_searches(): void
    {
        $this->getJson('/api/participant/saved-searches')->assertStatus(401);
        $this->postJson('/api/participant/saved-searches', [
            'name' => 'x', 'conditions' => [],
        ])->assertStatus(401);
        $this->deleteJson('/api/participant/saved-searches/1')->assertStatus(401);
    }

    public function test_seller_cannot_access_participant_saved_searches(): void
    {
        $seller = $this->createSeller();
        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/participant/saved-searches')
            ->assertStatus(403);
    }

    public function test_index_returns_only_own_searches_ordered_by_updated_at(): void
    {
        $other = $this->createParticipant();

        $old = SavedSearch::create([
            'user_id' => $this->participant->id,
            'name' => 'Older',
            'conditions' => ['species' => 'snake'],
            'notify_on_match' => false,
        ]);
        $old->updated_at = now()->subDay();
        $old->save();

        $new = SavedSearch::create([
            'user_id' => $this->participant->id,
            'name' => 'Newer',
            'conditions' => ['species' => 'gecko'],
            'notify_on_match' => true,
        ]);

        SavedSearch::create([
            'user_id' => $other->id,
            'name' => 'Other user',
            'conditions' => ['species' => 'lizard'],
            'notify_on_match' => false,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson('/api/participant/saved-searches');

        $response->assertOk()->assertJsonPath('success', true);
        $list = $response->json('data');
        $this->assertCount(2, $list);
        $this->assertSame($new->id, $list[0]['id']);
        $this->assertSame($old->id, $list[1]['id']);
    }

    public function test_store_creates_saved_search(): void
    {
        $payload = [
            'name' => 'お気に入り検索',
            'conditions' => [
                'species' => 'ボールパイソン',
                'price_min' => 10000,
                'price_max' => 50000,
            ],
            'notify_on_match' => true,
        ];

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'お気に入り検索')
            ->assertJsonPath('data.notify_on_match', true);

        $this->assertDatabaseHas('saved_searches', [
            'user_id' => $this->participant->id,
            'name' => 'お気に入り検索',
            'notify_on_match' => true,
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', [])
            ->assertStatus(422);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', [
                'name' => 'ok',
                'conditions' => 'not-an-array',
            ])->assertStatus(422);

        $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', [
                'name' => str_repeat('a', 101),
                'conditions' => [],
            ])->assertStatus(422);
    }

    public function test_store_rejects_when_limit_reached(): void
    {
        for ($i = 0; $i < 20; $i++) {
            SavedSearch::create([
                'user_id' => $this->participant->id,
                'name' => "search-{$i}",
                'conditions' => ['n' => $i],
                'notify_on_match' => false,
            ]);
        }

        $response = $this->actingAs($this->participant, 'sanctum')
            ->postJson('/api/participant/saved-searches', [
                'name' => 'limit-over',
                'conditions' => ['x' => 1],
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseMissing('saved_searches', [
            'user_id' => $this->participant->id,
            'name' => 'limit-over',
        ]);
    }

    public function test_destroy_deletes_own_saved_search(): void
    {
        $search = SavedSearch::create([
            'user_id' => $this->participant->id,
            'name' => 'to-delete',
            'conditions' => ['x' => 1],
            'notify_on_match' => false,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->deleteJson("/api/participant/saved-searches/{$search->id}");

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseMissing('saved_searches', ['id' => $search->id]);
    }

    public function test_destroy_cannot_delete_others_saved_search(): void
    {
        $other = $this->createParticipant();
        $search = SavedSearch::create([
            'user_id' => $other->id,
            'name' => 'theirs',
            'conditions' => ['x' => 1],
            'notify_on_match' => false,
        ]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->deleteJson("/api/participant/saved-searches/{$search->id}");

        $response->assertStatus(404);
        $this->assertDatabaseHas('saved_searches', ['id' => $search->id]);
    }

    public function test_destroy_returns_404_for_unknown_id(): void
    {
        $response = $this->actingAs($this->participant, 'sanctum')
            ->deleteJson('/api/participant/saved-searches/99999999');
        $response->assertStatus(404);
    }
}
