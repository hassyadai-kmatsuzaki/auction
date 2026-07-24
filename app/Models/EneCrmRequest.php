<?php

namespace App\Models;

/**
 * E-NE（Cal-Connect）CRM 更新 API への送信ログ兼キュー行。
 *
 * 作成時点では status=pending。実際の HTTP は SendEneCrmUpdateJob（notify キュー）が行い、
 * 結果をこの行に書き戻す。管理画面「設定 → 外部連携」から一覧・手動再送できる。
 */
class EneCrmRequest extends BaseModel
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_SUCCESS = 'success';
    public const STATUS_FAILED  = 'failed';
    public const STATUS_SKIPPED = 'skipped';

    public const EVENT_PASSWORD_SET            = 'password_set';
    public const EVENT_SUBSCRIPTION_PAID       = 'subscription_paid';
    public const EVENT_BANK_TRANSFER_REQUESTED = 'bank_transfer_requested';

    /**
     * イベントの表示名。キーは管理画面（EneCrmPushCard の EVENTS）と一致させること。
     *
     * @var array<string, string>
     */
    public const EVENT_LABELS = [
        self::EVENT_PASSWORD_SET            => 'パスワード設定完了',
        self::EVENT_SUBSCRIPTION_PAID       => '決済登録完了（カード）',
        self::EVENT_BANK_TRANSFER_REQUESTED => '銀行振込の申請',
    ];

    protected $fillable = [
        'event',
        'user_id',
        'line_user_id',
        'fields',
        'trigger_automation',
        'status',
        'http_status',
        'response',
        'error',
        'attempts',
        'sent_at',
    ];

    protected $casts = [
        'fields'             => 'array',
        'trigger_automation' => 'boolean',
        'sent_at'            => 'datetime',
    ];

    /**
     * line_user_id は個人を特定しうるため、API レスポンスでは伏せ字にして返す。
     * （管理画面のログ一覧では「送れたか」がわかればよい）
     */
    protected $hidden = ['line_user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getEventLabelAttribute(): string
    {
        return self::EVENT_LABELS[$this->event] ?? $this->event;
    }
}
