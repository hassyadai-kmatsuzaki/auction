<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\WonItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class EscrowTransactionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'won_item_id' => WonItem::factory(),
            'buyer_id' => User::factory(),
            'seller_id' => User::factory(),
            'amount' => $this->faker->numberBetween(1000, 50000),
            'status' => 'awaiting_payment',
        ];
    }
}
