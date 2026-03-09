import React from 'react';
import { Chip } from '@mui/material';

interface Props {
  seconds: number;
  isCompetitive?: boolean;
  /** フェーズ指定（freeze の場合はブロック中表示） */
  phase?: 'bidding' | 'freeze';
  /** freeze の合計秒数（円形プログレス計算用） */
  freezeTotalSeconds?: number;
  /** freeze の残り秒数（円形プログレス計算用） */
  freezeRemainingSeconds?: number;
}

const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  return `${Math.ceil(s)}秒`;
};

/**
 * カウントダウン残り秒数チップ
 *
 * ■ freeze: 「ブロック中」テキストのみ
 * ■ 通常: リアルタイムカウントダウン表示
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive, phase }: Props) => {
  if (phase === 'freeze') {
    return (
      <Chip
        label="ブロック中"
        size="small"
        sx={{
          fontWeight: 'bold',
          minWidth: 80,
          bgcolor: 'grey.300',
          color: 'grey.700',
        }}
      />
    );
  }

  return (
    <Chip
      label={`残り ${formatSeconds(seconds)}`}
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
  );
});

CountdownChip.displayName = 'CountdownChip';
