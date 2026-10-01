<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 機械学習モデルの登録簿（F-053）
 */
class AIModel extends Model
{
    protected $table = 'ai_models';

    protected $fillable = [
        'name',
        'version',
        'algorithm',
        'params',
        'metrics',
        'train_samples',
        'test_samples',
        'artifact',
        'is_active',
        'trained_at',
    ];

    protected function casts(): array
    {
        return [
            'params' => 'array',
            'metrics' => 'array',
            'artifact' => 'array',
            'is_active' => 'boolean',
            'trained_at' => 'datetime',
        ];
    }

    public static function active(string $name): ?self
    {
        return static::where('name', $name)->where('is_active', true)->latest('version')->first();
    }

    public function label(): string
    {
        return "ml-{$this->name}-v{$this->version}";
    }
}
