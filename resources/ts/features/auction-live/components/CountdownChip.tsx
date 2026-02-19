import React from 'react';
import { Chip } from '@mui/material';

interface Props {
  seconds: number;
  isCompetitive: boolean;
}

/**
 * 秒数を1秒刻みの整数で表示する
 * サーバーが0.5秒単位で送ってきても、繰り上げで整数秒に変換する
 * 例: 9.5 → 10秒, 9.0 → 9秒, 8.5 → 9秒
 */
const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  return `${Math.ceil(s)}秒`;
};

/**
 * カウントダウン残り秒数チップ
 * React.memo でメモ化 → 秒数が変わった時だけ再レンダリング
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive }: Props) => (
  <Chip
    label={`残り ${formatSeconds(seconds)}`}
    size="small"
    color={
      isCompetitive
        ? 'error'
        : Math.ceil(seconds) <= 3   // 整数秒ベースで色変え判定
          ? 'warning'
          : 'default'
    }
    sx={{
      fontWeight: 'bold',
      minWidth: 80,
      ...(isCompetitive && {
        animation: 'pulseOpacity 0.5s infinite',
        '@keyframes pulseOpacity': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.65 },
        },
      }),
    }}
  />
));

CountdownChip.displayName = 'CountdownChip';
