import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { PlayArrow as PlayArrowIcon, Pause as PauseIcon, Timer as TimerIcon } from '@mui/icons-material';

interface Props {
  myBidStatus: 'active' | 'inactive' | null;
  isPreBid: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

/**
 * 入札ON/OFFボタン
 * pre_bid フェーズ中は無効化
 */
export const BidButton = React.memo(({ myBidStatus, isPreBid, isLoading, onToggle }: Props) => {
  if (isPreBid) {
    return (
      <Button
        fullWidth
        variant="outlined"
        color="inherit"
        size="large"
        disabled
        startIcon={<TimerIcon />}
      >
        入札準備中...
      </Button>
    );
  }

  const isActive = myBidStatus === 'active';

  return (
    <Button
      fullWidth
      variant={isActive ? 'contained' : 'outlined'}
      color={isActive ? 'success' : 'primary'}
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
