<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * email_campaigns に対する 1 ユーザー単位の送信レコード。
 *
 * 送信時点のメアドを email カラムに保存する（ユーザーがメアド変更しても履歴は固定）。
 * status: queued → sent / failed / bounced / complained / skipped
 */
class EmailCampaignRecipient extends BaseModel
{
    protected $fillable = [
        'email_campaign_id',
        'user_id',
        'email',
        'status',
        'sent_at',
        'error',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(EmailCampaign::class, 'email_campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
