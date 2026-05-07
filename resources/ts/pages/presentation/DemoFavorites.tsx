/**
 * デモ用お気に入りページ
 * 実際の Favorites.tsx と同じデザインを再現
 */
import { useState } from 'react';
import {
  Container, Box, Typography, Grid, Card, CardMedia, CardContent,
  Chip, Paper, Button, IconButton, Avatar,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
} from '@mui/icons-material';
import { ItemDetailDialog } from '../../features/auction-live/components/ItemDetailDialog';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { MOCK_ITEMS, STATUS_CONFIG, itemDataToLaneItem } from './mockData';

type MockItem = typeof MOCK_ITEMS[0];

interface DemoFavoritesProps {
  onNavigateToAuctions: () => void;
  onLimitSetCallback?: () => void;
  /** ツアー中のインタラクション制限（指値設定以外をブロック） */
  blockNonLimitActions?: boolean;
  /** 共有: お気に入りID (親から渡された場合はローカル状態を使わない) */
  favoriteIds?: Set<number>;
  onFavoriteToggle?: (itemId: number) => void;
  /** 共有: 指値設定 */
  limitSettings?: Record<number, { limit_price: number | null; is_triggered: boolean }>;
  onLimitSet?: (itemId: number, price: number) => void;
  onLimitRemove?: (itemId: number) => void;
}

export function DemoFavorites({ onNavigateToAuctions, onLimitSetCallback, blockNonLimitActions = false, favoriteIds: externalFavoriteIds, onFavoriteToggle, limitSettings: externalLimitSettings, onLimitSet, onLimitRemove }: DemoFavoritesProps) {
  // ローカル状態はガイド付きデモ用フォールバック
  const [localFavoriteIds, setLocalFavoriteIds] = useState<Set<number>>(new Set([1, 2, 5, 7]));
  const [localLimitSettings, setLocalLimitSettings] = useState<Record<number, { limit_price: number | null; is_triggered: boolean }>>({});
  const favoriteItemIds = externalFavoriteIds ?? localFavoriteIds;
  const limitSettings = externalLimitSettings ?? localLimitSettings;
  const [limitModalItem, setLimitModalItem] = useState<MockItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MockItem | null>(null);

  const favorites = MOCK_ITEMS.filter(item => favoriteItemIds.has(item.id));

  const handleRemoveFavorite = (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    if (onFavoriteToggle) { onFavoriteToggle(itemId); return; }
    setLocalFavoriteIds(prev => { const next = new Set(prev); next.delete(itemId); return next; });
  };

  const getLimitForItem = (itemId: number) => limitSettings[itemId] ?? { limit_price: null, is_triggered: false };

  const handleSetLimit = (price: number) => {
    if (!limitModalItem) return;
    if (onLimitSet) { onLimitSet(limitModalItem.id, price); }
    else { setLocalLimitSettings(prev => ({ ...prev, [limitModalItem.id]: { limit_price: price, is_triggered: false } })); }
    setLimitModalItem(null);
    onLimitSetCallback?.();
  };

  const handleRemoveLimit = (itemId: number) => {
    if (onLimitRemove) { onLimitRemove(itemId); return; }
    setLocalLimitSettings(prev => { const next = { ...prev }; delete next[itemId]; return next; });
  };

  const getAuctionStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return '開催予定';
      case 'live': return '開催中';
      case 'finished': return '終了';
      default: return status;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper data-tour-target="favorites-header" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">お気に入り</Typography>
            <Typography variant="body2" color="text.secondary">{favorites.length}件のお気に入り</Typography>
          </Box>
        </Box>
      </Paper>

      {favorites.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <FavoriteIcon sx={{ fontSize: 48, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            お気に入りはまだありません
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            オークションの出品一覧からハートアイコンをタップして追加できます
          </Typography>
          <Button variant="contained" onClick={onNavigateToAuctions}>オークション一覧へ</Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {favorites.map((item, idx) => {
            const s = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };
            return (
              <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
                <Card onClick={() => { if (!blockNonLimitActions) setSelectedItem(item); }} sx={{
                  cursor: blockNonLimitActions ? 'default' : 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative', borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                  ...(!blockNonLimitActions && { '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }),
                }}>
                  {/* お気に入り解除ボタン */}
                  <IconButton onClick={(e) => { if (blockNonLimitActions) { e.stopPropagation(); return; } handleRemoveFavorite(e, item.id); }} size="small"
                    sx={{
                      position: 'absolute', top: 4, left: 4, zIndex: 2,
                      bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                      width: 32, height: 32,
                    }}>
                    <FavoriteIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                  </IconButton>

                  {item.is_premium && (
                    <Chip label="プレミアム" color="warning" size="small"
                      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} />
                  )}

                  <CardMedia component="img" image={item.thumbnail_path || '/img/noimage.png'}
                    alt={item.species_name} sx={{ aspectRatio: '3/2', objectFit: 'cover' }} />

                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }} noWrap>
                      デモフリーオークション ({getAuctionStatusLabel('scheduled')})
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
                      <Chip label={s.label} color={s.color} size="small" />
                    </Box>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>{item.species_name}</Typography>
                    {item.seller_name && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                        <Avatar
                          src={item.seller_profile_image_url || undefined}
                          sx={{ width: 20, height: 20, fontSize: '0.7rem', bgcolor: 'grey.300' }}
                        >
                          {!item.seller_profile_image_url && item.seller_name.charAt(0)}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.seller_name}
                        </Typography>
                      </Box>
                    )}
                    {item.inspection_info && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }} noWrap>
                        {item.inspection_info}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        ¥{Number(item.start_price).toLocaleString()}〜
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{item.quantity}匹</Typography>
                    </Box>
                  </CardContent>
                </Card>
                {/* 指値バッジ */}
                <Box data-tour-target={idx === 0 ? 'favorites-first-limit' : undefined} sx={{ px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderTop: 'none', borderColor: 'divider', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
                  <BidLimitBadge
                    limitPrice={getLimitForItem(item.id).limit_price}
                    isTriggered={getLimitForItem(item.id).is_triggered}
                    onEdit={() => setLimitModalItem(item)}
                    onRemove={() => handleRemoveLimit(item.id)}
                  />
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Item Detail Dialog（本番と同じメディアギャラリー） */}
      <ItemDetailDialog
        open={!!selectedItem}
        item={selectedItem ? itemDataToLaneItem(selectedItem) : null}
        onClose={() => setSelectedItem(null)}
        priceLabel="start"
        startPrice={selectedItem?.start_price}
        isFavorited={selectedItem ? favoriteItemIds.has(selectedItem.id) : false}
        onFavoriteToggle={(itemId) => {
          handleRemoveFavorite({ stopPropagation: () => {} } as React.MouseEvent, itemId);
          setSelectedItem(null);
        }}
      />

      {/* BidLimitModal */}
      {limitModalItem && (
        <BidLimitModal
          open={!!limitModalItem}
          onClose={() => setLimitModalItem(null)}
          itemId={limitModalItem.id}
          speciesName={limitModalItem.species_name}
          currentLimitPrice={getLimitForItem(limitModalItem.id).limit_price}
          currentPrice={limitModalItem.start_price}
          quickOptions={null}
          isLive={false}
          isSetting={false}
          isRemoving={false}
          onSet={handleSetLimit}
          onRemove={() => { handleRemoveLimit(limitModalItem.id); setLimitModalItem(null); }}
          zIndex={1500}
        />
      )}
    </Container>
  );
}
