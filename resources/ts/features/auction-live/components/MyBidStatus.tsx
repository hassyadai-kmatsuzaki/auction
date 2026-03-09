import React from 'react';
import { Paper, Typography, Box, Chip } from '@mui/material';
import type { LiveLane } from '@/types';

interface Props {
  lanes: LiveLane[];
  onLeaveBid: (itemId: number) => void;
}

export const MyBidStatus = React.memo(({ lanes, onLeaveBid }: Props) => {
  const activeBidLanes = lanes.filter(l => l.current_item?.my_bid_status === 'active');

  return (
    <Paper sx={{ mt: 3, p: 2 }}>
      <Typography variant="h6" gutterBottom>あなたの入札状況</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {activeBidLanes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            現在入札中の商品はありません
          </Typography>
        ) : (
          activeBidLanes.map((lane) => (
            <Chip
              key={lane.lane_id}
              label={`${lane.lane_name ?? `レーン${lane.lane_number}`}: ${lane.current_item?.species_name}`}
              sx={{ bgcolor: '#D4A017', color: 'white', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } }}
              onDelete={() => lane.current_item && onLeaveBid(lane.current_item.id)}
            />
          ))
        )}
      </Box>
    </Paper>
  );
});

MyBidStatus.displayName = 'MyBidStatus';
