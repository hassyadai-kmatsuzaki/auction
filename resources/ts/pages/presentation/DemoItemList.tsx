/**
 * デモ共通出品一覧画面
 * 実際の AuctionItems.tsx と同じデザインを再現
 */
import { useState } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Tabs, Tab, Chip, IconButton, Alert,
  Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ArrowForward as ArrowForwardIcon,
  MeetingRoom as MeetingRoomIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { ItemCard } from '../../features/auction-items/components/ItemCard';
import type { ItemData } from '../../features/auction-items/components/ItemCard';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { MOCK_AUCTIONS, MOCK_ITEMS, MOCK_LANES_LIST, STATUS_CONFIG } from './mockData';

interface DemoItemListProps {
  onGoToWaitingRoom: () => void;
  isGuided?: boolean;
}

export function DemoItemList({ onGoToWaitingRoom, isGuided = false }: DemoItemListProps) {
  const [selectedLane, setSelectedLane] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

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

  const handleFavoriteToggle = (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Guide tooltip */}
      {isGuided && (
        <Alert severity="info" icon={<ArrowForwardIcon />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold">ガイド付きデモ: ステップ 2/5</Typography>
          <Typography variant="body2">
            出品されている商品を確認できます。確認したら「待機室へ」ボタンでオークション会場へ進みます。
          </Typography>
        </Alert>
      )}

      {/* ヘッダー — 実際の AuctionItems.tsx と同じ */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">{MOCK_AUCTIONS[0].title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {statusFilter.length > 0 ? `${currentItems.length}件表示 / 全${totalItems}点` : `全${totalItems}点の出品`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button size="small" variant="outlined" color="primary"
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

      {/* レーンタブ */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedLane} onChange={(_, v) => setSelectedLane(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`すべて (${totalItems})`} />
          {MOCK_LANES_LIST.map((lane, i) => (
            <Tab key={i} label={`${lane.lane_name} (${lane.items.length})`} />
          ))}
        </Tabs>
      </Paper>

      {/* ステータスフィルター — 実際と同じ */}
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
          const isActive = isAll ? statusFilter.length === 0 : statusFilter.includes(key);
          return (
            <Chip key={key} label={label} size="small"
              color={isActive ? color : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
              onClick={() => {
                if (isAll) setStatusFilter([]);
                else setStatusFilter(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
              }}
              sx={{ cursor: 'pointer', fontWeight: isActive ? 600 : 400 }}
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
                <ItemCard
                  item={mapItem(item)}
                  isFavorited={favoriteIds.has(item.id)}
                  onClick={() => {}}
                  onFavoriteToggle={(e) => handleFavoriteToggle(e, item.id)}
                />
                {/* 指値バッジ（カード下部に独立して配置）— 実際と同じ */}
                <Box sx={{
                  px: 1.5, py: 1,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderTop: 'none',
                  borderColor: 'divider',
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                }}>
                  <BidLimitBadge
                    limitPrice={null}
                    isTriggered={false}
                    onEdit={() => {}}
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
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }}>
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
                      <BidLimitBadge limitPrice={null} isTriggered={false} onEdit={() => {}} />
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
    </Container>
  );
}
