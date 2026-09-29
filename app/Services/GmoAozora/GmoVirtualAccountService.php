<?php

namespace App\Services\GmoAozora;

use App\Models\GmoVirtualAccount;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 振込入金口座（バーチャル口座）の台帳管理。
 *
 * - GMO の /va/list を取り込んで台帳を同期する
 * - 未割当の口座を落札者に割り当てる（プールが尽きたら /va/issue で発行）
 * - 入金明細通知の vaId → 落札者 の解決
 */
class GmoVirtualAccountService
{
    public function __construct(private readonly GmoAozoraClient $client)
    {
    }

    public function environment(): string
    {
        return $this->client->environment();
    }

    /**
     * 落札者に割り当て済みの利用可能口座。無ければ null。
     */
    public function findForUser(User|int $user): ?GmoVirtualAccount
    {
        $userId = $user instanceof User ? $user->id : $user;
        return GmoVirtualAccount::environment()->available()->where('user_id', $userId)->first();
    }

    /**
     * vaId から台帳行を引く。
     */
    public function findByVaId(string $vaId): ?GmoVirtualAccount
    {
        return GmoVirtualAccount::environment()->where('va_id', $vaId)->first();
    }

    /**
     * 落札者へ口座を割り当てる（既に持っていればそれを返す）。
     * プールに未割当口座が無ければ $issueIfEmpty=true のとき GMO に発行を依頼する。
     */
    public function assignToUser(User $user, bool $issueIfEmpty = true): GmoVirtualAccount
    {
        if ($existing = $this->findForUser($user)) {
            return $existing;
        }

        $assigned = DB::transaction(function () use ($user) {
            $va = GmoVirtualAccount::environment()->available()->unassigned()
                ->orderBy('id')->lockForUpdate()->first();
            if (!$va) {
                return null;
            }
            $va->forceFill(['user_id' => $user->id, 'assigned_at' => now()])->save();
            return $va;
        });

        if ($assigned) {
            Log::channel('audit')->info('GMO_AOZORA_VA_ASSIGNED', ['va_id' => $assigned->va_id, 'user_id' => $user->id]);
            return $assigned;
        }

        if (!$issueIfEmpty) {
            throw new GmoAozoraApiException('未割当の振込入金口座がありません。先に発行してください。', 0, 'VA_POOL_EMPTY', [], 'assignToUser');
        }

        $this->issue(1);
        return $this->assignToUser($user, false);
    }

    /**
     * GMO に口座発行を依頼し、台帳へ登録する。
     *
     * @return array<int, GmoVirtualAccount>
     */
    public function issue(int $count, string $vaTypeCode = '2'): array
    {
        $raId = $this->client->resolveRaAccountId();
        $data = $this->client->vaIssue($count, $raId, $vaTypeCode);

        $created = [];
        foreach ($data['vaList'] ?? [] as $row) {
            $created[] = GmoVirtualAccount::updateOrCreate(
                ['environment' => $this->environment(), 'va_id' => (string) $row['vaId']],
                [
                    'branch_code'      => (string) ($row['vaBranchCode'] ?? ''),
                    'branch_name_kana' => $row['vaBranchNameKana'] ?? null,
                    'account_number'   => (string) ($row['vaAccountNumber'] ?? ''),
                    'holder_name_kana' => $data['vaHolderNameKana'] ?? null,
                    'va_type_code'     => (string) ($data['vaTypeCode'] ?? $vaTypeCode),
                    'status_code'      => GmoVirtualAccount::STATUS_AVAILABLE,
                    'ra_id'            => $raId,
                    'expire_at'        => !empty($data['expireDateTime']) ? self::parseDateTime($data['expireDateTime']) : null,
                    'raw'              => $row,
                ]
            );
        }
        return $created;
    }

    /**
     * GMO の一覧照会で台帳を同期する（状態・名義・最終入金日）。
     *
     * @return int 取り込んだ件数
     */
    public function syncFromBank(): int
    {
        $raId = $this->client->resolveRaAccountId();
        $count = 0;
        $nextItemKey = null;

        do {
            $filter = ['raId' => $raId];
            if ($nextItemKey) {
                $filter['nextItemKey'] = $nextItemKey;
            }
            $data = $this->client->vaList($filter);

            foreach ($data['vAccounts'] ?? [] as $row) {
                GmoVirtualAccount::updateOrCreate(
                    ['environment' => $this->environment(), 'va_id' => (string) $row['vaId']],
                    [
                        'branch_code'      => (string) ($row['vaBranchCode'] ?? ''),
                        'branch_name_kana' => $row['vaBranchNameKana'] ?? null,
                        'account_number'   => (string) ($row['vaAccountNumber'] ?? ''),
                        'holder_name_kana' => $row['vaHolderNameKana'] ?? null,
                        'va_type_code'     => (string) ($row['vaTypeCode'] ?? '2'),
                        'status_code'      => (string) ($row['vaStatusCode'] ?? GmoVirtualAccount::STATUS_AVAILABLE),
                        'ra_id'            => $row['raId'] ?? $raId,
                        'expire_at'        => !empty($row['expireDateTime']) ? self::parseDateTime($row['expireDateTime']) : null,
                        'last_deposit_at'  => !empty($row['latestDepositDate']) ? self::parseDateTime($row['latestDepositDate']) : null,
                        'raw'              => $row,
                    ]
                );
                $count++;
            }

            $nextItemKey = !empty($data['hasNext']) ? ($data['nextItemKey'] ?? null) : null;
        } while ($nextItemKey);

        return $count;
    }

    private static function parseDateTime(string $value): ?\Carbon\Carbon
    {
        try {
            return \Carbon\Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
