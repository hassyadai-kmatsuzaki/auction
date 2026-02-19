import React from 'react';
import { Chip } from '@mui/material';

interface Props {
  seconds: number;
  isCompetitive: boolean;
  /** 競合時のカウントダウン設定秒数（固定表示用） */
  competitiveSeconds?: number;
}

const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  // 1秒未満は小数表示（例: 0.5秒）、1秒以上は整数表示（例: 10秒）
  if (s < 1) return `${s}秒`;
  return `${Math.ceil(s)}秒`;
};

/**
 * カウントダウン残り秒数チップ
 *
 * ■ 競合中: 設定秒数を固定表示（レンダリングしない）
 *   例: 「5秒ごとに上昇」→ 常に「残り 5秒」と表示
 *
 * ■ 通常: リアルタイムカウントダウン表示
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive, competitiveSeconds }: Props) => {
  // 競合中は設定秒数を固定表示（0.5秒ごとの変化を見せない）
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
