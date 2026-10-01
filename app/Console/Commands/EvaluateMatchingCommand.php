<?php

namespace App\Console\Commands;

use App\Services\AI\MatchingService;
use Illuminate\Console\Command;

class EvaluateMatchingCommand extends Command
{
    protected $signature = 'ai:evaluate-matching {--auctions=3 : 検証に使う直近の開催数}';
    protected $description = 'マッチング（F-059）の予測力を過去の開催で検証する（実際の落札者が上位10人に入った割合）';

    public function handle(MatchingService $matching): int
    {
        $r = $matching->evaluate((int) $this->option('auctions'));

        $this->info("検証: 直近 {$r['auctions']} 開催・落札 {$r['items']} 件（各開催より前のデータだけで判定）");
        $this->table(
            ['指標', 'マッチング', '比較: よく落札する人上位10人'],
            [['実際の落札者が上位10人に入った割合', "{$r['hit_rate_at_10']}%", "{$r['baseline_hit_rate_at_10']}%"]],
        );
        $this->info("過去の行動データがある落札者の割合: {$r['coverage']}%");

        return self::SUCCESS;
    }
}
