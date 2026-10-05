<?php

namespace App\Console\Commands;

use App\Models\Auction;
use App\Models\WonItem;
use App\Services\EscrowService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncEscrowCommand extends Command
{
    protected $signature = 'escrow:sync
        {--all : 全件を同期（既定は「エスクロー未作成」と「直近2日に更新された」落札商品のみ）}
        {--force : ライブ中のオークションがあっても実行する}';

    protected $description = '落札商品の入金・配送状態をエスクロー取引に同期する（F-032）。won_items は読むだけ';

    public function handle(EscrowService $service): int
    {
        // ライブ中は DB 負荷を足さない（次回の実行で追いつく）
        if (!$this->option('force') && Auction::where('status', 'live')->exists()) {
            $this->info('ライブ中のオークションがあるためスキップしました');
            return self::SUCCESS;
        }

        $query = WonItem::query();
        if (!$this->option('all')) {
            // WonItem モデル（ライブの落札処理で使う）は変更しないため、リレーションではなく副問い合わせで判定する
            $query->where(fn ($q) => $q
                ->whereNotExists(fn ($sub) => $sub->select(DB::raw(1))
                    ->from('escrow_transactions')
                    ->whereColumn('escrow_transactions.won_item_id', 'won_items.id'))
                ->orWhere('updated_at', '>=', now()->subDays(2)));
        }

        $synced = 0;
        $skipped = 0;
        $failed = 0;
        $query->with('item.sellerProfile')->chunkById(200, function ($wonItems) use ($service, &$synced, &$skipped, &$failed) {
            foreach ($wonItems as $wonItem) {
                // 1件の失敗で残りを止めない
                try {
                    $service->syncFromWonItem($wonItem) ? $synced++ : $skipped++;
                } catch (\Throwable $e) {
                    $failed++;
                    Log::error('escrow:sync failed', ['won_item_id' => $wonItem->id, 'error' => $e->getMessage()]);
                }
            }
        });

        $this->info("完了: 同期 {$synced} 件 / 対象外 {$skipped} 件 / 失敗 {$failed} 件");

        return self::SUCCESS;
    }
}
