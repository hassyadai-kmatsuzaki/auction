<?php

namespace Database\Factories;

use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SellerProfileFactory extends Factory
{
    protected $model = SellerProfile::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'seller_code' => 'S' . fake()->unique()->numerify('###'),
            'seller_name' => fake()->company(),
            'contact_name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'postal_code' => fake()->postcode(),
            'prefecture' => fake()->randomElement(['東京都', '大阪府', '愛知県', '神奈川県']),
            'city' => fake()->city(),
            'address_line1' => fake()->streetAddress(),
            'address_line2' => null,
            'bank_name' => fake()->randomElement(['みずほ銀行', '三菱UFJ銀行', '三井住友銀行']),
            'bank_branch' => fake()->city() . '支店',
            'account_type' => 'savings',
            'account_number' => fake()->numerify('#######'),
            'account_holder' => fake()->name(),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
