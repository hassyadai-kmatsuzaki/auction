import React from 'react';
import {
  Card, CardContent, Box, Typography, Chip, Button,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
} from '@mui/material';
import { SkipNext as SkipNextIcon, People as PeopleIcon } from '@mui/icons-material';
import { formatYen } from '@/lib/formatPrice';

interface Bidder {
  user_id: number;
  user_name: string;
  activated_at: string;
}

interface LaneItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  current_price: number;
  active_bidders_count: number;
  active_bidders?: Bidder[];
  thumbnail_path?: string;
  is_premium: boolean;
  inspection_info?: string;
}

interface Lane {
  lane_id: number;
  lane_number: number;
  lane_name?: string | null;
  status: string;
  current_item: LaneItem | null;
  countdown_seconds?: number;
  phase?: string;
}

interface Props {
  lane: Lane;
  onNextItem: (laneId: number) => void;
  isLoading?: boolean;
}

export const LaneControlCard = React.memo(({ lane, onNextItem, isLoading }: Props) => {
  const item = lane.current_item;
  const laneName = lane.lane_name ?? `レーン ${lane.lane_number}`;

  return (
    <Card sx={{ height: '100%', border: lane.status === 'active' ? '2px solid' : 1, borderColor: lane.status === 'active' ? 'success.main' : 'divider' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">{laneName}</Typography>
          <Chip
            label={lane.status === 'active' ? '進行中' : lane.status === 'paused' ? '一時停止' : lane.status === 'finished' ? '終了' : '待機中'}
            size="small"
            color={lane.status === 'active' ? 'success' : lane.status === 'paused' ? 'warning' : 'default'}
          />
        </Box>

        {item ? (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              {item.thumbnail_path && (
                <img src={item.thumbnail_path} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
                <Typography variant="body2" fontWeight="bold">{item.species_name}</Typography>
                <Typography variant="body2" color="primary.main">
                  ¥{formatYen(item.current_price)}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PeopleIcon fontSize="small" color="action" />
              <Typography variant="caption">{item.active_bidders_count}人入札中</Typography>
              {lane.countdown_seconds !== undefined && (
                <Chip label={`${lane.countdown_seconds}秒`} size="small"
                  color={lane.phase === 'pre_bid' ? 'info' : item.active_bidders_count >= 2 ? 'error' : 'default'} />
              )}
            </Box>

            {item.active_bidders && item.active_bidders.length > 0 && (
              <TableContainer sx={{ maxHeight: 120, mb: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '0.65rem', p: 0.5 }}>入札者</TableCell>
                      <TableCell sx={{ fontSize: '0.65rem', p: 0.5 }}>参加時刻</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {item.active_bidders.map((b) => (
                      <TableRow key={b.user_id}>
                        <TableCell sx={{ fontSize: '0.7rem', p: 0.5 }}>{b.user_name}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', p: 0.5 }}>
                          {new Date(b.activated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">出品なし</Typography>
        )}

        <Button
          fullWidth variant="outlined" size="small"
          startIcon={<SkipNextIcon />}
          onClick={() => onNextItem(lane.lane_id)}
          disabled={isLoading || !item}
          sx={{ mt: 1 }}
        >
          次の商品へ
        </Button>
      </CardContent>
    </Card>
  );
});

LaneControlCard.displayName = 'LaneControlCard';
