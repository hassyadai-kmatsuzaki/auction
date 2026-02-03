<?php

namespace Database\Factories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoleFactory extends Factory
{
    protected $model = Role::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement(['admin', 'seller', 'participant']),
            'display_name' => fake()->word(),
            'description' => fake()->sentence(),
        ];
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => 'admin',
            'display_name' => '管理者',
        ]);
    }

    public function seller(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => 'seller',
            'display_name' => '出品者',
        ]);
    }

    public function participant(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => 'participant',
            'display_name' => '買受者',
        ]);
    }
}
