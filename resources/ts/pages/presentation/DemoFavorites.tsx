/**
 * デモ用お気に入りページ
 * 実際の Favorites.tsx と同じデザインを再現
 */
import { useState } from 'react';
import {
  Container, Box, Typography, Grid, Card, CardMedia, CardContent,
  Chip, Paper, Button, IconButton,
  Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { MOCK_ITEMS, STATUS_CONFIG } from './mockData';

type MockItem = typeof MOCK_ITEMS[0];

interface DemoFavoritesProps {
  onNavigateToAuctions: () => void;
}

export function DemoFavorites({ onNavigateToAuctions }: DemoFavoritesProps) {
  // デモ用: 最初から数件お気に入り登録済み
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<number>>(new Set([1, 2, 5, 7]));
  const [limitSettings, setLimitSettings] = useState<Record<number, { limit_price: number | null; is_triggered: boolean }>>({});
  const [limitModalItem, setLimitModalItem] = useState<MockItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MockItem | null>(null);

  const favorites = MOCK_ITEMS.filter(item => favoriteItemIds.has(item.id));

  const handleRemoveFavorite = (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    setFavoriteItemIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const getLimitForItem = (itemId: number) => limitSettings[itemId] ?? { limit_price: null, is_triggered: false };

  const handleSetLimit = (price: number) => {
    if (!limitModalItem) return;
    setLimitSettings(prev => ({ ...prev, [limitModalItem.id]: { limit_price: price, is_triggered: false } }));
    setLimitModalItem(null);
  };

  const handleRemoveLimit = (itemId: number) => {
    setLimitSettings(prev => { const next = { ...prev }; delete next[itemId]; return next; });
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
          {favorites.map((item) => {
            const s = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };
            return (
              <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
                <Card onClick={() => setSelectedItem(item)} sx={{
                  cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative', borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                }}>
                  {/* お気に入り解除ボタン */}
                  <IconButton onClick={(e) => handleRemoveFavorite(e, item.id)} size="small"
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
                      2026年春季メダカオークション ({getAuctionStatusLabel('scheduled')})
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
                      <Chip label={s.label} color={s.color} size="small" />
                    </Box>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>{item.species_name}</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        ¥{Number(item.start_price).toLocaleString()}〜
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{item.quantity}匹セット</Typography>
                    </Box>
                  </CardContent>
                </Card>
                {/* 指値バッジ */}
                <Box sx={{ px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderTop: 'none', borderColor: 'divider', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
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

      {/* Item Detail Dialog */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onClose={() => setSelectedItem(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              {selectedItem.species_name}
              <Typography variant="body2" color="text.secondary">No.{selectedItem.item_number}</Typography>
            </Box>
            <IconButton onClick={() => setSelectedItem(null)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent>
            <Box
              component="img"
              src={selectedItem.thumbnail_path || '/img/noimage.png'}
              alt={selectedItem.species_name}
              sx={{ width: '100%', maxHeight: 400, objectFit: 'contain', mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {selectedItem.is_premium && <Chip label="プレミアム" color="warning" size="small" />}
              <Chip label={(STATUS_CONFIG[selectedItem.status] ?? { label: selectedItem.status, color: 'default' as const }).label}
                color={(STATUS_CONFIG[selectedItem.status] ?? { label: selectedItem.status, color: 'default' as const }).color} size="small" />
            </Box>
            <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold', mb: 1 }}>
              ¥{Number(selectedItem.start_price).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedItem.quantity}匹セット
            </Typography>
            {selectedItem.inspection_info && (
              <Typography variant="body2" color="text.secondary">
                検査情報: {selectedItem.inspection_info}
              </Typography>
            )}
          </DialogContent>
        </Dialog>
      )}

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
        />
      )}
    </Container>
  );
}
