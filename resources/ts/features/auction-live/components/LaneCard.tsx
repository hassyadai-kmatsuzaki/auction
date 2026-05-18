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
  /**
   * 実装書 H2: phase を引数に追加
   *   旧シグネチャでは parent の inline lambda で phase を取得していた
   *   ため React.memo が無効化されていた。phase を ここで渡すことで
   *   parent は固定 ref ハンドラをそのまま渡せる。
   */
  onBidToggle: (itemId: number, currentStatus: 'active' | 'inactive' | null, phase?: string) => void;
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
    // 実装書 F2/F6: 動的 sx animation を static CSS class に切替
    //   修正前: isMyBidActive 切替時に sx 全体が再評価 → MUI styled-component
    //           再生成 → DOM style tag 再挿入 → 25 枚並列で paint 過熱
    //   修正後: className で切替（GPU 合成可能、メイン thread 影響なし）
    <Card
      className={isMyBidActive ? 'active-bid-card' : ''}
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        border: isMyBidActive ? '2px solid transparent' : 1,
        borderColor: isMyBidActive ? undefined : 'divider',
        borderRadius: 2,
        transition: 'border 0.3s ease',
        // ※ 動的 boxShadow / animation / backgroundImage は active-bid-card クラスに移動
      }}
    >
      {/* 入札権利時のシマー（光の走査線）エフェクト
          実装書 C2: sx 内 @keyframes → static CSS class（auction-live.css）に移管 */}
      {isMyBidActive && <Box className="active-bid-shimmer" />}

      {/* 入札権利バッジ
          実装書 C2: sx 内 @keyframes → static CSS class（auction-live.css）に移管 */}
      {isMyBidActive && <Box className="active-bid-badge">最高入札者</Box>}

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
          {item.exhibit_code ?? `No.${item.item_number}`}
        </Typography>
        <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
          {item.species_name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.5, mb: 0.5 }}>
          {item.is_anonymous ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar sx={{ width: 20, height: 20, bgcolor: 'grey.300' }} />
              <Typography variant="caption" color="text.secondary">
                -
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar
                src={item.seller_profile_image_url || undefined}
                sx={{ width: 20, height: 20, fontSize: '0.7rem', bgcolor: 'grey.300' }}
              >
                {!item.seller_profile_image_url && (item.seller_name?.charAt(0) ?? '-')}
              </Avatar>
              <Typography variant="caption" color="text.secondary">
                {item.seller_name || '-'}
              </Typography>
            </Box>
          )}
          {item.quantity != null && (
            <Typography variant="caption" color="text.secondary">
              / 数量：{item.quantity}{item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹'}
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
          onToggle={() => onBidToggle(item.id, item.my_bid_status, item.phase)}
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
