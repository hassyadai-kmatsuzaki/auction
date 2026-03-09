import React, { useEffect, useRef, useState } from 'react';
import { Button, CircularProgress, Box } from '@mui/material';
import { PlayArrow as PlayArrowIcon, Pause as PauseIcon, Timer as TimerIcon } from '@mui/icons-material';

interface Props {
  myBidStatus: 'active' | 'inactive' | null;
  isPreBid: boolean;
  isFreeze?: boolean;
  freezeRemainingSeconds?: number;
  freezeTotalSeconds?: number;
  isLoading: boolean;
  onToggle: () => void;
}

/**
 * フリーズ中ボタン
 * freezeTotalSeconds の時間でちょうど円が埋まるシームレスな円形ローディングをボタン内に表示
 */
const FreezeButton = React.memo(({ freezeRemainingSeconds = 0, freezeTotalSeconds = 1 }: {
  freezeRemainingSeconds?: number;
  freezeTotalSeconds?: number;
}) => {
  const total = freezeTotalSeconds || 1;
  const animRef = useRef<number>(0);
  const startRef = useRef<{ time: number; remaining: number } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const remaining = freezeRemainingSeconds ?? 0;
    startRef.current = { time: performance.now(), remaining };

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
  }, [freezeRemainingSeconds, total]);

  const progressIcon = (
    <Box sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={20}
        thickness={4}
        sx={{ color: 'grey.400', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={progress}
        size={20}
        thickness={4}
        sx={{ color: 'warning.main', transition: 'none' }}
      />
    </Box>
  );

  return (
    <Button
      fullWidth variant="contained" size="large" disabled
      startIcon={progressIcon}
      sx={{
        bgcolor: 'grey.300', color: 'grey.600',
        '&.Mui-disabled': { bgcolor: 'grey.200', color: 'grey.500' },
        py: 1.5,
      }}
    >
      入札準備中...
    </Button>
  );
});
FreezeButton.displayName = 'FreezeButton';

/**
 * 入札ON/OFFボタン
 * pre_bid / freeze フェーズ中は無効化
 */
export const BidButton = React.memo(({ myBidStatus, isPreBid, isFreeze, freezeRemainingSeconds, freezeTotalSeconds, isLoading, onToggle }: Props) => {
  if (isPreBid) {
    return (
      <Button fullWidth variant="outlined" color="inherit" size="large" disabled startIcon={<TimerIcon />}>
        入札準備中...
      </Button>
    );
  }

  if (isFreeze) {
    return (
      <FreezeButton
        freezeRemainingSeconds={freezeRemainingSeconds}
        freezeTotalSeconds={freezeTotalSeconds}
      />
    );
  }

  const isActive = myBidStatus === 'active';

  if (isActive) {
    return (
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={onToggle}
        disabled={isLoading}
        startIcon={
          isLoading
            ? <CircularProgress size={20} color="inherit" />
            : <PauseIcon />
        }
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #FFD700 0%, #F0A500 50%, #FFD700 100%)',
          backgroundSize: '200% 200%',
          color: '#5D3A00',
          fontWeight: 800,
          fontSize: '1rem',
          letterSpacing: '0.03em',
          border: '1px solid rgba(255, 215, 0, 0.6)',
          animation: 'btnGradientShift 3s ease-in-out infinite',
          '@keyframes btnGradientShift': {
            '0%, 100%': { backgroundPosition: '0% 50%' },
            '50%':      { backgroundPosition: '100% 50%' },
          },
          '&:hover': {
            background: 'linear-gradient(135deg, #FFC800 0%, #E09400 50%, #FFC800 100%)',
            backgroundSize: '200% 200%',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0, left: '-100%',
            width: '60%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
            animation: 'btnShimmer 2.5s ease-in-out infinite',
            '@keyframes btnShimmer': {
              '0%':   { left: '-100%' },
              '100%': { left: '200%' },
            },
          },
        }}
      >
        入札中
      </Button>
    );
  }

  return (
    <Button
      fullWidth
      variant="outlined"
      color="primary"
      size="large"
      onClick={onToggle}
      disabled={isLoading}
      startIcon={
        isLoading
          ? <CircularProgress size={20} color="inherit" />
          : <PlayArrowIcon />
      }
    >
      入札する
    </Button>
  );
});

BidButton.displayName = 'BidButton';
