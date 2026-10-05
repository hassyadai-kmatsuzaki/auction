<?php

namespace App\Support;

use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * 生体の詳細項目（F-010: 性別・親魚・飼育環境）。
 * items の既存列（sex / parent_fish_info / breeding_environment）を使う。表示スイッチ OFF の間は受け付けも返却もしない
 */
class ItemDetailFields
{
    /** DB の enum と同じ。mix は「混合・不明」 */
    public const SEXES = ['male', 'female', 'pair', 'mix'];

    public static function enabled(): bool
    {
        return (bool) config('features.item_detail_fields');
    }

    /**
     * リクエストから保存用の値を取り出す（送られてきた項目だけ）。OFF の間は常に空
     */
    public static function extract(Request $request): array
    {
        if (!self::enabled()) {
            return [];
        }

        $validator = validator($request->only(['sex', 'parent_fish_info', 'breeding_environment']), [
            'sex' => 'nullable|in:' . implode(',', self::SEXES),
            'parent_fish_info' => 'nullable|string|max:500',
            'breeding_environment' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $values = [];
        if ($request->has('sex')) {
            $values['sex'] = $request->input('sex') ?: null;
        }
        // 親魚・飼育環境は JSON 列。自由記述を {"text": ...} で保存する
        foreach (['parent_fish_info', 'breeding_environment'] as $key) {
            if ($request->has($key)) {
                $text = trim((string) $request->input($key));
                $values[$key] = $text === '' ? null : ['text' => $text];
            }
        }

        return $values;
    }

    /**
     * 画面へ返す値。OFF の間は空（レスポンスの形を変えない）
     */
    public static function present(Item $item): array
    {
        if (!self::enabled()) {
            return [];
        }

        return [
            'sex' => $item->sex,
            'parent_fish_info' => $item->parent_fish_info['text'] ?? null,
            'breeding_environment' => $item->breeding_environment['text'] ?? null,
        ];
    }
}
