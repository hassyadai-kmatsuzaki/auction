/**
 * デモ共通出品一覧画面
 * 実際の AuctionItems.tsx と同じデザインを再現
 */
import { useState } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Tabs, Tab, Chip, IconButton,
  Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  MeetingRoom as MeetingRoomIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { ItemCard } from '../../features/auction-items/components/ItemCard';
import type { ItemData } from '../../features/auction-items/components/ItemCard';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { MOCK_AUCTIONS, MOCK_ITEMS, MOCK_LANES_LIST, STATUS_CONFIG } from './mockData';

interface DemoItemListProps {
  onGoToWaitingRoom: () => void;
  onFavoriteAdded?: () => void;
  onLimitSetCallback?: () => void;
  onItemDetailOpened?: () => void;
  onItemDetailClosed?: () => void;
  /** ガイド中に有効にする操作を限定（未指定時は全操作可能） */
  activeOnly?: 'info' | 'favorite' | 'limit';
  /** 共有: お気に入りID (親から渡された場合はローカル状態を使わない) */
  favoriteIds?: Set<number>;
  onFavoriteToggle?: (itemId: number) => void;
  /** 共有: 指値設定 (親から渡された場合はローカル状態を使わない) */
  limitSettings?: Record<number, { limit_price: number | null; is_triggered: boolean }>;
  onLimitSet?: (itemId: number, price: number) => void;
  onLimitRemove?: (itemId: number) => void;
}

export function DemoItemList({ onGoToWaitingRoom, onFavoriteAdded, onLimitSetCallback, onItemDetailOpened, onItemDetailClosed, activeOnly, favoriteIds: externalFavoriteIds, onFavoriteToggle, limitSettings: externalLimitSettings, onLimitSet, onLimitRemove }: DemoItemListProps) {
  const [selectedLane, setSelectedLane] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter] = useState<string[]>([]);
  // ローカル状態は外部 props がない場合のフォールバック（ガイド付きデモ用）
  const [localFavoriteIds, setLocalFavoriteIds] = useState<Set<number>>(new Set());
  const [localLimitSettings, setLocalLimitSettings] = useState<Record<number, { limit_price: number | null; is_triggered: boolean }>>({});
  const favoriteIds = externalFavoriteIds ?? localFavoriteIds;
  const limitSettings = externalLimitSettings ?? localLimitSettings;
  const [limitModalItem, setLimitModalItem] = useState<{ id: number; species_name: string; start_price: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<typeof MOCK_ITEMS[0] | null>(null);

  const totalItems = MOCK_ITEMS.length;

  const allLaneItems = selectedLane === 0
    ? MOCK_LANES_LIST.flatMap((l) => l.items)
    : MOCK_LANES_LIST[selectedLane - 1]?.items ?? [];

  const mapItem = (item: typeof MOCK_ITEMS[0]): ItemData => ({
    id: item.id,
    item_number: item.item_number,
    species_name: item.species_name,
    quantity: item.quantity,
    start_price: item.start_price,
    current_price: item.current_price,
    status: item.status,
    is_premium: item.is_premium,
    thumbnail_path: item.thumbnail_path,
    inspection_info: item.inspection_info,
  });

  const currentItems = statusFilter.length > 0
    ? allLaneItems.filter((item) => statusFilter.includes(item.status))
    : allLaneItems;

  const getLimitForItem = (itemId: number) => limitSettings[itemId] ?? { limit_price: null, is_triggered: false };

  const handleLimitEdit = (item: typeof MOCK_ITEMS[0]) => {
    setLimitModalItem({ id: item.id, species_name: item.species_name, start_price: item.start_price });
  };

  const handleLimitRemove = (itemId: number) => {
    if (onLimitRemove) { onLimitRemove(itemId); return; }
    setLocalLimitSettings(prev => { const next = { ...prev }; delete next[itemId]; return next; });
  };

  const handleSetLimit = (price: number) => {
    if (!limitModalItem) return;
    if (onLimitSet) { onLimitSet(limitModalItem.id, price); }
    else { setLocalLimitSettings(prev => ({ ...prev, [limitModalItem.id]: { limit_price: price, is_triggered: false } })); }
    setLimitModalItem(null);
    onLimitSetCallback?.();
  };

  const handleRemoveLimitModal = () => {
    if (!limitModalItem) return;
    handleLimitRemove(limitModalItem.id);
    setLimitModalItem(null);
  };

  const handleFavoriteToggle = (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    if (onFavoriteToggle) { onFavoriteToggle(itemId); return; }
    setLocalFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); onFavoriteAdded?.(); }
      return next;
    });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー — 実際の AuctionItems.tsx と同じ */}
      <Paper data-tour-target="items-header" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">{MOCK_AUCTIONS[0].title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {statusFilter.length > 0 ? `${currentItems.length}件表示 / 全${totalItems}点` : `全${totalItems}点の出品`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button data-tour-target="items-waiting-button" size="small" variant="outlined" color="primary"
              startIcon={<MeetingRoomIcon />}
              onClick={onGoToWaitingRoom}
              sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              待機室へ
            </Button>
            <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}><ViewModuleIcon /></IconButton>
            <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}><ViewListIcon /></IconButton>
          </Box>
        </Box>
      </Paper>

      {/* レーンタブ + ステータスフィルター */}
      <Box data-tour-target="items-filter-area">
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedLane} onChange={(_, v) => setSelectedLane(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`すべて (${totalItems})`} />
          {MOCK_LANES_LIST.map((lane, i) => (
            <Tab key={i} label={`${lane.lane_name} (${lane.items.length})`} />
          ))}
        </Tabs>
      </Paper>

      </Box>{/* /items-filter-area */}

      {/* アイテム一覧 */}
      {currentItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">出品がありません</Typography>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {currentItems.map((item, idx) => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Box data-tour-target={idx === 0 ? 'items-first-card' : undefined} sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                <ItemCard
                  item={mapItem(item)}
                  isFavorited={favoriteIds.has(item.id)}
                  onFavoriteToggle={(e) => { if (activeOnly && activeOnly !== 'favorite') return; handleFavoriteToggle(e, item.id); }}
                  onInfoClick={(e) => { if (activeOnly && activeOnly !== 'info') return; e.stopPropagation(); setSelectedItem(item); onItemDetailOpened?.(); }}
                  favoriteButtonTourTarget={idx === 0 ? 'items-first-favorite' : undefined}
                  disableFavorite={!!activeOnly && activeOnly !== 'favorite'}
                  disableInfo={!!activeOnly && activeOnly !== 'info'}
                  hideStatus
                />
                {/* 指値バッジ（カード下部に独立して配置）— 実際と同じ */}
                <Box data-tour-target={idx === 0 ? 'items-first-limit' : undefined} sx={{
                  px: 1.5, py: 1,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderTop: 'none',
                  borderColor: 'divider',
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                  ...(activeOnly && activeOnly !== 'limit' && { pointerEvents: 'none', cursor: 'default' }),
                }}>
                  <BidLimitBadge
                    limitPrice={getLimitForItem(item.id).limit_price}
                    isTriggered={getLimitForItem(item.id).is_triggered}
                    onEdit={() => handleLimitEdit(item)}
                    onRemove={() => handleLimitRemove(item.id)}
                  />
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        /* リストビュー — 実際の AuctionItems.tsx と同じTable実装 */
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
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedItem(item)}>
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
                        limitPrice={getLimitForItem(item.id).limit_price}
                        isTriggered={getLimitForItem(item.id).is_triggered}
                        onEdit={() => handleLimitEdit(item)}
                        onRemove={() => handleLimitRemove(item.id)}
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
      {/* Item Detail Dialog */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onClose={() => { setSelectedItem(null); onItemDetailClosed?.(); }} maxWidth="sm" fullWidth sx={{ zIndex: 1500 }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              {selectedItem.species_name}
              <Typography variant="body2" color="text.secondary">No.{selectedItem.item_number}</Typography>
            </Box>
            <IconButton onClick={() => { setSelectedItem(null); onItemDetailClosed?.(); }} size="small"><CloseIcon /></IconButton>
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
          onRemove={handleRemoveLimitModal}
          zIndex={1500}
        />
      )}
    </Container>
  );
}
