<?php

namespace App\Services\GmoAozora;

use App\Models\GmoDepositNotification;
use Carbon\Carbon;
use Illuminate\Database\QueryException;

/**
 * 入金明細（Webhook のボディ / 入金明細照会 API の1行）を gmo_deposit_notifications に冪等登録する。
 */
class GmoDepositIngestService
{
    /**
     * Webhook ボディ（messageId + vaTransaction）を登録する。既存なら null。
     */
    public function ingestWebhook(array $payload, string $rawBody): ?GmoDepositNotification
    {
        $messageId = (string) ($payload['messageId'] ?? '');
        if ($messageId === '') {
            return null;
        }
        return $this->create($messageId, 'webhook', $payload['vaTransaction'] ?? [], $rawBody, (string) ($payload['eventType'] ?? 'va-deposit-transaction'));
    }

    /**
     * 入金明細照会 API の1行を登録する（message_id = sync:{vaId}:{itemKey}）。
     * 同じ明細が Webhook で先に届いていれば登録しない。
     */
    public function ingestSyncedTransaction(array $tx): ?GmoDepositNotification
    {
        $vaId = (string) ($tx['vaId'] ?? '');
        $itemKey = (string) ($tx['itemKey'] ?? '');
        if ($vaId === '' || $itemKey === '') {
            return null;
        }
        $already = GmoDepositNotification::where('va_id', $vaId)->where('item_key', $itemKey)->exists();
        if ($already) {
            return null;
        }
        return $this->create("sync:{$vaId}:{$itemKey}", 'sync', $tx, json_encode($tx, JSON_UNESCAPED_UNICODE));
    }

    private function create(string $messageId, string $source, array $tx, string $rawBody, string $eventType = 'va-deposit-transaction'): ?GmoDepositNotification
    {
        if (GmoDepositNotification::where('message_id', $messageId)->exists()) {
            return null;
        }

        $txDate = null;
        if (!empty($tx['transactionDate'])) {
            try {
                $txDate = Carbon::parse($tx['transactionDate'])->toDateString();
            } catch (\Throwable) {
                $txDate = null;
            }
        }

        try {
            return GmoDepositNotification::create([
                'message_id'        => $messageId,
                'source'            => $source,
                'event_type'        => mb_substr($eventType, 0, 40),
                'va_id'             => isset($tx['vaId']) ? mb_substr((string) $tx['vaId'], 0, 10) : null,
                'item_key'          => isset($tx['itemKey']) ? mb_substr((string) $tx['itemKey'], 0, 24) : null,
                'deposit_amount'    => (int) preg_replace('/\D/', '', (string) ($tx['depositAmount'] ?? '0')),
                'remitter_name_kana' => isset($tx['remitterNameKana']) ? mb_substr((string) $tx['remitterNameKana'], 0, 48) : null,
                'transaction_date'  => $txDate,
                'payload'           => $rawBody,
                'status'            => GmoDepositNotification::STATUS_RECEIVED,
                'received_at'       => now(),
            ]);
        } catch (QueryException $e) {
            // unique 制約（同時到着の再送）→ 既存扱い
            if (GmoDepositNotification::where('message_id', $messageId)->exists()) {
                return null;
            }
            throw $e;
        }
    }
}
