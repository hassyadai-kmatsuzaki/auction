<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * メール一斉/個別配信のキャンペーン本体。
 *
 * target_type ごとの解釈:
 * - all:    承認済み・配信可能（バウンス/苦情/opt-out なし）の全ユーザーが対象
 * - filter: target_filter の条件（role / has_won / last_login_before 等）で絞った全員が対象
 * - manual: target_user_ids に列挙された ID のユーザーのみ。個別送信はこの形（n=1）
 *
 * status 遷移: draft → queued → sending → sent / cancelled / failed
 */
class EmailCampaign extends BaseModel
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'subject',
        'body_markdown',
        'target_type',
        'target_filter',
        'target_user_ids',
        'status',
        'created_by',
        'scheduled_at',
        'started_at',
        'completed_at',
        'total_recipients',
        'sent_count',
        'failed_count',
    ];

    protected $casts = [
        'target_filter' => 'array',
        'target_user_ids' => 'array',
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'total_recipients' => 'integer',
        'sent_count' => 'integer',
        'failed_count' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(EmailCampaignRecipient::class);
    }

    public function isCancellable(): bool
    {
        return in_array($this->status, ['draft', 'queued'], true);
    }

    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }
}
