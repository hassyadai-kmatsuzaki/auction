<?php

namespace Database\Factories;

use App\Models\Auction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AuctionFactory extends Factory
{
    protected $model = Auction::class;

    public function definition(): array
    {
        return [
            'title' => fake()->sentence(3),
            'event_date' => fake()->dateTimeBetween('now', '+1 month'),
            'start_time' => '10:00:00',
            'status' => 'scheduled',
            'description' => fake()->paragraph(),
            'lane_count' => fake()->numberBetween(2, 6),
            'default_bid_increment' => 100,
            'countdown_seconds' => 3,
            'deposit_required' => false,
            'upload_deadline' => fake()->dateTimeBetween('now', '+1 week'),
            'payment_deadline_hours' => 24,
            'shipping_deadline_hours' => 48,
            'created_by' => User::factory(),
        ];
    }

    public function preparing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'preparing',
        ]);
    }

    public function scheduled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'scheduled',
        ]);
    }

    public function live(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'live',
        ]);
    }

    public function finished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'finished',
            'event_date' => fake()->dateTimeBetween('-1 month', '-1 day'),
            // テストでの finished はデフォルトで公開状態とみなす。
            // 「終了しているが未公開」を再現したいテストは ->state(['is_published' => false]) で上書きする。
            'is_published' => true,
            'published_at' => now()->subHour(),
        ]);
    }

    /**
     * 「未公開」状態を明示する state（is_published=false テスト用）。
     */
    public function unpublished(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_published' => false,
            'published_at' => null,
        ]);
    }

    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'cancelled',
        ]);
    }
}
