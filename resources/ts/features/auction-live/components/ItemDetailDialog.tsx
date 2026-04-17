import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Grid, Typography, Button, IconButton, Chip, Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import type { LaneItem } from '@/types';
import { BidButton } from './BidButton';
import { CountdownChip } from './CountdownChip';
import { BidLimitBadge } from '../../bid-limit/components/BidLimitBadge';
import { optimizedImageUrl } from '@/lib/optimizedMedia';

interface Props {
  open: boolean;
  item: LaneItem | null;
  onClose: () => void;
  isLoading?: boolean;
  onBidToggle?: (itemId: number, currentStatus: 'active' | 'inactive' | null) => void;
  onLimitEdit?: (itemId: number) => void;
  onLimitRemove?: (itemId: number) => void;
  zIndex?: number;
  /** 価格ラベル: 'current'=現在単価（ライブ用） / 'start'=開始価格（一覧・お気に入り用） */
  priceLabel?: 'current' | 'start';
  /** 開始価格（priceLabel='start' の場合に表示する価格。未指定なら item.current_price を使用） */
  startPrice?: number;
}

type MediaEntry = { type: 'image' | 'video'; url: string };

const resolveUrl = (url: string, item?: LaneItem | null): string => {
  if (!url || url.startsWith('http') || url.startsWith('/')) return url;
  const thumb = item?.thumbnail_path;
  if (thumb?.startsWith('http')) {
    const idx = thumb.indexOf('items/');
    if (idx > 0) return thumb.substring(0, idx) + url;
  }
  return url;
};

type MediaEntryWithOriginal = MediaEntry & { originalUrl: string };

const buildMediaList = (item: LaneItem | null): MediaEntryWithOriginal[] => {
  if (!item) return [];
  const list: MediaEntryWithOriginal[] = [];
  if (item.thumbnail_path) {
    list.push({ type: 'image', url: optimizedImageUrl(item.thumbnail_path, 'medium'), originalUrl: item.thumbnail_path });
  }
  item.media?.forEach((m: any) => {
    const rawUrl = m.file_url || m.file_path || m.url;
    if (!rawUrl) return;
    if (m.is_thumbnail && item.thumbnail_path) return;
    const url = resolveUrl(rawUrl, item);
    if (url === item.thumbnail_path) return;
    const isVideo = m.media_type?.includes('video') || m.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(url);
    list.push({
      type: isVideo ? 'video' : 'image',
      url: isVideo ? url : optimizedImageUrl(url, 'medium'),
      originalUrl: url,
    });
  });
  if (list.length === 0) list.push({ type: 'image', url: '/img/noimage.png', originalUrl: '/img/noimage.png' });
  return list;
};

export const ItemDetailDialog = React.memo(({ open, item, onClose, isLoading, onBidToggle, onLimitEdit, onLimitRemove, zIndex, priceLabel = 'current', startPrice }: Props) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [videoDialogUrl, setVideoDialogUrl] = useState('');
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const mediaList = buildMediaList(item);
  const current = mediaList[mediaIndex] ?? mediaList[0];
  const unit = item?.quantity_unit === 'kg' ? 'kg' : item?.quantity_unit === 'bag' ? '袋' : '匹';

  const handleClose = () => {
    setMediaIndex(0);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth sx={zIndex !== undefined ? { zIndex } : undefined}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              No.{item?.item_number} {item?.species_name}
            </Typography>
            <IconButton onClick={handleClose}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* 左: メディア */}
            <Grid item xs={12} md={6}>
              <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                {current?.type === 'video' ? (
                  <video src={current.originalUrl} controls preload="metadata" playsInline style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
                ) : (
                  <img
                    src={current?.url || '/img/noimage.png'}
                    alt={item?.species_name}
                    style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain', cursor: 'pointer' }}
                    onClick={() => { setLightboxIndex(mediaIndex); setLightboxOpen(true); }}
                  />
                )}
              </Box>
              {mediaList.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                  {mediaList.map((m, i) => (
                    <Box
                      key={i}
                      onClick={() => {
                        if (m.type === 'video') { setVideoDialogUrl(m.url); setVideoDialogOpen(true); }
                        else setMediaIndex(i);
                      }}
                      sx={{
                        width: 64, height: 64, flexShrink: 0, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                        border: i === mediaIndex ? '2px solid' : '2px solid transparent',
                        borderColor: i === mediaIndex ? 'primary.main' : 'transparent',
                        bgcolor: 'grey.200', position: 'relative',
                      }}
                    >
                      {m.type === 'video' ? (
                        <Box sx={{ width: '100%', height: '100%', bgcolor: 'black', position: 'relative' }}>
                          <video src={m.originalUrl} preload="none" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 28 }} />
                          </Box>
                        </Box>
                      ) : (
                        <img src={m.type === 'image' ? optimizedImageUrl(m.originalUrl, 'thumb') : m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>

            {/* 右: 詳細 */}
            <Grid item xs={12} md={6}>
              {/* プレミアムバッジ */}
              {item?.is_premium && (
                <Box sx={{ mb: 1 }}>
                  <Chip label="プレミアム" color="warning" size="small" />
                </Box>
              )}

              {/* 価格 */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {priceLabel === 'start' ? '開始価格' : '現在単価'}
                </Typography>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  ¥{(() => {
                    const price = priceLabel === 'start'
                      ? (startPrice ?? item?.current_price ?? 0)
                      : (item?.current_price ?? 0);
                    return Math.floor(Number(price)).toLocaleString();
                  })()}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    /1{unit}
                  </Typography>
                </Typography>
              </Box>

              {/* 出品者・数量 */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 1.5 }}>
                {item?.seller_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Avatar
                      src={item.seller_profile_image_url || undefined}
                      sx={{ width: 28, height: 28, fontSize: '0.85rem', bgcolor: 'grey.300' }}
                    >
                      {!item.seller_profile_image_url && item.seller_name.charAt(0)}
                    </Avatar>
                    <Typography variant="body2" color="text.primary">
                      {item.seller_name}
                    </Typography>
                  </Box>
                )}
                {item?.quantity != null && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InventoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {item.quantity}{unit}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* 備考（検査情報・個体情報） */}
              {(item?.inspection_info || item?.individual_info) && (
                <Box sx={{ mb: 1.5 }}>
                  {item?.inspection_info && (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary', mb: item?.individual_info ? 0.75 : 0 }}>
                      {item.inspection_info}
                    </Typography>
                  )}
                  {item?.individual_info && (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                      {item.individual_info}
                    </Typography>
                  )}
                </Box>
              )}

              {/* カウントダウン */}
              {item && onBidToggle && item.phase !== 'pre_bid' && (
                <Box sx={{ mb: 1.5 }}>
                  <CountdownChip
                    seconds={item.countdown_seconds}
                    isCompetitive={item.active_bidders_count >= 2}
                    phase={item.phase === 'freeze' ? 'freeze' : 'bidding'}
                    freezeTotalSeconds={item.freeze_countdown_seconds}
                    freezeRemainingSeconds={item.freeze_remaining_seconds ?? item.countdown_seconds}
                  />
                </Box>
              )}

              {/* 入札ボタン */}
              {item && onBidToggle && (
                <Box sx={{ mb: 1.5 }}>
                  <BidButton
                    myBidStatus={item.my_bid_status}
                    isPreBid={item.phase === 'pre_bid'}
                    isFreeze={item.phase === 'freeze'}
                    freezeRemainingSeconds={item.freeze_remaining_seconds ?? item.countdown_seconds}
                    freezeTotalSeconds={item.freeze_countdown_seconds}
                    isLoading={isLoading ?? false}
                    isTopBidder={item.my_bid_status === 'active' && item.active_bidders_count === 1}
                    activeBidderCount={item.active_bidders_count}
                    onToggle={() => onBidToggle(item.id, item.my_bid_status)}
                  />
                </Box>
              )}

              {/* 指値ボタン */}
              {item && onLimitEdit && (
                <Box>
                  <BidLimitBadge
                    limitPrice={item.my_limit_price ?? null}
                    isTriggered={item.my_limit_triggered ?? false}
                    onEdit={() => onLimitEdit(item.id)}
                    onRemove={onLimitRemove ? () => onLimitRemove(item.id) : undefined}
                    size="medium"
                  />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 画像拡大ライトボックス */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none', m: 1, maxHeight: '98vh' } }}
        sx={zIndex !== undefined ? { zIndex: zIndex + 100 } : undefined}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setLightboxOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
          {mediaList.length > 1 && (
            <>
              <IconButton onClick={() => setLightboxIndex(p => (p - 1 + mediaList.length) % mediaList.length)} sx={{ position: 'absolute', left: 8, color: 'white', zIndex: 2 }}>
                <ChevronLeftIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <IconButton onClick={() => setLightboxIndex(p => (p + 1) % mediaList.length)} sx={{ position: 'absolute', right: 8, color: 'white', zIndex: 2 }}>
                <ChevronRightIcon sx={{ fontSize: 40 }} />
              </IconButton>
            </>
          )}
          {(() => {
            const m = mediaList[lightboxIndex];
            if (!m) return null;
            if (m.type === 'video') return <video src={m.originalUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />;
            // ライトボックスではlargeプリセットを使用
            return <img src={optimizedImageUrl(m.originalUrl, 'large')} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />;
          })()}
        </Box>
        <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 1 }}>
          {lightboxIndex + 1} / {mediaList.length}
        </Typography>
      </Dialog>

      {/* 動画全画面 */}
      <Dialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', m: 1, maxHeight: '98vh' } }}
        sx={zIndex !== undefined ? { zIndex: zIndex + 100 } : undefined}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setVideoDialogOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
          {videoDialogUrl && <video src={videoDialogUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />}
        </Box>
      </Dialog>
    </>
  );
});

ItemDetailDialog.displayName = 'ItemDetailDialog';
