<?php

namespace Database\Factories;

use App\Models\Bid;
use App\Models\Item;
use App\Models\User;
use App\Models\Lane;
use Illuminate\Database\Eloquent\Factories\Factory;

class BidFactory extends Factory
{
    protected $model = Bid::class;

    public function definition(): array
    {
        return [
            'item_id' => Item::factory(),
            'lane_id' => Lane::factory(),
            'user_id' => User::factory(),
            'bid_amount' => fake()->numberBetween(10000, 100000),
            'is_winning' => false,
        ];
    }

    public function winning(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_winning' => true,
        ]);
    }
}
