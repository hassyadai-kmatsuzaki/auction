import React from 'react';
import {
  Card, CardMedia, CardContent, CardActions,
  Box, Typography, Chip, IconButton, Avatar,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { LiveLane } from '@/types';
import { CountdownChip } from './CountdownChip';
import { BidButton } from './BidButton';
import { PreBidOverlay } from './PreBidOverlay';
import { BidLimitBadge } from '../../bid-limit/components/BidLimitBadge';
import { optimizedImageUrl } from '@/lib/optimizedMedia';
import { formatYen } from '@/lib/formatPrice';

interface Props {
  lane: LiveLane;
  isLoading: boolean;
  onBidToggle: (itemId: number, currentStatus: 'active' | 'inactive' | null) => void;
  onDetailOpen: (lane: LiveLane) => void;
  onLimitEdit?: (itemId: number) => void;
  onLimitRemove?: (itemId: number) => void;
  /** 詳細ボタンを無効化 */
  disableDetail?: boolean;
}

/**
 * レーンカード1枚
 * React.memo + 細粒度メモ化で不要な再レンダリングを防ぐ
 */
export const LaneCard = React.memo(({ lane, isLoading, onBidToggle, onDetailOpen, onLimitEdit, onLimitRemove, disableDetail }: Props) => {
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
  const isMyBidActive = item.my_bid_status === 'active';

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        border: isMyBidActive ? '2px solid transparent' : 1,
        borderColor: isMyBidActive ? undefined : 'divider',
        borderRadius: 2,
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        transform: isMyBidActive ? 'translateY(-2px)' : 'none',
        ...(isMyBidActive && {
          backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #DAA520, #FFD700)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0 0 18px 4px rgba(255, 215, 0, 0.35), 0 0 40px 8px rgba(255, 165, 0, 0.15)',
          animation: 'activeBidGlow 2s ease-in-out infinite',
          '@keyframes activeBidGlow': {
            '0%, 100%': {
              boxShadow: '0 0 18px 4px rgba(255, 215, 0, 0.35), 0 0 40px 8px rgba(255, 165, 0, 0.15)',
            },
            '50%': {
              boxShadow: '0 0 24px 8px rgba(255, 215, 0, 0.55), 0 0 56px 12px rgba(255, 165, 0, 0.25)',
            },
          },
        }),
      }}
    >
      {/* 入札権利時のシマー（光の走査線）エフェクト */}
      {isMyBidActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 'inherit',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 2,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0, left: '-100%',
              width: '60%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.12), rgba(255, 255, 255, 0.18), rgba(255, 215, 0, 0.12), transparent)',
              animation: 'shimmerSweep 3s ease-in-out infinite',
              '@keyframes shimmerSweep': {
                '0%':   { left: '-100%' },
                '100%': { left: '200%' },
              },
            },
          }}
        />
      )}

      {/* 入札権利バッジ */}
      {isMyBidActive && (
        <Box
          sx={{
            position: 'absolute', top: -10, right: -6, zIndex: 3,
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            color: '#5D3A00',
            px: 1.5, py: 0.4,
            borderRadius: '12px',
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 2px 8px rgba(255, 165, 0, 0.5)',
            animation: 'badgePulse 2s ease-in-out infinite',
            '@keyframes badgePulse': {
              '0%, 100%': { transform: 'scale(1)' },
              '50%':      { transform: 'scale(1.08)' },
            },
          }}
        >
          最高入札者
        </Box>
      )}

      {/* レーン番号バッジ + プレミアムバッジ */}
      <Box
        sx={{
          position: 'absolute', top: 8, left: 8,
          display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 1,
        }}
      >
        <Box
          sx={{
            bgcolor: 'primary.main', color: 'white',
            px: 2, py: 0.5, borderRadius: 1, fontWeight: 'bold', fontSize: '0.85rem',
          }}
        >
          {lane.lane_name ?? `レーン ${lane.lane_number}`}
        </Box>
        {item.is_premium && (
          <Chip label="プレミアム" color="warning" size="small" />
        )}
        {item.is_anonymous && (
          <Chip label="匿名出品" color="info" size="small" />
        )}
      </Box>

      <CardMedia
        component="img"
        image={optimizedImageUrl(item.thumbnail_path, 'small')}
        alt={item.species_name}
        loading="lazy"
        sx={{ aspectRatio: '3/2', objectFit: 'cover' }}
      />

      <CardContent>
        <Typography variant="caption" color="text.secondary">
          No.{item.item_number}
        </Typography>
        <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
          {item.species_name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.5, mb: 0.5 }}>
          {item.is_anonymous ? (
            <Typography variant="caption" color="text.secondary">
              匿名出品
            </Typography>
          ) : (
            item.seller_name && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Avatar
                  src={item.seller_profile_image_url || undefined}
                  sx={{ width: 20, height: 20, fontSize: '0.7rem', bgcolor: 'grey.300' }}
                >
                  {!item.seller_profile_image_url && item.seller_name.charAt(0)}
                </Avatar>
                <Typography variant="caption" color="text.secondary">
                  {item.seller_name}
                </Typography>
              </Box>
            )
          )}
          {item.quantity != null && (
            <Typography variant="caption" color="text.secondary">
              {(item.is_anonymous || item.seller_name) ? '/ ' : ''}数量：{item.quantity}{item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹'}
            </Typography>
          )}
        </Box>
        {item.inspection_info && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }} noWrap>
            {item.inspection_info}
          </Typography>
        )}

        {/* 現在単価 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">現在単価</Typography>
          <Typography variant="h4" color="primary.main" fontWeight="bold">
            ¥{formatYen(item.current_price)}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              /1{item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹'}
            </Typography>
          </Typography>
        </Box>

        {/* カウントダウン表示 */}
        {isPreBid ? (
          <PreBidOverlay remainingSeconds={item.pre_bid_remaining_seconds ?? 0} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <CountdownChip
              seconds={item.countdown_seconds}
              isCompetitive={isCompetitive}
              phase={isFreeze ? 'freeze' : 'bidding'}
              freezeTotalSeconds={item.freeze_countdown_seconds}
              freezeRemainingSeconds={item.freeze_remaining_seconds ?? item.countdown_seconds}
            />
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
          isTopBidder={item.my_bid_status === 'active' && item.active_bidders_count === 1}
          activeBidderCount={item.active_bidders_count}
          onToggle={() => onBidToggle(item.id, item.my_bid_status)}
        />
        <IconButton color="primary" onClick={() => onDetailOpen(lane)}
          disabled={disableDetail}
          sx={disableDetail ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
          <InfoIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
});

LaneCard.displayName = 'LaneCard';
