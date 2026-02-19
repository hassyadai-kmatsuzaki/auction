import React from 'react';
import { Paper, Box, Typography, Chip, IconButton, Button, Container } from '@mui/material';
import {
  Wifi as WifiIcon, WifiOff as WifiOffIcon,
  PlayArrow as PlayArrowIcon, Refresh as RefreshIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';

interface Props {
  title: string;
  activeLaneCount: number;
  totalLaneCount: number;
  socketConnected: boolean;
  auctionId?: number;
  onRefresh: () => void;
  onNavigateItems?: () => void;
}

export const AuctionHeader = React.memo(
  ({ title, activeLaneCount, totalLaneCount, socketConnected, onRefresh, onNavigateItems }: Props) => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Container maxWidth="xl">
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 0 },
        }}>
          <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, width: { xs: '100%', sm: 'auto' } }}>
            <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeLaneCount}/{totalLaneCount}レーン進行中
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-end' } }}>
            {onNavigateItems && (
              <Button size="small" variant="outlined" startIcon={<ViewListIcon />} onClick={onNavigateItems}
                sx={{ fontSize: '0.75rem' }}>
                出品一覧
              </Button>
            )}
            <IconButton onClick={onRefresh} title="更新" size="small">
              <RefreshIcon />
            </IconButton>
            <Chip
              label={socketConnected ? 'リアルタイム接続中' : 'ポーリング中'}
              color={socketConnected ? 'success' : 'warning'}
              icon={socketConnected ? <WifiIcon /> : <WifiOffIcon />}
              size="small"
            />
            <Chip label="開催中" color="success" icon={<PlayArrowIcon />} size="small" />
          </Box>
        </Box>
      </Container>
    </Paper>
  )
);

AuctionHeader.displayName = 'AuctionHeader';
