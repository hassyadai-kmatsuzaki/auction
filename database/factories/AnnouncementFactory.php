<?php

namespace Database\Factories;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AnnouncementFactory extends Factory
{
    protected $model = Announcement::class;

    public function definition(): array
    {
        return [
            'title' => fake()->sentence(5),
            'content' => fake()->paragraphs(3, true),
            'target_roles' => ['admin', 'seller', 'participant'],
            'is_important' => false,
            'status' => 'published',
            'published_at' => now(),
            'created_by' => User::factory(),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'draft',
            'published_at' => null,
        ]);
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'published',
            'published_at' => now(),
        ]);
    }

    public function important(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_important' => true,
        ]);
    }

    public function forSellers(): static
    {
        return $this->state(fn (array $attributes) => [
            'target_roles' => ['seller'],
        ]);
    }

    public function forParticipants(): static
    {
        return $this->state(fn (array $attributes) => [
            'target_roles' => ['participant'],
        ]);
    }
}
