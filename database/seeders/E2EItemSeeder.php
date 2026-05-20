<?php

namespace Database\Seeders;

use App\Models\Auction;
use App\Models\Item;
use App\Models\ItemMedia;
use App\Models\Lane;
use App\Models\SellerProfile;
use App\Models\SpeciesType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * E2E 用の生体（items）を最大 200 件作成する seeder。
 *
 * 本番 DB に対して安全に流せるよう、以下を遵守する:
 *   - 既存 items は触らない（auction にすでに items がある場合は abort）
 *   - メディアファイル本体は public/img/demo/medaka 配下を URL 参照のみ（コピー無し）
 *   - 1 アイテム = 1 トランザクション。途中で落ちても他に波及しない
 *   - DatabaseSeeder からは呼ばない。明示起動のみ:
 *       sudo -u ec2-user E2E_ITEM_SELLER_USER_IDS=1,2,...,10 \
 *           php artisan db:seed --class=E2EItemSeeder
 *
 * 仕上がる状態:
 *   - items.status = 'registered'（管理画面のレーン割当待ち）
 *   - species_type = メダカ固定 / quantity_unit = 'fish'
 *   - 出品者ごとに 1/3 が is_anonymous=true（匿名出品テスト兼）
 *   - thumbnail_path / item_media (写真+動画) を demo 素材から循環割当
 *
 * 品種マスタは 100 種だが、count が 100 を超えた場合は 2 巡目に
 * 「品種名 (A)」「品種名 (B)」のサフィックスを付与して重複を回避する。
 * したがって最大 200 件まで作成可能（それ以上は弾く）。
 *
 * 環境変数:
 *   E2E_ITEM_AUCTION_ID       … オークション ID (default 40)
 *   E2E_ITEM_COUNT            … 生成件数 (default 200)
 *   E2E_ITEM_SELLER_USER_IDS  … 出品者 user_id のカンマ区切り（必須）
 *   E2E_ITEM_BASE_URL         … メディア URL の origin（default: config('app.url')）
 *                               生成される ItemMedia.file_path は
 *                               {BASE_URL}/img/demo/medaka/{filename} の絶対 URL になる
 *                               （ItemMedia の file_url アクセサが http(s) をそのまま返すため）
 */
class E2EItemSeeder extends Seeder
{
    /**
     * 100 種の品種名。重複なし。種別は全件メダカで固定。
     * E2E_ITEM_COUNT > count(BREED_NAMES) は弾く（重複出品を避けるため）。
     */
    private const BREED_NAMES = [
        // 紅系
        '紅薊', '紅薊レインボー', '紅薊舞姫', '紅薊フルボディ', '紅華扇',
        '紅蝙蝠', '紅金剛', '紅鯱', '紅蓮', '紅鳳',
        '紅葉', '紅梅', '紅葉狩り', '紅龍', '紅虎',
        // 朱赤系
        '朱赤', '楊貴妃', '朱華', '朱玉', '朱漣',
        '朱印', '朱苑', '朱炎', '朱莉', '朱鷺',
        // 三色・斑系
        '三色ラメ', '三色錦', '雲州三色', '三色錦ロングフィン', '三色錦ヒカリ',
        '雲州三色ラメ', '雲州三色ロングフィン', '三色変り', '三色更紗', '三色舞',
        // 幹之系
        '幹之フルボディ', '幹之', '青幹之', '白幹之', '朱赤幹之',
        '幹之強光', '幹之鉄仮面', '幹之スーパー', '黒幹之', '体外光幹之',
        // 黒・墨系
        '黒蜂', 'オロチ', 'サタン', '黒龍', '黒鳳',
        '黒墨', '黒鯱', '黒煌', '黒燿', '黒曜',
        // 青系
        '青龍', '青鸞', '青墨', '青鯱', '青鳳',
        '青藍', '青翠', '青嵐', '青空', '青柳',
        // 月華・桜華・夜桜
        '夜桜', '夜桜ゴールド', '月華', '雪華', '桜華',
        '紅華', '月光', '月夜野', '朔', '望',
        // 王・銀河・ぱんだ等
        '王華', '銀河', '雪月花', '雪輝', 'ぱんだ',
        'ぱんだダルマ', '出目パンダ', '透明鱗', '白透明鱗', '白百合',
        // エメ・極龍
        'エメキン', 'エメラルドフィン', '極龍', '龍の瞳', '鉄仮面',
        // 和墨・煌・其他（demo 素材と同名のものを含めて 100 件）
        '和墨白銀', '和墨ミッドナイトフリル', '紅帝リアルロングフィン', '紅帝ロングフィン', '黒天幻龍',
        '暁', '黄昏', '流星', '麗', '翠玉',
    ];

    /**
     * demo メディアグループ（6 種）。index % 6 でアイテムに循環割当。
     * 各グループ: thumbnail（サムネ画像）+ photos（追加写真）+ video（動画）。
     * file 名は public/img/demo/medaka 配下の実ファイル名と完全一致させること。
     * 一部 ＿（全角下線）が混在しているのは実ファイル名そのまま。
     */
    private const MEDIA_GROUPS = [
        [
            'thumbnail' => 'エメキン_サムネ.jpg',
            'photos' => [
                ['file' => 'エメキン_上見.jpg',   'media_type' => 'photo_top'],
                ['file' => 'エメキン_上見②.jpg', 'media_type' => 'photo_top'],
            ],
            'video' => ['file' => 'エメキン_横見_10秒.mp4', 'media_type' => 'video_side', 'duration' => 10],
        ],
        [
            'thumbnail' => '三色体外光亜種_サムネ.jpg',
            'photos' => [
                ['file' => '三色体外光亜種_上見.jpg',   'media_type' => 'photo_top'],
                ['file' => '三色体外光亜種_上見②.jpg', 'media_type' => 'photo_top'],
            ],
            'video' => ['file' => '三色体外光亜種_上見_8秒.mp4', 'media_type' => 'video_top', 'duration' => 8],
        ],
        [
            'thumbnail' => '和墨ミッドナイトフリル_サムネ.jpg',
            'photos' => [
                ['file' => '和墨ミッドナイトフリル＿上見.jpg', 'media_type' => 'photo_top'],
                ['file' => '和墨ミッドナイトフリル_横見.jpg',  'media_type' => 'photo_side'],
            ],
            'video' => ['file' => '和墨ミッドナイトフリル_上見_8秒.mp4', 'media_type' => 'video_top', 'duration' => 8],
        ],
        [
            'thumbnail' => '和墨白銀_サムネ.jpg',
            'photos' => [
                ['file' => '和墨白銀_上見.jpg', 'media_type' => 'photo_top'],
                ['file' => '和墨白銀_横見.jpg', 'media_type' => 'photo_side'],
            ],
            'video' => ['file' => '和墨白銀_横見_10秒.mp4', 'media_type' => 'video_side', 'duration' => 10],
        ],
        [
            'thumbnail' => '紅帝リアルロングフィン_サムネ.jpg',
            'photos' => [
                ['file' => '紅帝リアルロングフィン_上見.jpg',  'media_type' => 'photo_top'],
                ['file' => '紅帝リアルロングフィン＿横見.jpg', 'media_type' => 'photo_side'],
            ],
            'video' => ['file' => '紅帝リアルロングフィン_横見_8秒.mp4', 'media_type' => 'video_side', 'duration' => 8],
        ],
        [
            'thumbnail' => '黒天幻龍_サムネ.jpg',
            'photos' => [
                ['file' => '黒天幻龍_横見.jpg', 'media_type' => 'photo_side'],
            ],
            'video' => ['file' => '黒天幻龍_10秒.MP4', 'media_type' => 'video_side', 'duration' => 10],
        ],
    ];

    public function run(): void
    {
        $auctionId   = (int) (env('E2E_ITEM_AUCTION_ID', 40));
        $count       = (int) (env('E2E_ITEM_COUNT', 200));
        $userIdsRaw  = (string) env('E2E_ITEM_SELLER_USER_IDS', '');
        $baseUrl     = rtrim((string) env('E2E_ITEM_BASE_URL', config('app.url')), '/');

        $breedCount    = count(self::BREED_NAMES);
        $maxItemCount  = $breedCount * 2; // (A)/(B) サフィックスで 2 巡まで許容

        if ($count <= 0) {
            throw new RuntimeException('E2E_ITEM_COUNT must be > 0');
        }
        if ($count > $maxItemCount) {
            throw new RuntimeException(sprintf(
                'E2E_ITEM_COUNT (%d) は品種名マスタ件数の2倍 (%d) を超えています。',
                $count, $maxItemCount
            ));
        }
        if ($baseUrl === '') {
            throw new RuntimeException('E2E_ITEM_BASE_URL or APP_URL を設定してください（メディア URL の origin に使います）。');
        }

        $sellerProfiles = $this->resolveSellerProfiles($userIdsRaw);
        $auction        = $this->resolveAuction($auctionId);
        $speciesType    = $this->resolveMedakaSpeciesType();

        $existingItems = Item::where('auction_id', $auctionId)->count();
        if ($existingItems > 0) {
            throw new RuntimeException(sprintf(
                'auction_id=%d には既に items が %d 件あります。手動で削除してから再実行してください。',
                $auctionId, $existingItems
            ));
        }

        $created = 0;
        $rows = [];
        $perSellerCount = []; // user_id => 投入数

        for ($i = 1; $i <= $count; $i++) {
            $sellerProfile = $sellerProfiles[($i - 1) % count($sellerProfiles)];
            $perSellerCount[$sellerProfile->user_id] = ($perSellerCount[$sellerProfile->user_id] ?? 0) + 1;
            $sellerLocalIdx = $perSellerCount[$sellerProfile->user_id]; // この出品者の中での連番（1始まり）

            // 1〜100 は素のまま、101〜200 は (A)(B) サフィックスを付与して品種名の一意性を担保
            $breedIdx  = ($i - 1) % $breedCount;
            $cycle     = intdiv($i - 1, $breedCount); // 0=1巡目, 1=2巡目
            $baseBreed = self::BREED_NAMES[$breedIdx];
            $speciesName = $cycle === 0
                ? sprintf('%s (A)', $baseBreed)
                : sprintf('%s (B)', $baseBreed);
            // start_price: 100〜2000 / 100 円刻み（決定論的）
            $startPrice = 100 + ((($i * 13) % 20) * 100);
            // quantity: 1〜100 匹（決定論的）
            // 本番の実態は 100 匹超なし。v5 配送ロジックは「1出品=1袋」マップなので
            // bag_specs.max_qty を超えると throw するため上限 100 で抑える。
            // 1〜100 の範囲で S/M/L 全ての袋サイズを通過する分布になる。
            $quantity   = 1 + (($i * 7) % 100);
            // 各出品者の中で 3 件に 1 件を匿名（3,6,9,...）。10件出品なら3件 ≒ 1/3。
            $isAnonymous = ($sellerLocalIdx % 3 === 0);

            $mediaGroup = self::MEDIA_GROUPS[($i - 1) % count(self::MEDIA_GROUPS)];

            DB::transaction(function () use (
                $auctionId, $sellerProfile, $sellerLocalIdx, $i, $speciesName, $speciesType,
                $quantity, $startPrice, $isAnonymous, $mediaGroup, $baseUrl
            ) {
                $item = Item::create([
                    'auction_id'           => $auctionId,
                    'seller_profile_id'    => $sellerProfile->id,
                    'item_number'          => $i,
                    'seller_display_order' => $sellerLocalIdx,
                    'species_name'         => $speciesName,
                    'species_type_id'      => $speciesType->id,
                    'quantity'             => $quantity,
                    'quantity_unit'        => 'fish',
                    'start_price'          => $startPrice,
                    'current_price'        => $startPrice,
                    'bid_increment'        => 100,
                    'inspection_info'      => 'E2E テスト用ダミー（審査情報なし）',
                    'individual_info'      => sprintf('E2E #%03d / %s', $i, $speciesName),
                    'notes'                => 'E2E 本番リハーサル 2026-05-06 用',
                    'is_premium'           => false,
                    'is_anonymous'         => $isAnonymous,
                    'thumbnail_path'       => $this->relativeImgUrl($mediaGroup['thumbnail']),
                    'unsold_action'        => 'return',
                    'status'               => 'registered',
                ]);

                $this->attachMedia($item, $mediaGroup, $baseUrl);
            });

            $rows[] = [
                $i,
                $sellerProfile->user_id,
                $sellerProfile->id,
                $sellerProfile->seller_name,
                $speciesName,
                $quantity,
                $startPrice,
                $isAnonymous ? 'yes' : 'no',
                $mediaGroup['thumbnail'],
            ];
            $created++;
        }

        $csvPath = $this->writeCsv($rows);

        $this->command->info(sprintf(
            'E2EItemSeeder: created=%d (auction_id=%d, sellers=%d)',
            $created, $auctionId, count($sellerProfiles)
        ));
        // 出品者ごとの内訳（運用者が一目で確認できるように）
        ksort($perSellerCount);
        $line = collect($perSellerCount)
            ->map(fn ($n, $uid) => "user_id={$uid}:{$n}")
            ->implode(', ');
        $this->command->info('per-seller distribution: ' . $line);
        $this->command->info('CSV: ' . $csvPath);

        // lanes が既に作られているオークションなら、items を lane_items に均等割当する。
        // E2EAuctionSeeder で lanes を先に作っておくのが前提。lanes が無い auction はスキップ。
        $this->assignItemsToLanes($auctionId);
    }

    /**
     * 作成した items を auction の lanes に均等に割り当てて lane_items を投入する。
     *
     * - lanes が無いオークションでは何もしない（手動でレーン作成する運用との互換）
     * - 既に lane_items が存在する場合も何もしない（再実行で順番が崩れるのを防ぐ）
     * - item_number 順に lane_count 個のレーンへラウンドロビン分配
     *   (lane_count=2 / 200 items の場合: 奇数→レーン1, 偶数→レーン2 / 各100件)
     * - sequence_order は各レーン内 1 始まりの連番
     */
    private function assignItemsToLanes(int $auctionId): void
    {
        $lanes = Lane::where('auction_id', $auctionId)
            ->orderBy('lane_number')
            ->get();

        if ($lanes->isEmpty()) {
            $this->command->info('lanes が未作成のため lane_items は投入しません（手動割当を想定）。');
            return;
        }

        $existingLaneItems = DB::table('lane_items')
            ->whereIn('lane_id', $lanes->pluck('id'))
            ->count();
        if ($existingLaneItems > 0) {
            $this->command->info(sprintf(
                'lane_items が既に %d 件あるため割当をスキップします。',
                $existingLaneItems
            ));
            return;
        }

        $items = Item::where('auction_id', $auctionId)
            ->orderBy('item_number')
            ->get();

        $perLaneCount = [];
        $now = now();

        DB::transaction(function () use ($items, $lanes, &$perLaneCount, $now) {
            $laneCount = $lanes->count();
            $perLaneSeq = []; // lane_id => 連番

            foreach ($items as $idx => $item) {
                $lane = $lanes[$idx % $laneCount];
                $seq  = ($perLaneSeq[$lane->id] ?? 0) + 1;
                $perLaneSeq[$lane->id] = $seq;
                $perLaneCount[$lane->lane_number] = $seq;

                DB::table('lane_items')->insert([
                    'lane_id'        => $lane->id,
                    'item_id'        => $item->id,
                    'sequence_order' => $seq,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
            }
        });

        ksort($perLaneCount);
        $line = collect($perLaneCount)
            ->map(fn ($n, $laneNo) => "lane{$laneNo}={$n}")
            ->implode(', ');
        $this->command->info('lane assignment: ' . $line);
    }

    /**
     * カンマ区切り user_id 文字列から SellerProfile のコレクションを解決する。
     * いずれかの user に SellerProfile が無ければ即 abort（黙って items 作るとレポート崩れるため）。
     *
     * @return array<int, SellerProfile>  入力順を保ったままの配列
     */
    private function resolveSellerProfiles(string $raw): array
    {
        $userIds = collect(explode(',', $raw))
            ->map(fn ($s) => trim($s))
            ->filter(fn ($s) => $s !== '' && ctype_digit($s))
            ->map(fn ($s) => (int) $s)
            ->unique()
            ->values()
            ->all();

        if (empty($userIds)) {
            throw new RuntimeException('E2E_ITEM_SELLER_USER_IDS を「1,2,3,...」形式で指定してください。');
        }

        $users = User::whereIn('id', $userIds)->get()->keyBy('id');
        $missingUsers = array_diff($userIds, $users->keys()->all());
        if (!empty($missingUsers)) {
            throw new RuntimeException('users が存在しません: ' . implode(',', $missingUsers));
        }

        $profiles = SellerProfile::whereIn('user_id', $userIds)->get()->keyBy('user_id');
        $missingProfiles = array_diff($userIds, $profiles->keys()->all());
        if (!empty($missingProfiles)) {
            throw new RuntimeException('seller_profiles が存在しません (user_id): ' . implode(',', $missingProfiles));
        }

        // 入力順を保つため、user_ids 配列順で並べ直す
        $ordered = [];
        foreach ($userIds as $uid) {
            $ordered[] = $profiles->get($uid);
        }
        return $ordered;
    }

    private function resolveAuction(int $auctionId): Auction
    {
        $auction = Auction::find($auctionId);
        if (!$auction) {
            throw new RuntimeException("auction_id={$auctionId} が見つかりません。");
        }
        if (in_array($auction->status, ['live', 'finished', 'cancelled'], true)) {
            throw new RuntimeException(sprintf(
                'auction_id=%d は status=%s です。preparing/scheduled でないと出品できません。',
                $auctionId, $auction->status
            ));
        }
        return $auction;
    }

    private function resolveMedakaSpeciesType(): SpeciesType
    {
        $type = SpeciesType::where('code', 'medaka')->first();
        if (!$type) {
            throw new RuntimeException('species_types に code=medaka がありません。マイグレーション/シード未実行の可能性。');
        }
        return $type;
    }

    /**
     * Item.thumbnail_path 用：/img/ 始まりの相対 URL を返す。
     * フロント側 optimizedImageUrl() は /img/ で始まる URL を最適化対象外としてそのまま使う。
     * ファイル名の日本語は rawurlencode してブラウザに優しい形にしておく。
     */
    private function relativeImgUrl(string $filename): string
    {
        return '/img/demo/medaka/' . rawurlencode($filename);
    }

    /**
     * ItemMedia.file_path 用：origin 込みの絶対 URL を返す。
     * ItemMedia の file_url アクセサは http(s):// 始まりだけそのまま返し、
     * それ以外は /storage/ プレフィックスを付けてしまうため、demo 素材は絶対 URL で渡す。
     */
    private function absoluteImgUrl(string $baseUrl, string $filename): string
    {
        return $baseUrl . '/img/demo/medaka/' . rawurlencode($filename);
    }

    /**
     * 1 アイテムに対して、動画 1 件 + 写真 1〜2 件 + サムネ画像 1 件を ItemMedia として登録する。
     * 動画には poster_path（再生前のポスター画像）にサムネを当てる。
     * is_thumbnail フラグはサムネ画像 1 件にのみ立てる（DB 上の整合性確保のため）。
     */
    private function attachMedia(Item $item, array $group, string $baseUrl): void
    {
        $order = 1;

        // 1. 動画
        $videoFile = $group['video']['file'];
        ItemMedia::create([
            'item_id'      => $item->id,
            'media_type'   => $group['video']['media_type'],
            'file_path'    => $this->absoluteImgUrl($baseUrl, $videoFile),
            'poster_path'  => $this->absoluteImgUrl($baseUrl, $group['thumbnail']),
            'is_processed' => true,
            'file_name'    => $videoFile,
            'mime_type'    => $this->guessVideoMime($videoFile),
            'duration'     => $group['video']['duration'],
            'display_order' => $order++,
            'is_thumbnail' => false,
        ]);

        // 2. 写真（追加カット）
        foreach ($group['photos'] as $p) {
            ItemMedia::create([
                'item_id'      => $item->id,
                'media_type'   => $p['media_type'],
                'file_path'    => $this->absoluteImgUrl($baseUrl, $p['file']),
                'is_processed' => true,
                'file_name'    => $p['file'],
                'mime_type'    => 'image/jpeg',
                'display_order' => $order++,
                'is_thumbnail' => false,
            ]);
        }

        // 3. サムネ画像本体（is_thumbnail=true で 1 件）
        ItemMedia::create([
            'item_id'      => $item->id,
            'media_type'   => 'photo_top',
            'file_path'    => $this->absoluteImgUrl($baseUrl, $group['thumbnail']),
            'is_processed' => true,
            'file_name'    => $group['thumbnail'],
            'mime_type'    => 'image/jpeg',
            'display_order' => $order++,
            'is_thumbnail' => true,
        ]);
    }

    private function guessVideoMime(string $filename): string
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return match ($ext) {
            'mp4', 'm4v' => 'video/mp4',
            'mov'        => 'video/quicktime',
            'webm'       => 'video/webm',
            default      => 'video/mp4',
        };
    }

    /**
     * 作成したアイテム一覧を CSV に書き出す。
     * storage/app/e2e-items-{YYYYmmdd-HHMMSS}.csv に保存し、既存ファイルを上書きしない。
     * Excel/Google スプレッドシート互換のため UTF-8 BOM 付き。
     */
    private function writeCsv(array $rows): string
    {
        $dir = storage_path('app');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $path = $dir . '/e2e-items-' . now()->format('Ymd-His') . '.csv';

        $fp = fopen($path, 'w');
        if ($fp === false) {
            throw new RuntimeException('CSV ファイルを開けませんでした: ' . $path);
        }
        fwrite($fp, "\xEF\xBB\xBF"); // UTF-8 BOM
        fputcsv($fp, [
            'item_number', 'user_id', 'seller_profile_id', 'seller_name',
            'species_name', 'quantity', 'start_price', 'is_anonymous', 'thumbnail_file',
        ]);
        foreach ($rows as $row) {
            fputcsv($fp, $row);
        }
        fclose($fp);

        return $path;
    }
}
