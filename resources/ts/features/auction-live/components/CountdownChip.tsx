import React, { useEffect, useRef, useState } from 'react';
import { Chip, Box, CircularProgress } from '@mui/material';

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
 * ■ freeze: 円形プログレスのみ（秒数テキストなし）
 * ■ 通常: リアルタイムカウントダウン表示
 */
export const CountdownChip = React.memo(({ seconds, isCompetitive, phase, freezeTotalSeconds, freezeRemainingSeconds }: Props) => {
  if (phase === 'freeze') {
    return (
      <FreezeChipProgress
        totalSeconds={freezeTotalSeconds ?? 1}
        remainingSeconds={freezeRemainingSeconds ?? 0}
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

/**
 * フリーズ中の円形プログレスチップ
 * totalSeconds でちょうど円が埋まるシームレスアニメーション（秒数テキストなし）
 */
const FreezeChipProgress = React.memo(({ totalSeconds, remainingSeconds }: {
  totalSeconds: number;
  remainingSeconds: number;
}) => {
  const total = totalSeconds || 1;
  const animRef = useRef<number>(0);
  const startRef = useRef<{ time: number; remaining: number } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    startRef.current = { time: performance.now(), remaining: remainingSeconds };

    const tick = () => {
      if (!startRef.current) return;
      const elapsed = (performance.now() - startRef.current.time) / 1000;
      const currentRemaining = Math.max(0, startRef.current.remaining - elapsed);
      const pct = ((total - currentRemaining) / total) * 100;
      setProgress(Math.min(100, Math.max(0, pct)));
      if (currentRemaining > 0) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [remainingSeconds, total]);

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={28}
          thickness={4}
          sx={{ color: 'grey.200', position: 'absolute' }}
        />
        <CircularProgress
          variant="determinate"
          value={progress}
          size={28}
          thickness={4}
          sx={{ color: 'grey.500', transition: 'none' }}
        />
      </Box>
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
    </Box>
  );
});

FreezeChipProgress.displayName = 'FreezeChipProgress';
