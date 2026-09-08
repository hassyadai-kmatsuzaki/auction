import { useState } from 'react';
import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';

/**
 * 数値入力欄（type="number"）の共通ラッパー。
 *
 * 素の <TextField type="number"> には3つの罠がある:
 *  1. 既存値の入った欄をクリックするとカーソルが末尾に来るので、"0" の欄に 350 と打つと "0350" になる
 *  2. React は type="number" のとき DOM 値を緩い等価で比較する（"0350" == 350 → 一致とみなす）ため、
 *     state 側を数値に直しても画面の "0350" が書き換わらない（react-dom 18 ReactDOMInput#updateWrapper）
 *  3. マウスホイールでフォーカス中の欄の値が勝手に増減する（モーダルのスクロール中に誤入力になる）
 *
 * この3つをまとめて塞ぐ。入力中の文字列は内部 draft で保持するので、
 * 呼び出し側の state は数値のままでよい（onValueChange には生の文字列が渡る）。
 */

// 先頭の 0 を落とす（"0350" → "350"）。小数の "0.5" はそのまま
export const stripLeadingZeros = (raw: string): string => raw.replace(/^0+(?=\d)/, '');

export type NumberFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number | string | null | undefined;
  /** 入力中の生文字列。空欄は ''。呼び出し側で parseInt / parseFloat する */
  onValueChange: (raw: string) => void;
};

const NumberField = ({ value, onValueChange, onFocus, onBlur, onWheel, ...rest }: NumberFieldProps) => {
  // フォーカス中だけ「打っている途中の文字列」を保持する（null = 親の値をそのまま表示）
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === null || value === undefined ? '' : String(value));

  return (
    <TextField
      {...rest}
      type="number"
      value={display}
      onFocus={(e) => {
        setDraft(display);
        // 既存値への打ち足しを防ぐため全選択する
        (e.target as HTMLInputElement).select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = stripLeadingZeros(e.target.value);
        setDraft(raw);
        onValueChange(raw);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
      onWheel={(e) => {
        const el = e.target as HTMLElement;
        if (document.activeElement === el) el.blur();
        onWheel?.(e);
      }}
    />
  );
};

export default NumberField;
