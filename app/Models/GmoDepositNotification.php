<?php

namespace App\Models;

/**
 * GMOあおぞら 入金明細通知の受信ログ兼消込結果。
 */
class GmoDepositNotification extends BaseModel
{
    protected $table = 'gmo_deposit_notifications';

    public const STATUS_RECEIVED  = 'received';   // 受信済み・未処理
    public const STATUS_MATCHED   = 'matched';    // 落札者・金額を特定（入金確認は未反映＝管理者待ち）
    public const STATUS_CONFIRMED = 'confirmed';  // won_items へ入金確認を反映済み
    public const STATUS_UNMATCHED = 'unmatched';  // 突合できず（管理者が手動で紐付ける）
    public const STATUS_IGNORED   = 'ignored';    // 対象外イベント等
    public const STATUS_ERROR     = 'error';

    public const REASON_NO_VA          = 'no_va';
    public const REASON_VA_UNASSIGNED  = 'va_unassigned';
    public const REASON_NO_OPEN_ITEMS  = 'no_open_items';
    public const REASON_AMOUNT_MISMATCH = 'amount_mismatch';

    protected $fillable = [
        'message_id',
        'source',
        'event_type',
        'va_id',
        'item_key',
        'deposit_amount',
        'remitter_name_kana',
        'transaction_date',
        'payload',
        'status',
        'unmatched_reason',
        'matched_user_id',
        'won_item_ids',
        'expected_amount',
        'received_at',
        'processed_at',
        'confirmed_at',
        'confirmed_by',
        'processing_error',
    ];

    protected $casts = [
        'deposit_amount'   => 'integer',
        'expected_amount'  => 'integer',
        'transaction_date' => 'date',
        'won_item_ids'     => 'array',
        'received_at'      => 'datetime',
        'processed_at'     => 'datetime',
        'confirmed_at'     => 'datetime',
    ];

    public function matchedUser()
    {
        return $this->belongsTo(User::class, 'matched_user_id');
    }

    public function confirmedBy()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function virtualAccount()
    {
        return $this->belongsTo(GmoVirtualAccount::class, 'va_id', 'va_id');
    }

    /**
     * 受信ボディを配列で返す。
     */
    public function payloadArray(): array
    {
        $decoded = json_decode((string) $this->payload, true);
        return is_array($decoded) ? $decoded : [];
    }
}
