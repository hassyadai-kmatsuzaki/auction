<?php

namespace Database\Factories;

use App\Models\WonItem;
use App\Models\Item;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class WonItemFactory extends Factory
{
    protected $model = WonItem::class;

    public function definition(): array
    {
        $winningPrice = fake()->numberBetween(10000, 100000);
        $commissionRate = 5;
        $commissionAmount = max(300, $winningPrice * $commissionRate / 100);

        return [
            'item_id' => Item::factory()->sold(),
            'winner_id' => User::factory(),
            'winning_price' => $winningPrice,
            'quantity' => 1,
            'total_amount' => $winningPrice + $commissionAmount + 800,
            'commission_rate' => $commissionRate,
            'commission_amount' => $commissionAmount,
            'seller_amount' => $winningPrice - ($winningPrice * 10 / 100),
            'payment_status' => 'pending',
            'payment_method' => null,
            'paid_at' => null,
            'payment_confirmed_at' => null,
            'payment_deadline' => now()->addDays(3),
            'delivery_method' => 'shipping',
            'delivery_status' => 'pending',
            'shipping_postal_code' => fake()->postcode(),
            'shipping_prefecture' => '東京都',
            'shipping_city' => '渋谷区',
            'shipping_address_line1' => fake()->streetAddress(),
            'shipping_name' => fake()->name(),
            'shipping_phone' => fake()->phoneNumber(),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_status' => 'paid',
            'payment_method' => 'bank_transfer',
            'paid_at' => now(),
        ]);
    }

    public function confirmed(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_status' => 'confirmed',
            'payment_method' => 'bank_transfer',
            'paid_at' => now()->subDay(),
            'payment_confirmed_at' => now(),
            'delivery_status' => 'preparing',
        ]);
    }

    public function shipped(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_status' => 'confirmed',
            'payment_method' => 'bank_transfer',
            'paid_at' => now()->subDays(2),
            'payment_confirmed_at' => now()->subDay(),
            'delivery_status' => 'shipped',
            'shipping_company' => 'ヤマト運輸',
            'tracking_number' => fake()->numerify('####-####-####'),
            'shipped_at' => now(),
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_status' => 'confirmed',
            'delivery_status' => 'completed',
            'delivered_at' => now(),
        ]);
    }
}
