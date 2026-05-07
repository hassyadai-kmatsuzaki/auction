import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
} from '@mui/material';
import {
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { LiveLane, UpcomingItem } from '@/types';
import { BidLimitBadge } from '../../bid-limit/components/BidLimitBadge';
import { optimizedImageUrl } from '@/lib/optimizedMedia';
import { formatYen } from '@/lib/formatPrice';

interface Props {
  lanes: LiveLane[];
  onFavoriteToggle?: (itemId: number) => void;
  onLimitEdit?: (itemId: number) => void;
}

export function UpcomingItems({ lanes, onFavoriteToggle, onLimitEdit }: Props) {
  const [infoItem, setInfoItem] = useState<(UpcomingItem & { laneNumber: number }) | null>(null);

  const items: (UpcomingItem & { laneNumber: number })[] = [];

  for (const lane of lanes) {
    if (!lane.upcoming_items?.length) continue;
    for (const item of lane.upcoming_items) {
      items.push({ ...item, laneNumber: lane.lane_number });
    }
  }

  if (items.length === 0) return null;

  return (
    <>
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
          次の商品
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                flexShrink: 0,
                width: 160,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: 'background.paper',
              }}
            >
              {item.thumbnail_path ? (
                <Box
                  component="img"
                  src={optimizedImageUrl(item.thumbnail_path, 'thumb')}
                  alt={item.species_name}
                  loading="lazy"
                  sx={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '3/2',
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PetsIcon sx={{ color: 'grey.400', fontSize: 28 }} />
                </Box>
              )}
              <Box sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                  <Chip
                    label={`L${item.laneNumber}`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                    color="primary"
                    variant="outlined"
                  />
                  {item.is_premium && (
                    <Chip label="P" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
                  )}
                </Box>
                <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>
                  {item.species_name}
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight="bold">
                  ¥{formatYen(item.start_price)}〜
                </Typography>

                {/* アクションボタン */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                  {/* infoボタン */}
                  <Tooltip title="詳細を見る" arrow>
                    <IconButton size="small" onClick={() => setInfoItem(item)} sx={{ p: 0.25 }}>
                      <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    </IconButton>
                  </Tooltip>

                  {/* お気に入り */}
                  {onFavoriteToggle && (
                    <IconButton size="small" onClick={() => onFavoriteToggle(item.id)} sx={{ p: 0.25 }}>
                      {item.is_favorited
                        ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                        : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
                    </IconButton>
                  )}
                </Box>

                {/* 指値バッジ */}
                {onLimitEdit && (
                  <Box sx={{ mt: 0.5 }}>
                    <BidLimitBadge
                      limitPrice={item.my_limit_price ?? null}
                      isTriggered={item.my_limit_triggered ?? false}
                      onEdit={() => onLimitEdit(item.id)}
                      size="small"
                    />
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* 次の商品 詳細ダイアログ */}
      <Dialog open={!!infoItem} onClose={() => setInfoItem(null)} maxWidth="xs" fullWidth>
        {infoItem && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight="bold">
                  {infoItem.species_name}
                </Typography>
                <IconButton onClick={() => setInfoItem(null)} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {infoItem.thumbnail_path && (
                <Box
                  component="img"
                  src={optimizedImageUrl(infoItem.thumbnail_path, 'medium')}
                  alt={infoItem.species_name}
                  sx={{ width: '100%', borderRadius: 1.5, mb: 2, objectFit: 'cover' }}
                />
              )}
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Chip label={`レーン ${infoItem.laneNumber}`} size="small" color="primary" />
                {infoItem.is_premium && <Chip label="プレミアム" size="small" color="warning" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No.{infoItem.item_number} / 数量: {infoItem.quantity}
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight="bold">
                ¥{formatYen(infoItem.start_price)}〜
              </Typography>
              <Divider sx={{ my: 2 }} />

              {/* 指値設定 */}
              {onLimitEdit && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>指値（上限価格）</Typography>
                  <BidLimitBadge
                    limitPrice={infoItem.my_limit_price ?? null}
                    isTriggered={infoItem.my_limit_triggered ?? false}
                    onEdit={() => { onLimitEdit(infoItem.id); setInfoItem(null); }}
                    size="medium"
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInfoItem(null)}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
