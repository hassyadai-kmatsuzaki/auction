import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Paper,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { bidLimitApi } from '../../api/participant/bidLimitApi';
import { optimizedImageUrl } from '../../lib/optimizedMedia';
import { useUserPreference } from '../../hooks/useUserPreference';
import { ItemDetailDialog } from '../../features/auction-live/components/ItemDetailDialog';
import type { LaneItem } from '../../types';

type SortKey = 'created_desc' | 'created_asc' | 'seller' | 'price_asc' | 'price_desc';

interface FavoriteItem {
  id: number;
  item_id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  inspection_info?: string;
  individual_info?: string;
  is_premium: boolean;
  is_anonymous?: boolean;
  thumbnail_path?: string;
  status: string;
  media?: any[];
  seller: {
    id: number | null;
    seller_code: string | null;
    seller_name: string | null;
    profile_image_url?: string | null;
  } | null;
  auction: {
    id: number;
    title: string;
    event_date: string;
    status: string;
    is_past: boolean;
  } | null;
  created_at: string;
}

export default function Favorites() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FavoriteItem | null>(null);
  const [limitModalItem, setLimitModalItem] = useState<FavoriteItem | null>(null);
  const [isSettingLimit, setIsSettingLimit] = useState(false);
  const queryClient = useQueryClient();

  // ユーザーごとに永続化される表示設定
  const [sortKey, setSortKey]         = useUserPreference<SortKey>('participant.favorites.sort', 'created_desc');
  const [sellerFilter, setSellerFilter] = useUserPreference<string>('participant.favorites.seller', 'all');
  const [includePast, setIncludePast] = useUserPreference<boolean>('participant.favorites.includePast', true);

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/participant/favorites', {
        params: { include_past: includePast ? 1 : 0 },
      });
      if (response.data.success) {
        setFavorites(response.data.data.favorites);
        setError(null);
      }
    } catch {
      setError('お気に入りの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [includePast]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // 出品者リスト（フィルター用）。匿名出品は候補に含めない。
  const sellerOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    favorites.forEach((f) => {
      if (f.is_anonymous) return;
      if (f.seller && f.seller.id != null) {
        map.set(f.seller.id, { id: f.seller.id, name: f.seller.seller_name || '-' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [favorites]);

  // フィルター + ソート結果
  const visibleFavorites = useMemo(() => {
    let list = [...favorites];

    if (sellerFilter !== 'all') {
      list = list.filter((f) => String(f.seller?.id ?? '') === sellerFilter);
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case 'created_asc':  return a.created_at.localeCompare(b.created_at);
        case 'created_desc': return b.created_at.localeCompare(a.created_at);
        case 'price_asc':    return Number(a.start_price) - Number(b.start_price);
        case 'price_desc':   return Number(b.start_price) - Number(a.start_price);
        case 'seller': {
          const an = a.seller?.seller_name ?? '';
          const bn = b.seller?.seller_name ?? '';
          const cmp = an.localeCompare(bn, 'ja');
          return cmp !== 0 ? cmp : b.created_at.localeCompare(a.created_at);
        }
        default: return 0;
      }
    });
    return list;
  }, [favorites, sellerFilter, sortKey]);

  // 指値一括取得
  const allItemIds = favorites.map(f => f.item_id);
  const { data: limitSettings = {} } = useQuery({
    queryKey: ['bid-limits-favorites', allItemIds.join(',')],
    queryFn: () => bidLimitApi.getMany(allItemIds),
    enabled: allItemIds.length > 0,
    staleTime: 10_000,
  });

  const invalidateLimits = () => queryClient.invalidateQueries({ queryKey: ['bid-limits-favorites'] });

  const handleSetLimit = async (itemId: number, price: number) => {
    setIsSettingLimit(true);
    try { await bidLimitApi.set(itemId, price); invalidateLimits(); } catch {} finally { setIsSettingLimit(false); }
  };
  const handleRemoveLimit = async (itemId: number) => {
    try {
      await bidLimitApi.remove(itemId);
      invalidateLimits();
      setFavorites(prev => prev.filter(f => f.item_id !== itemId));
    } catch {}
  };

  const handleRemoveFavorite = async (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    try {
      const response = await axios.post('/api/participant/favorites/toggle', { item_id: itemId });
      if (response.data.success && !response.data.is_favorited) {
        setFavorites(prev => prev.filter(f => f.item_id !== itemId));
      }
    } catch {
      // silent
    }
  };

  const handleDetailOpen = (item: FavoriteItem) => {
    setSelectedItem(item);
  };

  const handleDetailClose = () => {
    setSelectedItem(null);
  };

  const toLaneItem = (fav: FavoriteItem | null): LaneItem | null => {
    if (!fav) return null;
    return {
      id: fav.item_id,
      item_number: fav.item_number,
      species_name: fav.species_name,
      seller_name: fav.seller?.seller_name ?? '',
      seller_profile_image_url: fav.seller?.profile_image_url ?? null,
      quantity: fav.quantity,
      quantity_unit: 'fish',
      current_price: fav.current_price ?? fav.start_price,
      inspection_info: fav.inspection_info,
      individual_info: fav.individual_info,
      is_premium: fav.is_premium,
      is_anonymous: fav.is_anonymous,
      thumbnail_path: fav.thumbnail_path,
      media: fav.media as LaneItem['media'],
      active_bidders_count: 0,
      countdown_seconds: 0,
      my_bid_status: null,
      my_limit_price: limitSettings[fav.item_id]?.limit_price ?? null,
      my_limit_triggered: limitSettings[fav.item_id]?.is_triggered ?? false,
      phase: 'bidding',
      pre_bid_remaining_seconds: 0,
      freeze_remaining_seconds: 0,
      freeze_countdown_seconds: 0,
    } as LaneItem;
  };

  const getStatusChip = (_status: string) => {
    // ステータスタグは表示しない
    return null;
  };

  const getAuctionStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return '開催予定';
      case 'live': return '開催中';
      case 'finished': return '終了';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/participant/home')}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              お気に入り
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {visibleFavorites.length}件 / 全{favorites.length}件
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* フィルター・ソート・表示切替 */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>出品者</InputLabel>
            <Select
              value={sellerFilter}
              label="出品者"
              onChange={(e) => setSellerFilter(String(e.target.value))}
            >
              <MenuItem value="all">すべて</MenuItem>
              {sellerOptions.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>並び順</InputLabel>
            <Select
              value={sortKey}
              label="並び順"
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <MenuItem value="created_desc">登録日（新しい順）</MenuItem>
              <MenuItem value="created_asc">登録日(古い順)</MenuItem>
              <MenuItem value="seller">出品者順</MenuItem>
              <MenuItem value="price_asc">開始価格（安い順）</MenuItem>
              <MenuItem value="price_desc">開始価格（高い順）</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={includePast}
                onChange={(e) => setIncludePast(e.target.checked)}
                size="small"
              />
            }
            label="過去のオークションも表示"
          />
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {favorites.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <FavoriteIcon sx={{ fontSize: 48, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            お気に入りはまだありません
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            オークションの出品一覧からハートアイコンをタップして追加できます
          </Typography>
          <Button variant="contained" onClick={() => navigate('/participant/auctions')}>
            オークション一覧へ
          </Button>
        </Paper>
      ) : visibleFavorites.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            条件に一致するお気に入りがありません
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {visibleFavorites.map((item) => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                }}
                onClick={() => handleDetailOpen(item)}
              >
                {/* お気に入り解除ボタン */}
                <IconButton
                  onClick={(e) => handleRemoveFavorite(e, item.item_id)}
                  sx={{
                    position: 'absolute', top: 4, left: 4, zIndex: 2,
                    bgcolor: 'rgba(255,255,255,0.85)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                    width: 32, height: 32,
                  }}
                  size="small"
                >
                  <FavoriteIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                </IconButton>

                {item.is_premium && (
                  <Chip label="プレミアム" color="warning" size="small"
                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                  />
                )}

                <CardMedia
                  component="img"
                  image={optimizedImageUrl(item.thumbnail_path, 'small')}
                  alt={item.species_name}
                  loading="lazy"
                  sx={{ aspectRatio: '3/2', objectFit: 'cover' }}
                />

                <CardContent>
                  {/* オークション情報 */}
                  {item.auction && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }} noWrap>
                      {item.auction.title} ({getAuctionStatusLabel(item.auction.status)})
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      No.{item.item_number}
                    </Typography>
                    {getStatusChip(item.status)}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {item.species_name}
                  </Typography>
                  {item.is_anonymous ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      <Avatar sx={{ width: 20, height: 20, bgcolor: 'grey.300' }} />
                      <Typography variant="caption" color="text.secondary" noWrap>
                        -
                      </Typography>
                    </Box>
                  ) : (
                    item.seller && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                        <Avatar
                          src={item.seller.profile_image_url || undefined}
                          sx={{ width: 20, height: 20, fontSize: '0.7rem', bgcolor: 'grey.300' }}
                        >
                          {!item.seller.profile_image_url && (item.seller.seller_name?.charAt(0) ?? '-')}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.seller.seller_name || '-'}
                        </Typography>
                      </Box>
                    )
                  )}
                  {item.inspection_info && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }} noWrap>
                      {item.inspection_info}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      ¥{formatYen(item.start_price)}〜
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 400 }}>
                        /匹
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.quantity}匹
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Chip
                      icon={<InfoIcon sx={{ fontSize: 16 }} />}
                      label="詳細"
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={(e) => { e.stopPropagation(); handleDetailOpen(item); }}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                </CardContent>
              </Card>
              {/* 指値バッジ */}
              <Box sx={{ px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderTop: 'none', borderColor: 'divider', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
                <BidLimitBadge
                  limitPrice={limitSettings[item.item_id]?.limit_price ?? null}
                  isTriggered={limitSettings[item.item_id]?.is_triggered ?? false}
                  onEdit={() => setLimitModalItem(item)}
                  onRemove={() => handleRemoveLimit(item.item_id)}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 詳細ダイアログ */}
      <ItemDetailDialog
        open={!!selectedItem}
        item={toLaneItem(selectedItem)}
        onClose={handleDetailClose}
        priceLabel="start"
        startPrice={selectedItem?.start_price}
        onLimitEdit={() => { if (selectedItem) setLimitModalItem(selectedItem); }}
        onLimitRemove={() => { if (selectedItem) handleRemoveLimit(selectedItem.item_id); }}
        isFavorited={!!selectedItem}
        onFavoriteToggle={(itemId) => {
          handleRemoveFavorite({ stopPropagation: () => {} } as React.MouseEvent, itemId);
          handleDetailClose();
        }}
        extraActions={
          selectedItem?.auction ? (
            <>
              {selectedItem.auction.status === 'live' && (
                <Button
                  variant="contained"
                  onClick={() => {
                    const auctionId = selectedItem.auction!.id;
                    handleDetailClose();
                    navigate(`/participant/auction/${auctionId}/live`);
                  }}
                >
                  ライブ画面へ
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={() => {
                  const auctionId = selectedItem.auction!.id;
                  handleDetailClose();
                  navigate(`/participant/auction/${auctionId}/items`);
                }}
              >
                出品一覧へ
              </Button>
            </>
          ) : null
        }
      />

      {/* 指値設定モーダル */}
      {limitModalItem && (
        <BidLimitModal
          open={!!limitModalItem}
          onClose={() => setLimitModalItem(null)}
          itemId={limitModalItem.item_id}
          speciesName={limitModalItem.species_name}
          currentLimitPrice={limitSettings[limitModalItem.item_id]?.limit_price ?? null}
          currentPrice={limitModalItem.start_price}
          quickOptions={null}
          isLive={false}
          isSetting={isSettingLimit}
          onSet={(price) => { handleSetLimit(limitModalItem.item_id, price); setLimitModalItem(null); }}
          onRemove={() => { handleRemoveLimit(limitModalItem.item_id); setLimitModalItem(null); }}
        />
      )}
    </Container>
  );
}
