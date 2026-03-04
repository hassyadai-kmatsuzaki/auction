import React from 'react';
import {
  Card, CardMedia, CardContent, CardActions,
  Box, Typography, Chip, IconButton,
} from '@mui/material';
import { Info as InfoIcon, People as PeopleIcon } from '@mui/icons-material';
import type { LiveLane } from '@/types';
import { CountdownChip } from './CountdownChip';
import { BidButton } from './BidButton';
import { PreBidOverlay } from './PreBidOverlay';
import { BidLimitBadge } from '../../bid-limit/components/BidLimitBadge';

interface Props {
  lane: LiveLane;
  isLoading: boolean;
  onBidToggle: (itemId: number, currentStatus: 'active' | 'inactive' | null) => void;
  onDetailOpen: (lane: LiveLane) => void;
  onLimitEdit?: (itemId: number) => void;
  onLimitRemove?: (itemId: number) => void;
}

/**
 * レーンカード1枚
 * React.memo + 細粒度メモ化で不要な再レンダリングを防ぐ
 */
export const LaneCard = React.memo(({ lane, isLoading, onBidToggle, onDetailOpen, onLimitEdit, onLimitRemove }: Props) => {
  const item = lane.current_item;

  if (!item) {
    return (
      <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CardContent>
          <Typography variant="h6" color="text.secondary" align="center">
            {lane.lane_name ?? `レーン ${lane.lane_number}`}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            {lane.status === 'finished' ? '全出品終了' : '待機中'}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const isPreBid = item.phase === 'pre_bid';
  const isFreeze = item.phase === 'freeze';
  const isCompetitive = item.active_bidders_count >= 2;

  return (
    <Card
      sx={{
        height: '100%',
        border: item.my_bid_status === 'active' ? 3 : 1,
        borderColor: item.my_bid_status === 'active' ? 'success.main' : 'divider',
        boxShadow: item.my_bid_status === 'active'
          ? '0 0 12px 2px rgba(46, 125, 50, 0.35)'
          : undefined,
        position: 'relative',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* レーン番号バッジ */}
      <Box
        sx={{
          position: 'absolute', top: 8, left: 8,
          bgcolor: 'primary.main', color: 'white',
          px: 2, py: 0.5, borderRadius: 1, fontWeight: 'bold', zIndex: 1, fontSize: '0.85rem',
        }}
      >
        {lane.lane_name ?? `レーン ${lane.lane_number}`}
      </Box>

      {/* プレミアムバッジ */}
      {item.is_premium && (
        <Chip
          label="プレミアム" color="warning" size="small"
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
        />
      )}

      <CardMedia
        component="img"
        image={item.thumbnail_path || '/img/noimage.png'}
        alt={item.species_name}
        sx={{ aspectRatio: '3/2', objectFit: 'cover' }}
      />

      <CardContent>
        <Typography variant="caption" color="text.secondary">
          No.{item.item_number}
        </Typography>
        <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
          {item.species_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {item.seller_name ? `出品者：${item.seller_name}` : ''}
          {item.seller_name && item.quantity ? ' / ' : ''}
          {item.quantity ? `数量：${item.quantity}${item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹'}` : ''}
        </Typography>

        {/* 現在単価 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">現在単価</Typography>
          <Typography variant="h4" color="primary.main" fontWeight="bold">
            ¥{Math.floor(item.current_price).toLocaleString()}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              /1{item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹'}
            </Typography>
          </Typography>
        </Box>

        {/* カウントダウン表示 */}
        {isPreBid ? (
          <PreBidOverlay remainingSeconds={item.pre_bid_remaining_seconds ?? 0} />
        ) : isFreeze ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Chip
              label={`ブロック中 ${Math.ceil(item.freeze_remaining_seconds ?? item.countdown_seconds)}秒`}
              size="small"
              sx={{ bgcolor: 'grey.300', color: 'grey.700', fontWeight: 600 }}
            />
            {item.active_bidders_count > 0 && (
              <Chip icon={<PeopleIcon />} label="入札中" size="small" color="error" />
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <CountdownChip
              seconds={item.countdown_seconds}
              isCompetitive={isCompetitive}
              competitiveSeconds={item.countdown_seconds_competitive}
            />
            {item.active_bidders_count > 0 && (
              <Chip icon={<PeopleIcon />} label="入札中" size="small" color="error" />
            )}
          </Box>
        )}

        {/* 指値（上限価格）バッジ */}
        {onLimitEdit && (
          <Box sx={{ mt: 0.5 }}>
            <BidLimitBadge
              limitPrice={item.my_limit_price ?? null}
              isTriggered={item.my_limit_triggered ?? false}
              onEdit={() => onLimitEdit(item.id)}
              onRemove={onLimitRemove ? () => onLimitRemove(item.id) : undefined}
            />
          </Box>
        )}
      </CardContent>

      <CardActions>
        <BidButton
          myBidStatus={item.my_bid_status}
          isPreBid={isPreBid}
          isFreeze={isFreeze}
          freezeRemainingSeconds={item.freeze_remaining_seconds ?? item.countdown_seconds}
          freezeTotalSeconds={item.freeze_countdown_seconds}
          isLoading={isLoading}
          onToggle={() => onBidToggle(item.id, item.my_bid_status)}
        />
        <IconButton color="primary" onClick={() => onDetailOpen(lane)}>
          <InfoIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
});

LaneCard.displayName = 'LaneCard';
