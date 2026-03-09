import React from 'react';
import { Button, CircularProgress, Box, LinearProgress } from '@mui/material';
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
      <Box sx={{ width: '100%' }}>
        <Button
          fullWidth variant="contained" size="large" disabled
          sx={{
            bgcolor: 'grey.300', color: 'grey.600',
            '&.Mui-disabled': { bgcolor: 'grey.200', color: 'grey.500' },
            position: 'relative', py: 1.5,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          入札準備中...
        </Button>
        <LinearProgress
          sx={{
            height: 4,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            bgcolor: 'grey.300',
            '& .MuiLinearProgress-bar': {
              bgcolor: 'warning.main',
            },
          }}
        />
      </Box>
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
