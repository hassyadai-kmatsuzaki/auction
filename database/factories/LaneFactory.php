<?php

namespace Database\Factories;

use App\Models\Lane;
use App\Models\Auction;
use Illuminate\Database\Eloquent\Factories\Factory;

class LaneFactory extends Factory
{
    protected $model = Lane::class;

    public function definition(): array
    {
        return [
            'auction_id' => Auction::factory(),
            'lane_number' => fake()->numberBetween(1, 10),
            'status' => 'waiting',
            'current_item_id' => null,
        ];
    }

    public function waiting(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'waiting',
        ]);
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
        ]);
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'paused',
        ]);
    }

    public function finished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'finished',
        ]);
    }
}
