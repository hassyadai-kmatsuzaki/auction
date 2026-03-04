<?php

namespace Tests\Feature\Participant;

use App\Models\Auction;
use App\Models\Item;
use App\Models\Lane;
use App\Models\User;
use Tests\TestCase;

class LiveStateTest extends TestCase
{
    protected User $participant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->participant = $this->createParticipant();
    }

    public function test_ライブ状態にupcoming_itemsが含まれる(): void
    {
        $auction = Auction::factory()->live()->create();
        $lane    = Lane::factory()->create(['auction_id' => $auction->id, 'lane_number' => 1, 'status' => 'active']);

        $item1 = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'live']);
        $item2 = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered']);
        $item3 = Item::factory()->create(['auction_id' => $auction->id, 'status' => 'registered']);

        $lane->update(['current_item_id' => $item1->id]);
        $lane->items()->attach($item1->id, ['sequence_order' => 1]);
        $lane->items()->attach($item2->id, ['sequence_order' => 2]);
        $lane->items()->attach($item3->id, ['sequence_order' => 3]);

        $response = $this->actingAs($this->participant, 'sanctum')
            ->getJson("/api/participant/auctions/{$auction->id}/live");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'lanes' => [
                        '*' => [
                            'lane_id',
                            'upcoming_items',
                        ],
                    ],
                ],
            ]);

        $laneData = $response->json('data.lanes.0');
        $this->assertCount(2, $laneData['upcoming_items']);
        $this->assertEquals($item2->id, $laneData['upcoming_items'][0]['id']);
        $this->assertEquals($item3->id, $laneData['upcoming_items'][1]['id']);
    }
}
