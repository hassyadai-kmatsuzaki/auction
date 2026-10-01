<?php

namespace App\Services\AI\ML;

/**
 * 価格予測用の特徴量変換（F-053）
 *
 * 出品時点で分かる情報だけを使う（入札者数など開催後に分かる値は使わない）。
 *  - 数値: 開始価格(対数)・数量(対数)・プレミアム・開催月(周期) … 平均0・分散1に標準化
 *  - カテゴリ: 品種名（表記ゆれを正規化）・出品者・数量単位・種別 … 出現回数が少ないものは「その他」に寄せる
 *  - キーワード: 品種名に含まれる代表的な特徴語（ラメ・体外光など）
 *  - 文字2-gram: 品種名を2文字ずつ区切った断片（新しい品種名でも「アースアイ」「ロングフィン」等の構成要素から価格を推定できる）
 * 列 0 は切片（常に 1）。
 */
class PriceFeatureEncoder
{
    public const KEYWORDS = [
        'ラメ', '体外光', '幹之', '三色', '紅白', '鳳凰', '夜桜', '王華', '煌', 'サファイア', 'マリアージュ',
        '楊貴妃', 'みゆき', 'オロチ', '黒龍', 'ブラックダイヤ', 'ユリシス', '紅帝', '朱赤', '黄金', '白', '黒',
        'ヒカリ', 'ダルマ', 'ロングフィン', 'スモール', '螺鈿', 'ブチ', '琥珀', '透明鱗',
    ];

    private const NUMERIC = ['log_start_price', 'log_quantity', 'is_premium', 'month_sin', 'month_cos'];

    /** @var array<string, int> 特徴名 => 列番号 */
    private array $index = [];

    /** @var array<string, array{mean: float, std: float}> */
    private array $scales = [];

    public function __construct(
        private readonly int $minSpeciesCount = 3,
        private readonly int $minSellerCount = 5,
        private readonly int $minNgramCount = 4,
        private readonly int $maxNgrams = 600,
    ) {}

    /**
     * @param  array<int, array>  $rows  TrainingDataCollector の price features
     */
    public function fit(array $rows): void
    {
        $this->index = ['bias' => 0];

        foreach (self::NUMERIC as $name) {
            $values = array_map(fn ($r) => $this->numeric($r)[$name], $rows);
            $mean = array_sum($values) / max(1, count($values));
            $var = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / max(1, count($values));
            $this->scales[$name] = ['mean' => $mean, 'std' => $var > 1e-12 ? sqrt($var) : 1.0];
            $this->index["num:{$name}"] = count($this->index);
        }

        foreach ($this->frequent($rows, fn ($r) => self::normalizeSpecies($r['species_name'] ?? ''), $this->minSpeciesCount) as $v) {
            $this->index["species:{$v}"] = count($this->index);
        }
        foreach ($this->frequent($rows, fn ($r) => (string) ($r['seller_profile_id'] ?? ''), $this->minSellerCount) as $v) {
            $this->index["seller:{$v}"] = count($this->index);
        }
        foreach ($this->frequent($rows, fn ($r) => (string) ($r['quantity_unit'] ?? 'fish'), 1) as $v) {
            $this->index["unit:{$v}"] = count($this->index);
        }
        foreach ($this->frequent($rows, fn ($r) => (string) ($r['species_type_id'] ?? ''), 1) as $v) {
            $this->index["type:{$v}"] = count($this->index);
        }
        foreach (self::KEYWORDS as $kw) {
            $this->index["kw:{$kw}"] = count($this->index);
        }

        // 文字2-gram: 出現回数の多い順に上限まで
        $ngramCounts = [];
        foreach ($rows as $r) {
            foreach (array_unique(self::bigrams(self::normalizeSpecies($r['species_name'] ?? ''))) as $g) {
                $ngramCounts[$g] = ($ngramCounts[$g] ?? 0) + 1;
            }
        }
        $ngramCounts = array_filter($ngramCounts, fn ($c) => $c >= $this->minNgramCount);
        uksort($ngramCounts, fn ($a, $b) => $ngramCounts[$b] <=> $ngramCounts[$a] ?: strcmp($a, $b));
        foreach (array_slice(array_keys($ngramCounts), 0, $this->maxNgrams) as $g) {
            $this->index["ng:{$g}"] = count($this->index);
        }
    }

    /**
     * @return array<int, float> 疎ベクトル
     */
    public function transform(array $row): array
    {
        $x = [0 => 1.0];

        foreach ($this->numeric($row) as $name => $value) {
            $s = $this->scales[$name];
            $x[$this->index["num:{$name}"]] = ($value - $s['mean']) / $s['std'];
        }

        $species = self::normalizeSpecies($row['species_name'] ?? '');
        foreach ([
            "species:{$species}",
            'seller:' . ($row['seller_profile_id'] ?? ''),
            'unit:' . ($row['quantity_unit'] ?? 'fish'),
            'type:' . ($row['species_type_id'] ?? ''),
        ] as $key) {
            if (isset($this->index[$key])) {
                $x[$this->index[$key]] = 1.0;
            }
        }

        foreach (self::KEYWORDS as $kw) {
            if ($species !== '' && mb_strpos($species, $kw) !== false) {
                $x[$this->index["kw:{$kw}"]] = 1.0;
            }
        }

        foreach (array_unique(self::bigrams($species)) as $g) {
            if (isset($this->index["ng:{$g}"])) {
                $x[$this->index["ng:{$g}"]] = 1.0;
            }
        }

        return $x;
    }

    /** 学習時に十分な件数があった品種か（推論の信頼度に使う） */
    public function knowsSpecies(string $speciesName): bool
    {
        return isset($this->index['species:' . self::normalizeSpecies($speciesName)]);
    }

    public function dimensions(): int
    {
        return count($this->index);
    }

    /** @return array<string, int> */
    public function featureIndex(): array
    {
        return $this->index;
    }

    public function toArray(): array
    {
        return [
            'index' => $this->index,
            'scales' => $this->scales,
            'min_species_count' => $this->minSpeciesCount,
            'min_seller_count' => $this->minSellerCount,
            'min_ngram_count' => $this->minNgramCount,
            'max_ngrams' => $this->maxNgrams,
        ];
    }

    public static function fromArray(array $data): self
    {
        $encoder = new self(
            (int) $data['min_species_count'],
            (int) $data['min_seller_count'],
            (int) ($data['min_ngram_count'] ?? 4),
            (int) ($data['max_ngrams'] ?? 600),
        );
        $encoder->index = $data['index'];
        $encoder->scales = $data['scales'];
        return $encoder;
    }

    /**
     * 品種名の表記ゆれを寄せる: 全角英数→半角、空白除去、数量表記「4ペア+」「10匹」、末尾の等級表記「(A)」「Aランク」などを除去
     */
    public static function normalizeSpecies(string $name): string
    {
        $s = mb_convert_kana(trim($name), 'asKV');
        $s = preg_replace('/\s+/u', '', $s) ?? $s;
        $s = preg_replace('/\d+(ペア|匹|尾|組|セット)[+＋]?/u', '', $s) ?? $s;
        $s = preg_replace('/[+＋]$/u', '', $s) ?? $s;
        $s = preg_replace('/[\(（\[【][^\)）\]】]{0,8}[\)）\]】]$/u', '', $s) ?? $s;
        $s = preg_replace('/[A-ESＡ-Ｅ]?ランク$|[A-E]級$/u', '', $s) ?? $s;
        $s = preg_replace('/メダカ$/u', '', $s) ?? $s;
        return $s;
    }

    /** @return string[] 文字2-gram */
    public static function bigrams(string $s): array
    {
        $chars = mb_str_split($s);
        $grams = [];
        for ($i = 0; $i < count($chars) - 1; $i++) {
            $grams[] = $chars[$i] . $chars[$i + 1];
        }
        return $grams;
    }

    /** @return array<string, float> */
    private function numeric(array $row): array
    {
        $month = (int) ($row['event_month'] ?? 0);
        $angle = $month > 0 ? 2 * M_PI * ($month - 1) / 12 : 0.0;

        return [
            'log_start_price' => log(1 + max(0, (float) ($row['start_price'] ?? 0))),
            'log_quantity' => log(1 + max(0, (float) ($row['quantity'] ?? 1))),
            'is_premium' => !empty($row['is_premium']) ? 1.0 : 0.0,
            'month_sin' => $month > 0 ? sin($angle) : 0.0,
            'month_cos' => $month > 0 ? cos($angle) : 0.0,
        ];
    }

    /** @return string[] */
    private function frequent(array $rows, callable $key, int $minCount): array
    {
        $counts = [];
        foreach ($rows as $r) {
            $k = $key($r);
            if ($k !== '') {
                $counts[$k] = ($counts[$k] ?? 0) + 1;
            }
        }
        ksort($counts);
        return array_keys(array_filter($counts, fn ($c) => $c >= $minCount));
    }
}
