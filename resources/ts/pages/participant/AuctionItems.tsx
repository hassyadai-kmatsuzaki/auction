import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Grid, Card, CardMedia, CardContent,
  Chip, Paper, Tabs, Tab, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, IconButton, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon, ViewList as ViewListIcon,
  Close as CloseIcon, Info as InfoIcon, ArrowBack as ArrowBackIcon,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  FavoriteBorder as FavoriteBorderIcon, Favorite as FavoriteIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { ItemCard } from '../../features/auction-items/components/ItemCard';
import type { ItemData } from '../../features/auction-items/components/ItemCard';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { bidLimitApi, type BidLimitData } from '../../api/participant/bidLimitApi';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  registered: { label: '出品中', color: 'primary' },
  live:       { label: '入札中', color: 'error'   },
  sold:       { label: '落札済', color: 'success' },
  unsold:     { label: '不成立', color: 'default' },
};

// S3/public URLの解決
const resolveUrl = (url: string, item?: { thumbnail_path?: string; media?: any[] } | null) => {
  if (!url || url.startsWith('http') || url.startsWith('/')) return url;
  const thumb = item?.thumbnail_path;
  if (thumb?.startsWith('http')) {
    const idx = thumb.indexOf('items/');
    if (idx > 0) return thumb.substring(0, idx) + url;
  }
  return url;
};

const buildMediaList = (item: ItemData | null) => {
  if (!item) return [];
  const list: { type: 'image' | 'video'; url: string }[] = [];
  if (item.thumbnail_path) list.push({ type: 'image', url: item.thumbnail_path });
  item.media?.forEach((m: any) => {
    const rawUrl = m.file_url || m.file_path || m.url;
    if (!rawUrl || (m.is_thumbnail && item.thumbnail_path)) return;
    const url = resolveUrl(rawUrl, item);
    if (url === item.thumbnail_path) return;
    const isVideo = m.media_type?.includes('video') || m.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(url);
    list.push({ type: isVideo ? 'video' : 'image', url });
  });
  if (list.length === 0) list.push({ type: 'image', url: '/img/noimage.png' });
  return list;
};

export default function AuctionItems() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate      = useNavigate();

  // ローカルUIState
  const [selectedLane, setSelectedLane]         = useState(0);
  const [viewMode, setViewMode]                 = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter]         = useState<string[]>([]);  // 空配列 = デフォルト
  const [selectedItem, setSelectedItem]         = useState<ItemData | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen]         = useState(false);
  const [lightboxIndex, setLightboxIndex]       = useState(0);
  const [videoDialogUrl, setVideoDialogUrl]     = useState('');
  const [videoDialogOpen, setVideoDialogOpen]   = useState(false);
  const [favoriteIds, setFavoriteIds]           = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  // 指値モーダル
  const [limitModalItem, setLimitModalItem] = useState<ItemData | null>(null);
  const [isSettingLimit, setIsSettingLimit] = useState(false);

  // TanStack Query でデータ取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['auction-items-page', auctionId],
    queryFn: async () => {
      const r = await axios.get(`/api/participant/auctions/${auctionId}/items`);
      return r.data.data;
    },
    staleTime: 30_000,
  });

  const auction    = data?.auction;
  const lanes      = data?.lanes ?? [];
  const totalItems = data?.total_items ?? 0;

  // 全商品IDを算出
  const allItemIds = lanes.flatMap((l: any) => l.items.map((i: any) => i.id)) as number[];

  // 指値を TanStack Query で管理（画面更新しても保持される）
  const { data: limitSettings = {} } = useQuery({
    queryKey: ['bid-limits-batch', auctionId, allItemIds.join(',')],
    queryFn: () => bidLimitApi.getMany(allItemIds),
    enabled: allItemIds.length > 0,
    staleTime: 10_000,
  });

  // お気に入り取得
  useEffect(() => {
    if (!allItemIds.length) return;
    axios.post('/api/participant/favorites/check', { item_ids: allItemIds })
      .then((r) => { if (r.data.success) setFavoriteIds(new Set(r.data.data.favorite_item_ids)); })
      .catch(() => {});
  }, [lanes]);

  const invalidateLimits = () => {
    queryClient.invalidateQueries({ queryKey: ['bid-limits-batch'] });
  };

  const handleSetLimit = async (itemId: number, price: number) => {
    setIsSettingLimit(true);
    try {
      await bidLimitApi.set(itemId, price);
      invalidateLimits();
      setFavoriteIds((prev) => { const next = new Set(prev); next.add(itemId); return next; });
    } catch (err: any) {
      console.error('指値設定エラー:', err);
    } finally {
      setIsSettingLimit(false);
    }
  };

  const handleRemoveLimit = async (itemId: number) => {
    try {
      await bidLimitApi.remove(itemId);
      invalidateLimits();
      setFavoriteIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    } catch (err: any) {
      console.error('指値解除エラー:', err);
    }
  };

  const handleFavoriteToggle = async (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    try {
      const r = await axios.post('/api/participant/favorites/toggle', { item_id: itemId });
      if (r.data.success) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          r.data.is_favorited ? next.add(itemId) : next.delete(itemId);
          return next;
        });
      }
    } catch {}
  };

  // ステータスフィルターのデフォルト値（開催中は入札中+出品中のみ）
  const isLiveAuction = auction?.status === 'live';
  const defaultStatuses = isLiveAuction ? ['registered', 'live'] : [];
  const activeFilter = statusFilter.length > 0 ? statusFilter : defaultStatuses;

  const allLaneItems: ItemData[] = selectedLane === 0
    ? lanes.flatMap((l: any) => l.items)
    : lanes[selectedLane - 1]?.items ?? [];

  // フィルター適用
  const currentItems = activeFilter.length > 0
    ? allLaneItems.filter((item) => activeFilter.includes(item.status))
    : allLaneItems;

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Alert severity="error" sx={{ mb: 2 }}>データの取得に失敗しました。</Alert>
      <Button variant="contained" onClick={() => navigate('/participant')}>ホームに戻る</Button>
    </Container>
  );

  const mediaList = buildMediaList(selectedItem);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/participant')}><ArrowBackIcon /></IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">{auction?.title || '出品一覧'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {activeFilter.length > 0 ? `${currentItems.length}件表示 / 全${totalItems}点` : `全${totalItems}点の出品`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {isLiveAuction && (
              <Button size="small" variant="contained" color="success"
                onClick={() => navigate(`/participant/auction/${auctionId}/live`)}
                sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                会場へ
              </Button>
            )}
            <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}><ViewModuleIcon /></IconButton>
            <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}><ViewListIcon /></IconButton>
          </Box>
        </Box>
      </Paper>

      {/* レーンタブ */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedLane} onChange={(_, v) => setSelectedLane(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`すべて (${totalItems})`} />
          {lanes.map((lane: any, i: number) => (
            <Tab key={i} label={`${lane.lane_name} (${lane.items.length})`} />
          ))}
        </Tabs>
      </Paper>

      {/* ステータスフィルター */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>表示:</Typography>
        {[
          { key: 'all',        label: 'すべて',   color: 'default' as const },
          { key: 'registered', label: '出品中',   color: 'primary' as const },
          { key: 'live',       label: '入札中',   color: 'error'   as const },
          { key: 'sold',       label: '落札済み', color: 'success' as const },
          { key: 'unsold',     label: '不成立',   color: 'default' as const },
        ].map(({ key, label, color }) => {
          const isAll = key === 'all';
          const isActive = isAll
            ? statusFilter.length === 0 && !isLiveAuction  // 非開催中のデフォルト
            : activeFilter.includes(key);
          const isDefault = isAll && statusFilter.length === 0;

          return (
            <Chip
              key={key}
              label={label}
              size="small"
              color={isActive || isDefault ? color : 'default'}
              variant={isActive || isDefault ? 'filled' : 'outlined'}
              onClick={() => {
                if (isAll) {
                  setStatusFilter([]);
                } else {
                  setStatusFilter((prev) => {
                    const current = prev.length > 0 ? prev : defaultStatuses;
                    return current.includes(key)
                      ? current.filter((s) => s !== key)
                      : [...current, key];
                  });
                }
              }}
              sx={{ cursor: 'pointer', fontWeight: isActive || isDefault ? 600 : 400 }}
            />
          );
        })}
      </Box>

      {/* アイテム一覧 */}
      {currentItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">出品がありません</Typography>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {currentItems.map((item) => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ItemCard item={item} isFavorited={favoriteIds.has(item.id)}
                  onClick={() => { setSelectedItem(item); setSelectedMediaIndex(0); }}
                  onFavoriteToggle={(e) => handleFavoriteToggle(e, item.id)} />
                {/* 指値バッジ（カード下部に独立して配置・重ならない） */}
                <Box
                  sx={{
                    px: 1.5, py: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderTop: 'none',
                    borderColor: 'divider',
                    borderBottomLeftRadius: 2,
                    borderBottomRightRadius: 2,
                  }}
                >
                  <BidLimitBadge
                    limitPrice={limitSettings[item.id]?.limit_price ?? null}
                    isTriggered={limitSettings[item.id]?.is_triggered ?? false}
                    onEdit={() => setLimitModalItem(item)}
                    onRemove={() => handleRemoveLimit(item.id)}
                  />
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ '& th, & td': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>No.</TableCell>
                <TableCell>品種名</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>匹数</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>開始価格</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>ステータス</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>上限価格</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentItems.map((item) => {
                const s = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };
                const limit = limitSettings[item.id];
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedItem(item); setSelectedMediaIndex(0); }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.item_number}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.species_name}
                        {item.is_premium && <Chip label="プレミアム" color="warning" size="small" />}
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.quantity}匹</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>¥{Number(item.start_price).toLocaleString()}</TableCell>
                    <TableCell align="center"><Chip label={s.label} color={s.color} size="small" /></TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <BidLimitBadge
                        limitPrice={limit?.limit_price ?? null}
                        isTriggered={limit?.is_triggered ?? false}
                        onEdit={(e?: any) => { e?.stopPropagation?.(); setLimitModalItem(item); }}
                        onRemove={() => handleRemoveLimit(item.id)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" onClick={(e) => handleFavoriteToggle(e, item.id)}>
                          {favoriteIds.has(item.id)
                            ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 18 }} />
                            : <FavoriteBorderIcon sx={{ color: 'grey.500', fontSize: 18 }} />}
                        </IconButton>
                        <IconButton size="small" color="primary"><InfoIcon /></IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 詳細ダイアログ */}
      <Dialog open={!!selectedItem} onClose={() => setSelectedItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">No.{selectedItem?.item_number} {selectedItem?.species_name}</Typography>
            <IconButton onClick={() => setSelectedItem(null)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                {mediaList[selectedMediaIndex]?.type === 'video' ? (
                  <video src={mediaList[selectedMediaIndex].url} controls style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }} />
                ) : (
                  <img src={mediaList[selectedMediaIndex]?.url || '/img/noimage.png'} alt={selectedItem?.species_name}
                    style={{ width: '100%', maxHeight: 400, objectFit: 'contain', cursor: 'pointer', display: 'block' }}
                    onClick={() => { setLightboxIndex(selectedMediaIndex); setLightboxOpen(true); }} />
                )}
              </Box>
              {mediaList.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                  {mediaList.map((m, i) => (
                    <Box key={i} onClick={() => { if (m.type === 'video') { setVideoDialogUrl(m.url); setVideoDialogOpen(true); } else setSelectedMediaIndex(i); }}
                      sx={{ width: 64, height: 64, flexShrink: 0, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                        border: i === selectedMediaIndex ? '2px solid' : '2px solid transparent',
                        borderColor: i === selectedMediaIndex ? 'primary.main' : 'transparent', bgcolor: 'grey.200', position: 'relative' }}>
                      {m.type === 'video' ? (
                        <Box sx={{ width: '100%', height: '100%', bgcolor: 'black', position: 'relative' }}>
                          <video src={m.url} preload="metadata" muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
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
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {selectedItem?.is_premium && <Chip label="プレミアム" color="warning" />}
                {selectedItem && (() => { const s = STATUS_CONFIG[selectedItem.status] ?? { label: selectedItem.status, color: 'default' as const }; return <Chip label={s.label} color={s.color} />; })()}
              </Box>
              <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                ¥{Number(selectedItem?.start_price || 0).toLocaleString()}〜
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>匹数</Typography>
              <Typography variant="body1" gutterBottom>{selectedItem?.quantity}匹セット</Typography>
              {selectedItem?.inspection_info && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2, color: 'primary.main' }} gutterBottom>個体情報</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.inspection_info}</Typography>
                </>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedItem(null)}>閉じる</Button>
          {auction?.status === 'live' && (
            <Button variant="contained" onClick={() => { setSelectedItem(null); navigate(`/participant/auctions/${auctionId}/live`); }}>
              ライブ画面へ
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ライトボックス */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', m: 1, maxHeight: '98vh' } }}>
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setLightboxOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}><CloseIcon /></IconButton>
          {mediaList.length > 1 && (
            <>
              <IconButton onClick={() => setLightboxIndex((p) => (p - 1 + mediaList.length) % mediaList.length)} sx={{ position: 'absolute', left: 8, color: 'white', zIndex: 2 }}>
                <ChevronLeftIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <IconButton onClick={() => setLightboxIndex((p) => (p + 1) % mediaList.length)} sx={{ position: 'absolute', right: 8, color: 'white', zIndex: 2 }}>
                <ChevronRightIcon sx={{ fontSize: 40 }} />
              </IconButton>
            </>
          )}
          {(() => { const m = mediaList[lightboxIndex]; if (!m) return null; return m.type === 'video' ? <video src={m.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} /> : <img src={m.url} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />; })()}
        </Box>
        <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 1 }}>{lightboxIndex + 1} / {mediaList.length}</Typography>
      </Dialog>

      {/* 動画全画面 */}
      <Dialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', m: 1 } }}>
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setVideoDialogOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}><CloseIcon /></IconButton>
          {videoDialogUrl && <video src={videoDialogUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />}
        </Box>
      </Dialog>

      {/* 指値（上限価格）設定モーダル（開始前） */}
      {limitModalItem && (
        <BidLimitModal
          open={!!limitModalItem}
          onClose={() => setLimitModalItem(null)}
          itemId={limitModalItem.id}
          speciesName={limitModalItem.species_name}
          currentLimitPrice={limitSettings[limitModalItem.id]?.limit_price ?? null}
          currentPrice={limitModalItem.start_price}
          quickOptions={null}
          isLive={false}
          isSetting={isSettingLimit}
          onSet={(price) => {
            handleSetLimit(limitModalItem.id, price);
            setLimitModalItem(null);
          }}
          onRemove={() => {
            handleRemoveLimit(limitModalItem.id);
            setLimitModalItem(null);
          }}
        />
      )}
    </Container>
  );
}
