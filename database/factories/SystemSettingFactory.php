<?php

namespace Database\Factories;

use App\Models\SystemSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

class SystemSettingFactory extends Factory
{
    protected $model = SystemSetting::class;

    public function definition(): array
    {
        return [
            'category' => fake()->randomElement(['auction', 'fee', 'shipping']),
            'setting_key' => fake()->unique()->slug(2),
            'setting_value' => (string) fake()->numberBetween(1, 100),
            'value_type' => 'integer',
            'display_name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'is_public' => false,
        ];
    }

    public function auctionSetting(): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => 'auction',
        ]);
    }

    public function feeSetting(): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => 'fee',
        ]);
    }

    public function shippingSetting(): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => 'shipping',
        ]);
    }
}
