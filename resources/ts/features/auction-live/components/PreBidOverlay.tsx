import React from 'react';
import { Box, Typography } from '@mui/material';
import { Timer as TimerIcon } from '@mui/icons-material';

interface Props {
  remainingSeconds: number;
}

/** 1秒刻みで表示（0.5秒単位のサーバー値を繰り上げ変換） */
const formatSeconds = (s: number): string => {
  if (s <= 0) return '0秒';
  return `${Math.ceil(s)}秒`;
};

/**
 * 入札開始待機表示（pre_bid フェーズ）
 */
export const PreBidOverlay = React.memo(({ remainingSeconds }: Props) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      mb: 1,
      bgcolor: 'info.50',
      border: '2px solid',
      borderColor: 'info.200',
      borderRadius: 1,
      p: 1.5,
    }}
  >
    <TimerIcon sx={{ color: 'info.main', fontSize: 20 }} />
    <Typography variant="body1" fontWeight="bold" color="info.main">
      入札開始まで {formatSeconds(remainingSeconds)}
    </Typography>
  </Box>
));

PreBidOverlay.displayName = 'PreBidOverlay';
