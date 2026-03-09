import React from 'react';
import { Button, CircularProgress, Box, Typography } from '@mui/material';
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
    const remaining = freezeRemainingSeconds ?? 0;
    const total = freezeTotalSeconds ?? 1;
    const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
    const displaySeconds = Math.ceil(remaining);

    return (
      <Button
        fullWidth variant="contained" size="large" disabled
        sx={{
          bgcolor: 'grey.300', color: 'grey.600',
          '&.Mui-disabled': { bgcolor: 'grey.200', color: 'grey.500' },
          position: 'relative', py: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate" value={progress} size={28} thickness={5}
              sx={{ color: 'warning.main' }}
            />
            <Box sx={{
              position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'warning.dark' }}>
                {displaySeconds}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            ブロック中 {displaySeconds}秒
          </Typography>
        </Box>
      </Button>
    );
  }

  const isActive = myBidStatus === 'active';

  return (
    <Button
      fullWidth
      variant={isActive ? 'contained' : 'outlined'}
      color={isActive ? 'warning' : 'primary'}
      sx={isActive ? { bgcolor: '#D4A017', '&:hover': { bgcolor: '#B8860B' } } : undefined}
      size="large"
      onClick={onToggle}
      disabled={isLoading}
      startIcon={
        isLoading ? (
          <CircularProgress size={20} color="inherit" />
        ) : isActive ? (
          <PauseIcon />
        ) : (
          <PlayArrowIcon />
        )
      }
    >
      {isActive ? '入札中' : '入札する'}
    </Button>
  );
});

BidButton.displayName = 'BidButton';
