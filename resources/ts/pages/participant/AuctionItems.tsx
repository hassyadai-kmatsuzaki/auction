import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Grid, Chip, Paper, Tabs, Tab,
  Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon, ViewList as ViewListIcon,
  Info as InfoIcon, ArrowBack as ArrowBackIcon,
  FavoriteBorder as FavoriteBorderIcon, Favorite as FavoriteIcon,
  MeetingRoom as MeetingRoomIcon, ListAlt as ListAltIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { trackEvent } from '../../lib/track';
import { formatYen } from '../../lib/formatPrice';
import { ItemCard } from '../../features/auction-items/components/ItemCard';
import type { ItemData } from '../../features/auction-items/components/ItemCard';
import { ItemDetailDialog } from '../../features/auction-live/components/ItemDetailDialog';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { BulkBidPanel } from '../../features/bid-limit/components/BulkBidPanel';
import type { BulkBidPanelItem, BulkBidSubmit } from '../../features/bid-limit/components/BulkBidPanel';
import { bidLimitApi } from '../../api/participant/bidLimitApi';
import { bulkBidLimitApi } from '../../api/participant/bulkBidLimitApi';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { LaneItem } from '../../types';
import { features } from '../../lib/features';
import ItemSearchBar, { EMPTY_CONDITIONS, type ItemSearchConditions } from '../../features/auction-items/components/ItemSearchBar';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  registered: { label: '出品中', color: 'primary' },
  live:       { label: '入札中', color: 'error'   },
  sold:       { label: '落札済', color: 'success' },
  unsold:     { label: '不成立', color: 'default' },
};

// ItemData → ItemDetailDialog が要求する LaneItem 形式に変換
const toLaneItem = (item: ItemData | null): LaneItem | null => {
  if (!item) return null;
  return {
    id: item.id,
    item_number: item.item_number,
    exhibit_code: (item as any).exhibit_code ?? null,
    species_name: item.species_name,
    current_price: item.current_price ?? item.start_price,
    quantity: item.quantity,
    quantity_unit: 'fish',
    active_bidders_count: 0,
    countdown_seconds: 0,
    my_bid_status: null,
    is_premium: item.is_premium,
    is_anonymous: (item as any).is_anonymous ?? false,
    thumbnail_path: item.thumbnail_path ?? '/img/noimage.png',
    phase: 'bidding',
    pre_bid_remaining_seconds: 0,
    freeze_remaining_seconds: 0,
    freeze_countdown_seconds: 0,
    my_limit_price: null,
    my_limit_triggered: false,
    seller_name: item.seller_name ?? (item as any).seller?.seller_name ?? '',
    seller_profile_image_url: item.seller_profile_image_url ?? (item as any).seller?.profile_image_url ?? null,
    media: item.media as LaneItem['media'],
    inspection_info: item.inspection_info,
  } as LaneItem;
};

/**
 * 出品一覧。表示スイッチ bulk_bid_limit が ON かつ開催前は「開始価格でまとめて事前入札」（v7）が使える:
 *   - 入口はヘッダーの緑ボタン（スマホは一覧の上の緑ボタン）→ この回の全品がチェック済みで中央のウィンドウが開く
 *   - ウィンドウ内は開始価格ごとのグループ。グループの − ◯円 ＋ でまとめて、開いて品ごとにも上げ下げ
 *   - 一覧のカードにはチェックを出さない（選ぶのはウィンドウの中だけ。お気に入り♡はそのまま）
 *   - カードの「上限設定」も同じウィンドウを1点だけで開く（事前入札 UI を1つに統合）
 *   - 入札済みの品はチェック外で表示し、チェックを入れ直したときだけ上書き（既存指値の事故防止）
 */
export default function AuctionItems() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate      = useNavigate();
  const { showSuccess, showWarning } = useSnackbar();

  // ローカルUIState
  const [selectedLane, setSelectedLane]     = useState(0);
  const [viewMode, setViewMode]             = useState<'grid' | 'list'>('grid');
  const [selectedItem, setSelectedItem]     = useState<ItemData | null>(null);
  const [favoriteIds, setFavoriteIds]       = useState<Set<number>>(new Set());
  const [sellerFilter, setSellerFilter]     = useState<string>('all');
  const [limitFilter, setLimitFilter]       = useState<'all' | 'bid' | 'unbid'>('all');
  // 検索・絞り込み（F-042/F-043）。表示スイッチ OFF の間は常に空条件＝従来どおり
  const [search, setSearch]                 = useState<ItemSearchConditions>(EMPTY_CONDITIONS);
  // カテゴリ＝品種名マスタ（F-013）。'all' はすべて、'other' はマスタに無い品種名
  const [category, setCategory]             = useState<string>('all');
  const { data: masterNames = [] } = useQuery<string[]>({
    queryKey: ['species-categories'],
    queryFn: async () => (await axios.get('/api/participant/species-categories', { silent: true })).data.data,
    enabled: features.itemCategory,
    staleTime: 10 * 60_000,
  });

  const queryClient = useQueryClient();
  // 指値モーダル（表示スイッチ OFF、または対象外の品のとき従来のモーダル）
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

  const itemIdsForFavoritesKey = useMemo(() => {
    const ids = lanes.flatMap((l: any) => l.items.map((i: any) => i.id)) as number[];
    return [...new Set(ids)].sort((a, b) => a - b).join(',');
  }, [lanes]);

  // 指値を TanStack Query で管理（画面更新しても保持される）
  const { data: limitSettings = {} } = useQuery({
    queryKey: ['bid-limits-batch', auctionId, allItemIds.join(',')],
    queryFn: () => bidLimitApi.getMany(allItemIds),
    enabled: allItemIds.length > 0,
    staleTime: 10_000,
  });

  // まとめて入札（表示スイッチ ON かつ開催前）: 対象生体と入札単位・現在の指値
  const bulkEnabled = features.bulkBidLimit && auction?.status === 'scheduled';
  const { data: bulkData } = useQuery({
    queryKey: ['bulk-bid-limits', auctionId],
    queryFn: () => bulkBidLimitApi.get(auctionId!),
    enabled: bulkEnabled && !!auctionId,
  });
  const bulkInfo = useMemo(() => new Map((bulkData?.items ?? []).map((i) => [i.id, i])), [bulkData]);
  const bulkOpen = bulkData?.is_open ?? false;

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelItems, setPanelItems] = useState<BulkBidPanelItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [doneBanner, setDoneBanner] = useState<string | null>(null);

  // 計測: 生体詳細を開いたとき（item_view）。サーバ側で開始前(preparing/scheduled)のみ・
  // 1ユーザー1日×item 1行に絞る。ライブ中は記録されない。
  useEffect(() => {
    if (selectedItem) trackEvent('item_view', { item_id: selectedItem.id });
  }, [selectedItem]);

  // お気に入り取得（商品ID集合が変わったときのみ）
  useEffect(() => {
    if (!itemIdsForFavoritesKey) return;
    const itemIds = itemIdsForFavoritesKey.split(',').map(Number);
    axios.post('/api/participant/favorites/check', { item_ids: itemIds })
      .then((r) => { if (r.data.success) setFavoriteIds(new Set(r.data.data.favorite_item_ids)); })
      .catch(() => {});
  }, [itemIdsForFavoritesKey]);

  const invalidateLimits = () => {
    queryClient.invalidateQueries({ queryKey: ['bid-limits-batch'] });
    queryClient.invalidateQueries({ queryKey: ['bulk-bid-limits', auctionId] });
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

  const isLiveAuction = auction?.status === 'live';

  const laneFilteredItems: ItemData[] = selectedLane === 0
    ? lanes.flatMap((l: any) => l.items)
    : lanes[selectedLane - 1]?.items ?? [];

  // 選択レーンの生産者ユニークリスト（フィルタ候補）
  // 匿名出品は生産者フィルタの候補から除外する
  const sellerOptions: string[] = Array.from(
    new Set(
      laneFilteredItems
        .filter((i) => !i.is_anonymous)
        .map((i) => i.seller_name)
        .filter((s): s is string => !!s && s.length > 0)
    )
  ).sort();

  // カテゴリ候補: マスタの並び順のうち、このレーンに出品がある名前だけ（F-013）
  const masterSet = new Set(masterNames);
  const categoryOptions = features.itemCategory
    ? [
        ...masterNames.map((n) => ({ key: n, label: n, count: laneFilteredItems.filter((i) => i.species_name === n).length })).filter((c) => c.count > 0),
        ...(() => { const c = laneFilteredItems.filter((i) => !masterSet.has(i.species_name)).length; return c > 0 ? [{ key: 'other', label: 'その他', count: c }] : []; })(),
      ]
    : [];
  const categoryFilteredItems: ItemData[] = !features.itemCategory || category === 'all'
    ? laneFilteredItems
    : laneFilteredItems.filter((i) => (category === 'other' ? !masterSet.has(i.species_name) : i.species_name === category));

  const sellerFilteredItems: ItemData[] = (sellerFilter === 'all'
    ? categoryFilteredItems
    : categoryFilteredItems.filter((i) => i.seller_name === sellerFilter));

  const hasOwnLimit = (id: number) => limitSettings[id]?.limit_price != null;
  const limitFilteredItems: ItemData[] = limitFilter === 'all'
    ? sellerFilteredItems
    : sellerFilteredItems.filter((i) => (limitFilter === 'bid' ? hasOwnLimit(i.id) : !hasOwnLimit(i.id)));

  const currentItems: ItemData[] = useMemo(() => {
    if (!features.itemSearch) return limitFilteredItems;
    const keyword = search.keyword.trim().toLowerCase();
    const [min, max] = search.price === 'all' ? [null, null] : search.price.split('-').map((v) => (v === '' ? null : Number(v)));
    const filtered = limitFilteredItems.filter((i) =>
      (!keyword || i.species_name.toLowerCase().includes(keyword))
      && (min === null || Number(i.start_price) >= min)
      && (max === null || Number(i.start_price) <= max));
    const byPopular = (i: ItemData) => Number((i as ItemData & { favorites_count?: number }).favorites_count ?? 0);
    if (search.sort === 'popular') return [...filtered].sort((a, b) => byPopular(b) - byPopular(a));
    if (search.sort === 'price_asc') return [...filtered].sort((a, b) => Number(a.start_price) - Number(b.start_price));
    if (search.sort === 'price_desc') return [...filtered].sort((a, b) => Number(b.start_price) - Number(a.start_price));
    return filtered;
  }, [limitFilteredItems, search]);

  // ── まとめて入札 ──
  const toPanelItem = (item: ItemData): BulkBidPanelItem | null => {
    const info = bulkInfo.get(item.id);
    if (!info) return null;
    return {
      id: item.id,
      name: item.species_name,
      code: (item as any).exhibit_code ?? `No.${item.item_number}`,
      quantity: item.quantity,
      seller_name: item.seller_name ?? (item as any).seller?.seller_name ?? null,
      seller_profile_image_url: item.seller_profile_image_url ?? (item as any).seller?.profile_image_url ?? null,
      is_anonymous: (item as any).is_anonymous ?? false,
      start_price: info.start_price,
      unit: info.unit,
      limit_price: limitSettings[item.id]?.limit_price ?? info.limit_price ?? null,
      is_other: info.is_other,
    };
  };
  // この回でまとめて入札できる品（レーン・絞り込みに関係なく全部。自分の出品・落札済などは bulkInfo に無い）
  const allBulkItems = (lanes.flatMap((l: any) => l.items) as ItemData[]).map(toPanelItem).filter((x): x is BulkBidPanelItem => !!x);
  const bulkCount = allBulkItems.filter((x) => !x.is_other).length;
  const limitCountAll = laneFilteredItems.filter((i) => hasOwnLimit(i.id)).length;
  const singlePanel = panelOpen && panelItems.length === 1;

  const openBulkPanel = () => {
    setDoneBanner(null);
    setPanelItems(allBulkItems);
    // 入札済みの品はチェック外（そのまま）。入れ直したときだけ上書きする
    setCheckedIds(new Set(allBulkItems.filter((x) => !x.is_other && x.limit_price == null).map((x) => x.id)));
    setPanelOpen(true);
  };

  // 「上限設定」: まとめて入札が使えるときは同じパネルを1点で開く。それ以外は従来のモーダル
  const openLimitEditor = (item: ItemData) => {
    // まとめて入札の受付（開始の N 分前まで）が閉じたら、1点ずつは従来のモーダルで開始まで受け付ける
    const row = bulkEnabled && bulkOpen ? toPanelItem(item) : null;
    if (row && !row.is_other) {
      setDoneBanner(null);
      setPanelItems([row]);
      setCheckedIds(new Set([row.id]));
      setPanelOpen(true);
    } else {
      setLimitModalItem(item);
    }
  };

  const handlePanelSubmit = async ({ limits, priceLabel }: BulkBidSubmit) => {
    setBulkSubmitting(true);
    try {
      const res = await bulkBidLimitApi.store(auctionId!, limits);
      if (res.success) {
        const n = limits.length;
        setDoneBanner(singlePanel
          ? `${panelItems[0]?.name} を ¥${formatYen(limits[0].limit_price)} で事前入札しました。`
          : `${n}点を${priceLabel}で入札しました。`);
        setPanelOpen(false);
        setCheckedIds(new Set());
      } else {
        showWarning(res.message);
      }
      invalidateLimits();
      // 一括はお気に入りに自動登録しない（11/9 フィードバック）
    } catch {
      // 失敗の文言は axios の共通処理が表示する
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handlePanelRemove = async (itemId: number) => {
    await handleRemoveLimit(itemId);
    setPanelOpen(false);
    showSuccess('事前入札を取り消しました。');
  };

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

  const bulkButtonLabel = '開始価格でまとめて事前入札';

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
                全{totalItems}点の出品{bulkEnabled && `・まとめて事前入札は開始${bulkData?.close_minutes ?? 5}分前まで`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {bulkEnabled && (
              <Button variant="contained" color="success" data-testid="bulk-bid-entry" startIcon={<ListAltIcon />}
                onClick={openBulkPanel} disabled={!bulkOpen || bulkCount === 0}
                sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', px: 2.5, py: 1, display: { xs: 'none', sm: 'inline-flex' } }}>
                {bulkButtonLabel}
              </Button>
            )}
            {isLiveAuction && (
              <Button size="small" variant="contained" color="success"
                onClick={() => navigate(`/participant/auction/${auctionId}/live`)}
                sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                会場へ
              </Button>
            )}
            {auction?.status === 'scheduled' && (
              <Button size="small" variant="outlined" color="primary"
                startIcon={<MeetingRoomIcon />}
                onClick={() => navigate(`/participant/auction/${auctionId}/live`)}
                sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                待機室へ
              </Button>
            )}
            <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}><ViewModuleIcon /></IconButton>
            <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}><ViewListIcon /></IconButton>
          </Box>
        </Box>
      </Paper>

      {/* 完了メッセージ */}
      {doneBanner && (
        <Alert severity="success" onClose={() => setDoneBanner(null)} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold">{doneBanner}</Typography>
          <Typography variant="body2">他に入札が無ければ、その品はあなたの落札になります。オークション開始まで変更・取り消しできます。</Typography>
        </Alert>
      )}

      {/* まとめて入札の入口（スマホ: 一覧の上の緑ボタン） */}
      {bulkEnabled && (
        <Button fullWidth variant="contained" color="success" startIcon={<ListAltIcon />} data-testid="bulk-bid-entry-sp"
          onClick={openBulkPanel} disabled={!bulkOpen || bulkCount === 0}
          sx={{ fontWeight: 'bold', py: 1.25, mb: 2, display: { xs: 'inline-flex', sm: 'none' } }}>
          {bulkButtonLabel}
        </Button>
      )}

      {/* レーンタブ */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedLane} onChange={(_, v) => { setSelectedLane(v); setSellerFilter('all'); setCategory('all'); }} variant="scrollable" scrollButtons="auto">
          <Tab label={`すべて (${totalItems})`} />
          {lanes.map((lane: any, i: number) => (
            <Tab key={i} label={`${lane.lane_name} (${lane.items.length})`} />
          ))}
        </Tabs>
      </Paper>

      {/* カテゴリ（品種名マスタ・F-013）。表示スイッチ ON かつ候補があるときだけ */}
      {features.itemCategory && categoryOptions.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>カテゴリ</Typography>
          <Chip
            label={`すべて (${laneFilteredItems.length})`}
            onClick={() => setCategory('all')}
            color={category === 'all' ? 'primary' : 'default'}
            variant={category === 'all' ? 'filled' : 'outlined'}
            size="small"
          />
          {categoryOptions.map((c) => (
            <Chip
              key={c.key}
              label={`${c.label} (${c.count})`}
              onClick={() => setCategory(c.key)}
              color={category === c.key ? 'primary' : 'default'}
              variant={category === c.key ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Box>
      )}

      {/* 生産者フィルタ */}
      {sellerOptions.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: { xs: 150, sm: 220 } }}>
            <InputLabel id="seller-filter-label">生産者で絞り込み</InputLabel>
            <Select
              labelId="seller-filter-label"
              label="生産者で絞り込み"
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value as string)}
            >
              <MenuItem value="all">すべて ({laneFilteredItems.length})</MenuItem>
              {sellerOptions.map((seller) => {
                const count = laneFilteredItems.filter((i) => i.seller_name === seller).length;
                return (
                  <MenuItem key={seller} value={seller}>
                    {seller} ({count})
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          {sellerFilter !== 'all' && (
            <Button size="small" variant="text" onClick={() => setSellerFilter('all')}>
              フィルタを解除
            </Button>
          )}
        </Box>
      )}

      {/* 入札済み／未入札（事前入札がある回だけ） */}
      {bulkEnabled && limitCountAll > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {([
            ['all', 'すべて'],
            ['bid', `入札済み (${limitCountAll})`],
            ['unbid', `未入札 (${laneFilteredItems.length - limitCountAll})`],
          ] as const).map(([key, label]) => (
            <Chip key={key} label={label} size="small"
              onClick={() => setLimitFilter(key)}
              color={limitFilter === key ? 'primary' : 'default'}
              variant={limitFilter === key ? 'filled' : 'outlined'} />
          ))}
        </Box>
      )}

      {/* 検索・絞り込み（F-042/F-043） */}
      {features.itemSearch && <ItemSearchBar value={search} onChange={setSearch} />}

      {/* アイテム一覧 */}
      {currentItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">出品がありません</Typography>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {currentItems.map((item) => {
            return (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ItemCard
                  item={item}
                  isFavorited={favoriteIds.has(item.id)}
                  onFavoriteToggle={(e) => handleFavoriteToggle(e, item.id)}
                  onInfoClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                  hideStatus
                />
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
                    onEdit={() => openLimitEditor(item)}
                    onRemove={() => handleRemoveLimit(item.id)}
                    {...(bulkEnabled && { label: '入札済', color: 'success' as const })}
                  />
                </Box>
              </Box>
            </Grid>
            );
          })}
        </Grid>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ '& th, & td': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>No.</TableCell>
                <TableCell>品種名</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>生産者</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>匹数</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>開始価格</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>ステータス</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{bulkEnabled ? '事前入札' : '上限価格'}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentItems.map((item) => {
                const s = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };
                const limit = limitSettings[item.id];
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedItem(item)}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {(item as any).exhibit_code ?? item.item_number}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.species_name}
                        {item.is_premium && <Chip label="プレミアム" color="warning" size="small" />}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {item.is_anonymous ? '-' : (item.seller_name || '-')}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.quantity}匹</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>¥{formatYen(item.start_price)}</TableCell>
                    <TableCell align="center">
                      {item.status !== 'sold' && item.status !== 'unsold' && (
                        <Chip label={s.label} color={s.color} size="small" />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <BidLimitBadge
                        limitPrice={limit?.limit_price ?? null}
                        isTriggered={limit?.is_triggered ?? false}
                        onEdit={(e?: any) => { e?.stopPropagation?.(); openLimitEditor(item); }}
                        onRemove={() => handleRemoveLimit(item.id)}
                        {...(bulkEnabled && { label: '入札済', color: 'success' as const })}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" onClick={(e) => handleFavoriteToggle(e, item.id)}>
                          {favoriteIds.has(item.id)
                            ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 18 }} />
                            : <FavoriteBorderIcon sx={{ color: 'grey.500', fontSize: 18 }} />}
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                        >
                          <InfoIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 詳細ダイアログ（デモと同じメディアギャラリー） */}
      <ItemDetailDialog
        open={!!selectedItem}
        item={(() => {
          if (!selectedItem) return null;
          const base = toLaneItem(selectedItem);
          if (!base) return null;
          const limit = limitSettings[selectedItem.id];
          return {
            ...base,
            my_limit_price: limit?.limit_price ?? null,
            my_limit_triggered: limit?.is_triggered ?? false,
          } as LaneItem;
        })()}
        onClose={() => setSelectedItem(null)}
        priceLabel="start"
        startPrice={selectedItem?.start_price}
        onLimitEdit={() => {
          if (selectedItem) { setSelectedItem(null); openLimitEditor(selectedItem); }
        }}
        onLimitRemove={() => {
          if (selectedItem) handleRemoveLimit(selectedItem.id);
        }}
        isFavorited={selectedItem ? favoriteIds.has(selectedItem.id) : false}
        onFavoriteToggle={(itemId) => handleFavoriteToggle({ stopPropagation: () => {} } as React.MouseEvent, itemId)}
      />

      {/* まとめて入札パネル（1点モード＝上限設定） */}
      {bulkEnabled && (
        <BulkBidPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          items={panelItems}
          checkedIds={checkedIds}
          onCheckedChange={setCheckedIds}
          isOpen={bulkOpen}
          submitting={bulkSubmitting}
          onSubmit={handlePanelSubmit}
          onRemove={handlePanelRemove}
        />
      )}

      {/* 指値（上限価格）設定モーダル（表示スイッチ OFF・対象外の品） */}
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
