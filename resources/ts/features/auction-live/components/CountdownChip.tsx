import React from 'react';
import { Chip } from '@mui/material';

interface Props {
  seconds: number;
  isCompetitive: boolean;
}

/**
 * 秒数を1秒刻みの整数で表示する
 * サーバーが0.5秒単位で送ってきても、繰り上げで整数秒に変換する
 */
const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  return `${Math.ceil(s)}秒`;
};

/**
 * カウントダウン残り秒数チップ
 *
 * ■ 競合中（2人以上入札）の表示:
 *   0.5秒ごとに価格が上がっていくため、「残り 1秒」のように固定表示。
 *   点滅アニメーションは外し、赤ラベルで「競り上がり中」であることを伝える。
 *
 * ■ 通常（0〜1人入札）の表示:
 *   10秒→9秒→...→1秒→0秒 のカウントダウンを表示。
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive }: Props) => (
  <Chip
    label={isCompetitive ? `残り ${formatSeconds(seconds)}` : `残り ${formatSeconds(seconds)}`}
    size="small"
    color={
      isCompetitive
        ? 'error'
        : Math.ceil(seconds) <= 3
          ? 'warning'
          : 'default'
    }
    sx={{ fontWeight: 'bold', minWidth: 80 }}
  />
));

CountdownChip.displayName = 'CountdownChip';
