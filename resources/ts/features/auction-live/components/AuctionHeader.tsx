import React from 'react';
import { Paper, Box, Typography, Chip, IconButton, Container } from '@mui/material';
import {
  Wifi as WifiIcon, WifiOff as WifiOffIcon,
  PlayArrow as PlayArrowIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';

interface Props {
  title: string;
  activeLaneCount: number;
  totalLaneCount: number;
  socketConnected: boolean;
  onRefresh: () => void;
}

export const AuctionHeader = React.memo(
  ({ title, activeLaneCount, totalLaneCount, socketConnected, onRefresh }: Props) => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeLaneCount}/{totalLaneCount}レーン進行中
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={onRefresh} title="更新">
              <RefreshIcon />
            </IconButton>
            <Chip
              label={socketConnected ? 'リアルタイム接続中' : 'ポーリング中'}
              color={socketConnected ? 'success' : 'warning'}
              icon={socketConnected ? <WifiIcon /> : <WifiOffIcon />}
              size="small"
            />
            <Chip label="開催中" color="success" icon={<PlayArrowIcon />} />
          </Box>
        </Box>
      </Container>
    </Paper>
  )
);

AuctionHeader.displayName = 'AuctionHeader';
