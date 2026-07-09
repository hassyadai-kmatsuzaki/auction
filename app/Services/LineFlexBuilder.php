<?php

namespace App\Services;

use App\Models\Auction;
use App\Models\Item;
use App\Models\WonItem;

/**
 * LINE Flex Message のコンテンツ（bubble JSON）を生成するビルダー。
 *
 * LINE 仕様制約:
 * - hero image は HTTPS 必須、最大 1024x1024、10MB 以下
 * - URI action の uri は HTTPS スキーム必須
 * - HTTPS でない画像/リンクは自動的に hero/footer から除外する（フォールバック）
 */
class LineFlexBuilder
{
    private const BRAND_COLOR = '#1E3A5F';
    private const ACCENT_COLOR = '#10B981';
    private const WARN_COLOR   = '#F59E0B';
    private const ALERT_COLOR  = '#EF4444';

    // ─── 落札者向け ──────────────────────────────────────────────

    /** ① 落札通知 */
    public function wonItem(WonItem $wonItem): array
    {
        $item = $wonItem->item;
        $speciesName = $item?->species_name ?? '商品';
        $image = $this->itemHeroImage($item);
        $detailUrl = $this->appUrl('/participant/won-items');

        return $this->bubble(
            heroImageUrl: $image,
            headerText: '🎉 落札おめでとうございます',
            headerColor: self::ACCENT_COLOR,
            bodyRows: [
                ['生体', $speciesName],
                ['落札価格', '¥' . number_format((int) $wonItem->winning_price) . ' / 匹'],
                ['数量',    (string) $wonItem->quantity . ' 匹'],
                ['合計',    '¥' . number_format((int) $wonItem->total_amount) . '（税込）'],
            ],
            footerButton: $detailUrl ? [
                'label' => '落札商品を確認',
                'uri'   => $detailUrl,
            ] : null,
        );
    }

    /** ② 入金確認通知 */
    public function paymentConfirmed(WonItem $wonItem): array
    {
        $item = $wonItem->item;
        $auctionTitle = $item?->auction?->title ?? 'オークション';

        return $this->bubble(
            heroImageUrl: null,
            headerText: '✅ 入金が確認されました',
            headerColor: self::ACCENT_COLOR,
            bodyRows: [],
            bodyLead: $auctionTitle,
            bodyNote: 'ご入金ありがとうございました。',
            footerButton: ($url = $this->appUrl('/participant/won-items'))
                ? ['label' => '落札状況を確認', 'uri' => $url]
                : null,
        );
    }

    /** ③ 発送完了通知 */
    public function shippingCompleted(WonItem $wonItem): array
    {
        $item = $wonItem->item;
        $rows = [
            ['生体', $item?->species_name ?? '商品'],
        ];
        if ($wonItem->shipping_company) $rows[] = ['運送会社', (string) $wonItem->shipping_company];
        if ($wonItem->tracking_number)  $rows[] = ['追跡番号', (string) $wonItem->tracking_number];

        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($item),
            headerText: '📦 発送が完了しました',
            headerColor: self::BRAND_COLOR,
            bodyRows: $rows,
            footerButton: ($url = $this->appUrl('/participant/won-items'))
                ? ['label' => '配送状況を確認', 'uri' => $url]
                : null,
        );
    }

    /** ④ 指値発動通知 */
    public function bidLimitReached(string $speciesName, float $limitPrice, float $currentPrice): array
    {
        return $this->bubble(
            heroImageUrl: null,
            headerText: '⚠️ 上限価格に到達しました',
            headerColor: self::WARN_COLOR,
            bodyRows: [
                ['生体',     $speciesName],
                ['上限価格', '¥' . number_format((int) $limitPrice)],
                ['現在価格', '¥' . number_format((int) $currentPrice)],
            ],
            bodyNote: '自動入札は停止されました。',
            footerButton: null,
        );
    }

    /** ⑤ オークション開始通知（参加者） */
    public function auctionStart(Auction $auction): array
    {
        $featuredItem = $this->featuredItem($auction);
        $url = $this->appUrl("/participant/auction/{$auction->id}/live");

        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($featuredItem),
            headerText: '🔔 まもなくオークションが開始されます',
            headerColor: self::ALERT_COLOR,
            bodyRows: [
                ['タイトル',   (string) $auction->title],
                ['開催日',     $auction->event_date?->format('Y/m/d') ?? '本日'],
                ['開始時刻',   (string) ($auction->start_time ?? '本日中')],
            ],
            bodyNote: '開始時刻になりましたらご参加ください。',
            footerButton: $url ? ['label' => 'オークションに参加する', 'uri' => $url] : null,
        );
    }

    /** ⑥ 新規オークション通知 */
    public function newAuction(Auction $auction, string $audience = 'participant'): array
    {
        $featuredItem = $this->featuredItem($auction);
        $path = $audience === 'seller' ? '/seller/items' : '/participant/home';
        $url = $this->appUrl($path);

        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($featuredItem),
            headerText: '📢 新しいオークション',
            headerColor: self::BRAND_COLOR,
            bodyRows: [
                ['タイトル', (string) $auction->title],
                ['開催日',   $auction->event_date?->format('Y/m/d') ?? '未定'],
            ],
            footerButton: $url ? ['label' => '詳細を見る', 'uri' => $url] : null,
        );
    }

    /** ⑦ お気に入り順番接近通知 */
    public function favoriteApproaching(int $auctionId, string $speciesName, int $aheadCount, string $laneName, string $auctionTitle): array
    {
        $url = $this->appUrl("/participant/auction/{$auctionId}/live");

        return $this->bubble(
            heroImageUrl: null,
            headerText: '⏰ お気に入りの出番が近づいています',
            headerColor: self::WARN_COLOR,
            bodyRows: [
                ['生体',       $speciesName],
                ['残り',       "あと {$aheadCount} 品"],
                ['レーン',     $laneName],
                ['オークション', $auctionTitle],
            ],
            bodyNote: 'ご準備ください！',
            footerButton: $url ? ['label' => 'ライブ画面へ', 'uri' => $url] : null,
        );
    }

    /** ⑧ 入金催促通知 */
    public function paymentReminder(WonItem $wonItem, string $urgency): array
    {
        $item = $wonItem->item;

        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($item),
            headerText: '⚠️ 入金期限が近づいています',
            headerColor: self::ALERT_COLOR,
            bodyRows: [
                ['生体',   $item?->species_name ?? '商品'],
                ['残り',   $urgency],
                ['期限',   $wonItem->payment_deadline?->format('m/d H:i') ?? '未定'],
                ['合計',   '¥' . number_format((int) $wonItem->total_amount)],
            ],
            footerButton: ($url = $this->appUrl('/participant/won-items'))
                ? ['label' => '入金内容を確認', 'uri' => $url]
                : null,
        );
    }

    // ─── 出品者向け ──────────────────────────────────────────────

    /** ⑨ 出品者向け落札通知 */
    public function itemSold(WonItem $wonItem): array
    {
        $item = $wonItem->item;

        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($item),
            headerText: '🎉 出品した生体が落札されました',
            headerColor: self::ACCENT_COLOR,
            bodyRows: [
                ['生体',       $item?->species_name ?? '商品'],
                ['落札価格',   '¥' . number_format((int) $wonItem->winning_price) . ' / 匹'],
                ['数量',       (string) $wonItem->quantity . ' 匹'],
                ['売上（税抜）', '¥' . number_format((int) $wonItem->seller_amount)],
            ],
            footerButton: ($url = $this->appUrl('/seller/items'))
                ? ['label' => '出品履歴を確認', 'uri' => $url]
                : null,
        );
    }

    /**
     * 出品者向け 出品ID発行通知
     *
     * @param  Auction  $auction
     * @param  array<int, array{exhibit_code: string, item_number: int|null, species_name: string}>  $items
     */
    public function exhibitCodeIssued(Auction $auction, array $items): array
    {
        $bodyRows = [
            ['オークション', (string) $auction->title],
            ['開催日',       $auction->event_date?->format('Y/m/d') ?? ''],
            ['対象件数',     count($items) . ' 件'],
        ];

        // 最大10件まで本文に列挙（LINE の bubble size 制約への配慮）
        $listed = array_slice($items, 0, 10);
        foreach ($listed as $row) {
            $code = (string) ($row['exhibit_code'] ?? '');
            $species = (string) ($row['species_name'] ?? '');
            // ラベル側に出品ID、値側にタイトル
            $bodyRows[] = [$code, $species];
        }
        if (count($items) > count($listed)) {
            $remaining = count($items) - count($listed);
            $bodyRows[] = ['(以下省略)', "他 {$remaining} 件"];
        }

        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($this->featuredItem($auction)),
            headerText: '📋 出品ID発行のお知らせ',
            headerColor: self::BRAND_COLOR,
            bodyRows: $bodyRows,
            bodyNote: '当日の会場ではこの出品IDで進行いたします。',
            footerButton: ($url = $this->appUrl('/seller/items'))
                ? ['label' => '出品状況を確認', 'uri' => $url]
                : null,
        );
    }

    /** ⑪ 出品者向けオークション開始通知 */
    public function sellerAuctionStart(Auction $auction): array
    {
        return $this->bubble(
            heroImageUrl: $this->itemHeroImage($this->featuredItem($auction)),
            headerText: '🔔 まもなくオークションが開始されます',
            headerColor: self::BRAND_COLOR,
            bodyRows: [
                ['タイトル', (string) $auction->title],
                ['開催日',   $auction->event_date?->format('Y/m/d') ?? '本日'],
                ['開始時刻', (string) ($auction->start_time ?? '本日中')],
            ],
            footerButton: ($url = $this->appUrl('/seller/items'))
                ? ['label' => '出品状況を確認', 'uri' => $url]
                : null,
        );
    }

    // ─── 請求書 ──────────────────────────────────────────────

    /** ⑫ 請求書発行通知（PDFダウンロードリンク付き） */
    public function invoiceReady(Auction $auction, int $totalAmount, string $pdfUrl): array
    {
        $isHttps = str_starts_with($pdfUrl, 'https://');

        return $this->bubble(
            heroImageUrl: null,
            headerText: '🧾 請求書が発行されました',
            headerColor: self::BRAND_COLOR,
            bodyRows: [
                ['オークション', (string) $auction->title],
                ['開催日',       $auction->event_date?->format('Y/m/d') ?? ''],
                ['請求金額',     '¥' . number_format($totalAmount) . '（税込）'],
            ],
            bodyNote: '下のボタンから PDF をダウンロードできます。',
            footerButton: $isHttps ? [
                'label' => '請求書をダウンロード',
                'uri'   => $pdfUrl,
            ] : null,
        );
    }

    // ─── 共通ビルダー ────────────────────────────────────────

    /**
     * シンプルな縦積みバブルを生成する。
     *
     * @param  string|null  $heroImageUrl    HTTPS 画像URL。未指定時は hero を省略。
     * @param  array<array{0: string, 1: string}>  $bodyRows  [ [ラベル, 値], ... ]
     * @param  array{label: string, uri: string}|null  $footerButton
     */
    /**
     * E-NE 契約締結 → 会員自動発行後の「パスワード設定」案内。
     *
     * $setPasswordUrl は frontend の /auth/set-password?token=… を渡す。
     * LINE 内ブラウザだと設定後のログインが不安定なため、端末の標準ブラウザで開かせる。
     */
    public function setPasswordInvite(string $name, string $setPasswordUrl): array
    {
        $url = $this->forceHttps($setPasswordUrl);
        if (str_starts_with($url, 'https://')) {
            $url .= (str_contains($url, '?') ? '&' : '?') . 'openExternalBrowser=1';
        }

        return $this->bubble(
            heroImageUrl: null,
            headerText: '✅ 会員登録が完了しました',
            headerColor: self::ACCENT_COLOR,
            bodyRows: [],
            bodyLead: $name . ' 様',
            bodyNote: "下のボタンからパスワードを設定してください。設定後、そのままログインいただけます。\n（リンクの有効期限は7日間です）",
            footerButton: str_starts_with($url, 'https://')
                ? ['label' => 'パスワードを設定する', 'uri' => $url]
                : null,
        );
    }

    private function bubble(
        ?string $heroImageUrl,
        string $headerText,
        string $headerColor,
        array $bodyRows,
        ?string $bodyNote = null,
        ?array $footerButton = null,
        ?string $bodyLead = null,
    ): array {
        $bubble = [
            'type' => 'bubble',
            'size' => 'mega',
        ];

        if ($heroImageUrl && str_starts_with($heroImageUrl, 'https://')) {
            $bubble['hero'] = [
                'type'        => 'image',
                'url'         => $heroImageUrl,
                'size'        => 'full',
                'aspectRatio' => '4:3',
                'aspectMode'  => 'cover',
            ];
        }

        $bubble['header'] = [
            'type'            => 'box',
            'layout'          => 'vertical',
            'backgroundColor' => $headerColor,
            'paddingAll'      => '16px',
            'contents'        => [[
                'type'   => 'text',
                'text'   => $headerText,
                'color'  => '#FFFFFF',
                'weight' => 'bold',
                'size'   => 'md',
                'wrap'   => true,
            ]],
        ];

        $bodyContents = [];
        if ($bodyLead) {
            $bodyContents[] = [
                'type'   => 'text',
                'text'   => $bodyLead,
                'size'   => 'md',
                'weight' => 'bold',
                'color'  => '#111827',
                'wrap'   => true,
            ];
        }
        foreach ($bodyRows as [$label, $value]) {
            if ($value === '' || $value === null) continue;
            $bodyContents[] = [
                'type'    => 'box',
                'layout'  => 'baseline',
                'spacing' => 'sm',
                'contents' => [
                    ['type' => 'text', 'text' => $label, 'color' => '#6B7280', 'size' => 'sm', 'flex' => 2],
                    ['type' => 'text', 'text' => (string) $value, 'color' => '#111827', 'size' => 'sm', 'flex' => 5, 'wrap' => true],
                ],
            ];
        }
        if ($bodyNote) {
            $bodyContents[] = [
                'type'      => 'text',
                'text'      => $bodyNote,
                'size'      => 'xs',
                'color'     => '#6B7280',
                'margin'    => 'md',
                'wrap'      => true,
            ];
        }

        $bubble['body'] = [
            'type'     => 'box',
            'layout'   => 'vertical',
            'spacing'  => 'sm',
            'paddingAll' => '16px',
            'contents' => $bodyContents,
        ];

        if ($footerButton && str_starts_with($footerButton['uri'], 'https://')) {
            $bubble['footer'] = [
                'type'     => 'box',
                'layout'   => 'vertical',
                'spacing'  => 'sm',
                'paddingAll' => '12px',
                'contents' => [[
                    'type'   => 'button',
                    'style'  => 'primary',
                    'color'  => $headerColor,
                    'height' => 'sm',
                    'action' => [
                        'type'  => 'uri',
                        'label' => mb_substr($footerButton['label'], 0, 40),
                        'uri'   => $footerButton['uri'],
                    ],
                ]],
            ];
        }

        return $bubble;
    }

    /** オークションを代表する画像候補となる Item を返す */
    private function featuredItem(Auction $auction): ?Item
    {
        return $auction->items()
            ->whereNotNull('thumbnail_path')
            ->orderByDesc('is_premium')
            ->orderBy('item_number')
            ->first()
            ?? $auction->items()->orderBy('item_number')->first();
    }

    /** Item から LINE Flex で使える HTTPS 画像 URL を返す（無ければ null） */
    private function itemHeroImage(?Item $item): ?string
    {
        if (!$item) return null;

        $url = null;
        if ($item->thumbnail_path) {
            $url = $this->absoluteUrl($item->thumbnail_path);
        }

        if (!$url) {
            $media = $item->media()
                ->where('media_type', 'image')
                ->orderByDesc('is_thumbnail')
                ->orderBy('display_order')
                ->first();
            $url = $media?->file_url;
        }

        if (!$url) return null;
        $url = $this->forceHttps($url);
        return str_starts_with($url, 'https://') ? $url : null;
    }

    private function absoluteUrl(string $path): string
    {
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }
        $key    = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');
        if (!empty($key) && !empty($bucket) && class_exists(\Aws\S3\S3Client::class)) {
            return \Illuminate\Support\Facades\Storage::disk('s3')->url($path);
        }
        return rtrim((string) config('app.url'), '/') . '/storage/' . ltrim($path, '/');
    }

    private function forceHttps(string $url): string
    {
        return preg_replace('#^http://#i', 'https://', $url) ?? $url;
    }

    private function appUrl(string $path): ?string
    {
        $base = rtrim((string) config('app.url'), '/');
        if ($base === '') return null;
        $url = $base . '/' . ltrim($path, '/');
        $url = $this->forceHttps($url);
        if (!str_starts_with($url, 'https://')) return null;
        // LINEアプリ内ブラウザではなく端末の標準ブラウザで開かせる
        $url .= (str_contains($url, '?') ? '&' : '?') . 'openExternalBrowser=1';
        return $url;
    }
}
