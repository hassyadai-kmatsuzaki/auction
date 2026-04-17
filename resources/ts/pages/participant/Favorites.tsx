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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Avatar,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  ArrowBack as ArrowBackIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { bidLimitApi, type BidLimitData } from '../../api/participant/bidLimitApi';
import { optimizedImageUrl } from '../../lib/optimizedMedia';
import { useUserPreference } from '../../hooks/useUserPreference';

type ViewMode = 'grid' | 'list';
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
  thumbnail_path?: string;
  status: string;
  media?: any[];
  seller: {
    id: number;
    seller_code: string;
    seller_name: string;
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FavoriteItem | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoDialogUrl, setVideoDialogUrl] = useState('');
  const [limitModalItem, setLimitModalItem] = useState<FavoriteItem | null>(null);
  const [isSettingLimit, setIsSettingLimit] = useState(false);
  const queryClient = useQueryClient();

  // ユーザーごとに永続化される表示設定
  const [viewMode, setViewMode]       = useUserPreference<ViewMode>('participant.favorites.viewMode', 'grid');
  const [sortKey, setSortKey]         = useUserPreference<SortKey>('participant.favorites.sort', 'created_desc');
  const [sellerFilter, setSellerFilter] = useUserPreference<string>('participant.favorites.seller', 'all');
  const [includePast, setIncludePast] = useUserPreference<boolean>('participant.favorites.includePast', false);

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

  // 出品者リスト（フィルター用）
  const sellerOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    favorites.forEach((f) => {
      if (f.seller) map.set(f.seller.id, { id: f.seller.id, name: f.seller.seller_name });
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
    setSelectedMediaIndex(0);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
    setSelectedMediaIndex(0);
  };

  const resolveUrl = (url: string, item?: { thumbnail_path?: string; media?: any[] } | null) => {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
    const thumb = item?.thumbnail_path;
    if (thumb && thumb.startsWith('http')) {
      const idx = thumb.indexOf('items/');
      if (idx > 0) return thumb.substring(0, idx) + url;
    }
    if (item?.media) {
      for (const m of item.media) {
        const fu = m.file_url;
        if (fu && fu.startsWith('http')) {
          const idx = fu.indexOf('items/');
          if (idx > 0) return fu.substring(0, idx) + url;
        }
      }
    }
    return url;
  };

  const getMediaList = (item: FavoriteItem | null) => {
    if (!item) return [];
    const list: { type: 'image' | 'video'; url: string }[] = [];
    if (item.thumbnail_path) {
      list.push({ type: 'image', url: item.thumbnail_path });
    }
    if (item.media && item.media.length > 0) {
      item.media.forEach((m: any) => {
        const rawUrl = m.file_url || m.file_path || m.url;
        if (!rawUrl) return;
        if (m.is_thumbnail && item.thumbnail_path) return;
        const url = resolveUrl(rawUrl, item);
        if (item.thumbnail_path && url === item.thumbnail_path) return;
        const isVideo = m.media_type?.includes('video') || m.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(url);
        list.push({ type: isVideo ? 'video' : 'image', url });
      });
    }
    if (list.length === 0) {
      list.push({ type: 'image', url: '/img/noimage.png' });
    }
    return list;
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
      registered: { label: '出品中', color: 'primary' },
      live: { label: '入札中', color: 'error' },
      sold: { label: '落札済', color: 'success' },
      unsold: { label: '不成立', color: 'default' },
    };
    const c = config[status] || { label: status, color: 'default' };
    return <Chip label={c.label} color={c.color} size="small" />;
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

          <Box sx={{ flex: 1 }} />

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            size="small"
            onChange={(_, v) => v && setViewMode(v)}
            aria-label="表示モード"
          >
            <ToggleButton value="grid" aria-label="グリッド">
              <Tooltip title="グリッド表示"><GridViewIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="list" aria-label="リスト">
              <Tooltip title="リスト表示"><ListViewIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
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
      ) : viewMode === 'grid' ? (
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
                  {item.seller && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      <Avatar
                        src={item.seller.profile_image_url || undefined}
                        sx={{ width: 20, height: 20, fontSize: '0.7rem', bgcolor: 'grey.300' }}
                      >
                        {!item.seller.profile_image_url && item.seller.seller_name.charAt(0)}
                      </Avatar>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {item.seller.seller_name}
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
                    <Typography variant="caption" color="text.secondary">
                      {item.quantity}匹セット
                    </Typography>
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
      ) : (
        <Paper variant="outlined">
          <List disablePadding>
            {visibleFavorites.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 && <Divider component="li" />}
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    py: 1.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    gap: 1,
                  }}
                  onClick={() => handleDetailOpen(item)}
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ minWidth: 160 }}>
                        <BidLimitBadge
                          limitPrice={limitSettings[item.item_id]?.limit_price ?? null}
                          isTriggered={limitSettings[item.item_id]?.is_triggered ?? false}
                          onEdit={() => setLimitModalItem(item)}
                          onRemove={() => handleRemoveLimit(item.item_id)}
                        />
                      </Box>
                      <IconButton
                        edge="end"
                        onClick={(e) => handleRemoveFavorite(e, item.item_id)}
                        aria-label="解除"
                      >
                        <FavoriteIcon sx={{ color: '#ef4444' }} />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar sx={{ mr: 1 }}>
                    <Avatar
                      variant="rounded"
                      src={optimizedImageUrl(item.thumbnail_path, 'small')}
                      alt={item.species_name}
                      sx={{ width: 72, height: 72 }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          No.{item.item_number}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {item.species_name}
                        </Typography>
                        {item.is_premium && <Chip label="プレミアム" color="warning" size="small" />}
                        {getStatusChip(item.status)}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mt: 0.5, alignItems: 'center' }}>
                        {item.seller && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Avatar
                              src={item.seller.profile_image_url || undefined}
                              sx={{ width: 18, height: 18, fontSize: '0.65rem', bgcolor: 'grey.300' }}
                            >
                              {!item.seller.profile_image_url && item.seller.seller_name.charAt(0)}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">
                              {item.seller.seller_name}
                            </Typography>
                          </Box>
                        )}
                        {item.auction && (
                          <Typography variant="caption" color="text.secondary">
                            {item.auction.title}（{getAuctionStatusLabel(item.auction.status)}）
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {item.quantity}匹 / 開始 ¥{Number(item.start_price).toLocaleString()}〜
                        </Typography>
                        {item.inspection_info && (
                          <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                            {item.inspection_info}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* 詳細ダイアログ */}
      <Dialog open={detailOpen} onClose={handleDetailClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              No.{selectedItem?.item_number} {selectedItem?.species_name}
            </Typography>
            <IconButton onClick={handleDetailClose}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {(() => {
            const mediaList = getMediaList(selectedItem);
            const currentMedia = mediaList[selectedMediaIndex] || mediaList[0];
            return (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                    {currentMedia?.type === 'video' ? (
                      <video src={currentMedia.url} controls style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
                    ) : (
                      <img
                        src={currentMedia?.url || '/img/noimage.png'}
                        alt={selectedItem?.species_name}
                        style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain', cursor: 'pointer' }}
                        onClick={() => openLightbox(selectedMediaIndex)}
                      />
                    )}
                  </Box>
                  {mediaList.length > 1 && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                      {mediaList.map((m, i) => (
                        <Box
                          key={i}
                          onClick={() => {
                            if (m.type === 'video') {
                              setVideoDialogUrl(m.url);
                              setVideoDialogOpen(true);
                            } else {
                              setSelectedMediaIndex(i);
                            }
                          }}
                          sx={{
                            width: 64, height: 64, flexShrink: 0, borderRadius: 1, overflow: 'hidden',
                            border: i === selectedMediaIndex ? '2px solid' : '2px solid transparent',
                            borderColor: i === selectedMediaIndex ? 'primary.main' : 'transparent',
                            cursor: 'pointer', bgcolor: 'grey.200',
                          }}
                        >
                          {m.type === 'video' ? (
                            <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: 'black' }}>
                              <video
                                src={m.url}
                                preload="metadata"
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <Box sx={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: 'rgba(0,0,0,0.3)',
                              }}>
                                <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 28 }} />
                              </Box>
                            </Box>
                          ) : (
                            <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {selectedItem?.is_premium && <Chip label="プレミアム" color="warning" />}
                    {selectedItem && getStatusChip(selectedItem.status)}
                  </Box>
                  <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                    ¥{Number(selectedItem?.start_price || 0).toLocaleString()}〜
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>匹数</Typography>
                  <Typography variant="body1" gutterBottom>{selectedItem?.quantity}匹セット</Typography>
                  {selectedItem?.inspection_info && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>個体情報</Typography>
                      <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.inspection_info}</Typography>
                    </>
                  )}
                  {selectedItem?.individual_info && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>詳細情報</Typography>
                      <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.individual_info}</Typography>
                    </>
                  )}
                  {selectedItem?.auction && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom color="primary.main">オークション</Typography>
                      <Typography variant="body2">{selectedItem.auction.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedItem.auction.event_date} ({getAuctionStatusLabel(selectedItem.auction.status)})
                      </Typography>
                    </>
                  )}
                </Grid>
              </Grid>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDetailClose}>閉じる</Button>
          {selectedItem?.auction && selectedItem.auction.status === 'live' && (
            <Button variant="contained" onClick={() => { handleDetailClose(); navigate(`/participant/auction/${selectedItem.auction!.id}/live`); }}>
              ライブ画面へ
            </Button>
          )}
          {selectedItem?.auction && (
            <Button variant="outlined" onClick={() => { handleDetailClose(); navigate(`/participant/auction/${selectedItem.auction!.id}/items`); }}>
              出品一覧へ
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 画像拡大ライトボックス */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none', m: 1, maxHeight: '98vh' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setLightboxOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
          {(() => {
            const mediaList = getMediaList(selectedItem);
            if (mediaList.length > 1) {
              return (
                <>
                  <IconButton onClick={() => setLightboxIndex((p) => (p - 1 + mediaList.length) % mediaList.length)}
                    sx={{ position: 'absolute', left: 8, color: 'white', zIndex: 2 }}>
                    <ChevronLeftIcon sx={{ fontSize: 40 }} />
                  </IconButton>
                  <IconButton onClick={() => setLightboxIndex((p) => (p + 1) % mediaList.length)}
                    sx={{ position: 'absolute', right: 8, color: 'white', zIndex: 2 }}>
                    <ChevronRightIcon sx={{ fontSize: 40 }} />
                  </IconButton>
                </>
              );
            }
            return null;
          })()}
          {(() => {
            const mediaList = getMediaList(selectedItem);
            const m = mediaList[lightboxIndex];
            if (!m) return null;
            if (m.type === 'video') return <video src={m.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />;
            return <img src={m.url} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />;
          })()}
        </Box>
        <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 1 }}>
          {lightboxIndex + 1} / {getMediaList(selectedItem).length}
        </Typography>
      </Dialog>

      {/* 動画全画面プレビュー */}
      <Dialog
        open={videoDialogOpen}
        onClose={() => setVideoDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none', m: 1, maxHeight: '98vh' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton
            onClick={() => setVideoDialogOpen(false)}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}
          >
            <CloseIcon />
          </IconButton>
          {videoDialogUrl && (
            <video src={videoDialogUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />
          )}
        </Box>
      </Dialog>

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
