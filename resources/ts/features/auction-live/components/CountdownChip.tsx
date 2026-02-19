import React from 'react';
import { Chip } from '@mui/material';

interface Props {
  seconds: number;
  isCompetitive: boolean;
}

const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  return Number.isInteger(s) ? `${s}秒` : `${s.toFixed(1)}秒`;
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
        : seconds <= 3
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
