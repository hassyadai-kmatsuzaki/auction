<?php

namespace Database\Factories;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    protected $model = Subscription::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'plan_id' => Plan::factory(),
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_start' => now()->subMonth(),
            'current_period_end' => now()->addYear(),
        ];
    }

    public function expired(): self
    {
        return $this->state(fn () => [
            'status' => Subscription::STATUS_CANCELED,
            'current_period_end' => now()->subDay(),
            'canceled_at' => now()->subDay(),
        ]);
    }

    public function suspended(): self
    {
        return $this->state(fn () => [
            'status' => Subscription::STATUS_SUSPENDED,
            'suspended_at' => now(),
        ]);
    }
}
