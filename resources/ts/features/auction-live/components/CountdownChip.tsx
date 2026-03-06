import React from 'react';
import { Chip } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';

interface Props {
  seconds: number;
  isCompetitive?: boolean;
  /** 競合時のカウントダウン設定秒数（固定表示用） */
  competitiveSeconds?: number;
  /** フェーズ指定（freeze の場合はブロック中表示） */
  phase?: 'bidding' | 'freeze';
}

const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  if (s < 1) return `${s}秒`;
  return `${Math.ceil(s)}秒`;
};

/**
 * カウントダウン残り秒数チップ
 *
 * ■ freeze: 「ブロック中 N秒」グレー表示
 * ■ 競合中: 設定秒数を固定表示
 * ■ 通常: リアルタイムカウントダウン表示
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive, competitiveSeconds, phase }: Props) => {
  if (phase === 'freeze') {
    return (
      <Chip
        icon={<BlockIcon sx={{ fontSize: 16 }} />}
        label={`ブロック中 ${formatSeconds(seconds)}`}
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

  const displaySeconds = isCompetitive && competitiveSeconds
    ? competitiveSeconds
    : seconds;

  return (
    <Chip
      label={`残り ${formatSeconds(displaySeconds)}`}
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
