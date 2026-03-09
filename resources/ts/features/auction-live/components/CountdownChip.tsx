import React from 'react';
import { Chip } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';

interface Props {
  seconds: number;
  isCompetitive?: boolean;
  /** フェーズ指定（freeze の場合はブロック中表示） */
  phase?: 'bidding' | 'freeze';
}

const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  return `${Math.ceil(s)}秒`;
};

/**
 * カウントダウン残り秒数チップ
 *
 * ■ freeze: 「ブロック中 N秒」グレー表示
 * ■ 通常: リアルタイムカウントダウン表示
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive, phase }: Props) => {
  if (phase === 'freeze') {
    return (
      <Chip
        icon={<BlockIcon sx={{ fontSize: 16 }} />}
        label="ブロック中"
        size="small"
        sx={{
          fontWeight: 'bold',
          minWidth: 100,
          bgcolor: 'grey.300',
          color: 'grey.700',
          '& .MuiChip-icon': { color: 'grey.600' },
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
