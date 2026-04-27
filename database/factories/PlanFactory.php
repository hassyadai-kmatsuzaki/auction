<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlanFactory extends Factory
{
    protected $model = Plan::class;

    public function definition(): array
    {
        return [
            'code' => $this->faker->unique()->slug(2),
            'name' => $this->faker->words(2, true),
            'description' => $this->faker->sentence(),
            'amount' => 12000,
            'allows_bid' => true,
            'allows_sell' => true,
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    public function bidOnly(): self
    {
        return $this->state(fn () => ['allows_bid' => true, 'allows_sell' => false, 'code' => 'bid_only_' . $this->faker->unique()->lexify('???')]);
    }

    public function sellOnly(): self
    {
        return $this->state(fn () => ['allows_bid' => false, 'allows_sell' => true, 'code' => 'sell_only_' . $this->faker->unique()->lexify('???')]);
    }

    public function both(): self
    {
        return $this->state(fn () => ['allows_bid' => true, 'allows_sell' => true, 'code' => 'both_' . $this->faker->unique()->lexify('???')]);
    }
}
