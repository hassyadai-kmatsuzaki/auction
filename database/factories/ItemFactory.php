<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\Auction;
use App\Models\SellerProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

class ItemFactory extends Factory
{
    protected $model = Item::class;

    public function definition(): array
    {
        $startPrice = fake()->numberBetween(5000, 100000);
        
        return [
            'auction_id' => Auction::factory(),
            'seller_profile_id' => SellerProfile::factory(),
            'item_number' => fake()->unique()->numberBetween(1, 9999),
            'species_name' => fake()->randomElement([
                'ボールパイソン アルビノ',
                'レオパードゲッコー タンジェリン',
                'コーンスネーク アメラニスティック',
                'フトアゴヒゲトカゲ レッド',
            ]),
            'quantity' => fake()->numberBetween(1, 3),
            'start_price' => $startPrice,
            'current_price' => $startPrice,
            'reserve_price' => (int)($startPrice * 0.8),
            'estimated_price' => (int)($startPrice * 1.5),
            'bid_increment' => 100,
            'inspection_info' => '健康状態：良好',
            'individual_info' => '性別：オス',
            'notes' => fake()->sentence(),
            'is_premium' => false,
            'premium_fee' => 800,
            'status' => 'registered',
        ];
    }

    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'draft',
        ]);
    }

    public function registered(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'registered',
        ]);
    }

    public function live(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'live',
        ]);
    }

    public function sold(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'sold',
        ]);
    }

    public function unsold(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'unsold',
        ]);
    }

    public function premium(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_premium' => true,
        ]);
    }
}
