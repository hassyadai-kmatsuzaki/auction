/**
 * /presentation — 認証不要のプレゼンテーション（商談用デモ）ページ
 *
 * API通信は一切行わず、フロントエンドのモックデータのみで動作する。
 * 既存の参加者用コンポーネント（LaneCard, CelebrationOverlay, BidLimitModal 等）を
 * そのまま再利用し、参加者が体験する全機能をタブ切り替えで紹介する。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid, Tabs, Tab,
  Card, CardContent, CardActions, Chip, Avatar, IconButton,
  Alert, Snackbar, AppBar, Toolbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stepper, Step, StepLabel,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  EmojiEvents as TrophyIcon,
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  PlayArrow as PlayArrowIcon,
  Event as EventIcon,
  Star as StarIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Campaign as CampaignIcon,
  LiveTv as LiveTvIcon,
  ShoppingCart as ShoppingCartIcon,
  LocalShipping as LocalShippingIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  MeetingRoom as MeetingRoomIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem, UpcomingItem, Auction } from '@/types';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';

// ====================================================================
// Mock Data
// ====================================================================

const makeLaneItem = (overrides: Partial<LaneItem> & { id: number; species_name: string }): LaneItem => ({
  item_number: overrides.id,
  current_price: 3000,
  quantity: 2,
  quantity_unit: 'fish',
  active_bidders_count: 0,
  countdown_seconds: 15,
  my_bid_status: null,
  is_premium: false,
  thumbnail_path: '/img/noimage.png',
  phase: 'bidding',
  pre_bid_remaining_seconds: 0,
  freeze_remaining_seconds: 0,
  freeze_countdown_seconds: 3,
  my_limit_price: null,
  my_limit_triggered: false,
  seller_name: 'デモ出品者',
  ...overrides,
});

const makeLane = (id: number, num: number, name: string, item: LaneItem): LiveLane => ({
  lane_id: id,
  lane_number: num,
  lane_name: name,
  status: 'active',
  current_item: item,
  upcoming_items: [],
});

const INITIAL_ITEMS: LaneItem[] = [
  makeLaneItem({ id: 1, species_name: '紅白ラメ ペア', current_price: 3000, quantity: 2, seller_name: 'ブリーダーA' }),
  makeLaneItem({ id: 2, species_name: '幹之フルボディ 5匹セット', current_price: 5000, quantity: 5, is_premium: true, seller_name: 'ブリーダーB' }),
  makeLaneItem({ id: 3, species_name: '楊貴妃ダルマ', current_price: 2000, quantity: 1, seller_name: 'ブリーダーC' }),
];

const INITIAL_LANES: LiveLane[] = [
  makeLane(1, 1, 'レーン 1', INITIAL_ITEMS[0]),
  makeLane(2, 2, 'レーン 2', INITIAL_ITEMS[1]),
  makeLane(3, 3, 'レーン 3', INITIAL_ITEMS[2]),
];

const MOCK_UPCOMING: (UpcomingItem & { laneNumber: number })[] = [
  { id: 10, item_number: 4, species_name: '三色ラメ', start_price: 4000, thumbnail_path: '/img/noimage.png', is_premium: false, is_favorited: false, quantity: 3, laneNumber: 1 },
  { id: 11, item_number: 5, species_name: 'オロチ ペア', start_price: 6000, thumbnail_path: '/img/noimage.png', is_premium: true, is_favorited: true, quantity: 2, laneNumber: 2 },
  { id: 12, item_number: 6, species_name: '夜桜ゴールド', start_price: 3500, thumbnail_path: '/img/noimage.png', is_premium: false, is_favorited: false, quantity: 1, laneNumber: 3 },
];

const MOCK_AUCTIONS: Auction[] = [
  { id: 1, title: '2026年春季メダカオークション', event_date: '2026-04-15', start_time: '13:00', status: 'live', lane_count: 3, items_count: 120, total_sold: 45, total_sales: 850000 },
  { id: 2, title: '2026年GWスペシャルオークション', event_date: '2026-05-03', start_time: '10:00', status: 'scheduled', lane_count: 3, items_count: 200, entrance_allowed: true },
  { id: 3, title: '2026年早春オークション', event_date: '2026-03-01', start_time: '13:00', end_time: '17:30', status: 'finished', lane_count: 2, items_count: 80, total_sold: 78, total_sales: 1250000 },
];

interface MockWonEntry {
  id: number;
  species_name: string;
  item_number: number;
  quantity: number;
  winning_price: number;
  total_amount: number;
  payment_status: 'pending' | 'paid';
  delivery_status: 'pending' | 'shipped' | 'completed';
  tracking_number?: string;
}

const MOCK_WON_ITEMS: MockWonEntry[] = [
  { id: 1, species_name: '紅白ラメ ペア', item_number: 12, quantity: 2, winning_price: 8500, total_amount: 18700, payment_status: 'paid', delivery_status: 'shipped', tracking_number: '1234-5678-9012' },
  { id: 2, species_name: '幹之フルボディ 5匹セット', item_number: 28, quantity: 5, winning_price: 12000, total_amount: 66000, payment_status: 'paid', delivery_status: 'completed' },
  { id: 3, species_name: '楊貴妃ダルマ', item_number: 55, quantity: 1, winning_price: 4200, total_amount: 4620, payment_status: 'pending', delivery_status: 'pending' },
];

const MOCK_ITEMS = [
  { id: 1, item_number: 1, species_name: '紅白ラメ ペア', quantity: 2, start_price: 2000, status: 'registered', is_premium: false },
  { id: 2, item_number: 2, species_name: '幹之フルボディ 5匹セット', quantity: 5, start_price: 3000, status: 'registered', is_premium: true },
  { id: 3, item_number: 3, species_name: '楊貴妃ダルマ', quantity: 1, start_price: 1500, status: 'registered', is_premium: false },
  { id: 4, item_number: 4, species_name: '三色ラメ', quantity: 3, start_price: 4000, status: 'registered', is_premium: false },
  { id: 5, item_number: 5, species_name: 'オロチ ペア', quantity: 2, start_price: 6000, status: 'registered', is_premium: true },
  { id: 6, item_number: 6, species_name: '夜桜ゴールド', quantity: 1, start_price: 3500, status: 'registered', is_premium: false },
  { id: 7, item_number: 7, species_name: '煌 (きらめき)', quantity: 3, start_price: 5000, status: 'sold', is_premium: true },
  { id: 8, item_number: 8, species_name: 'サファイア ペア', quantity: 2, start_price: 8000, status: 'sold', is_premium: true },
];

// ====================================================================
// Sub-components
// ====================================================================

/* ─── Tab 0: ホーム ─── */
function HomeTab() {
  return (
    <Box>
      {/* ライブバナー */}
      <Paper sx={{
        background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
        color: 'white', p: 3, borderRadius: 2, mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip label="LIVE" size="small" sx={{ bgcolor: '#ef4444', color: 'white', fontWeight: 700, animation: 'pulse 2s infinite' }} />
          <Typography variant="h5" fontWeight="bold">2026年春季メダカオークション</Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
          現在開催中 | 3レーン同時進行 | 出品数 120点
        </Typography>
        <Button variant="contained" sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, '&:hover': { bgcolor: 'grey.100' } }}>
          オークション会場に入る
        </Button>
      </Paper>

      {/* 次回オークション */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          次回オークション
        </Typography>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">2026年GWスペシャルオークション</Typography>
          <Typography variant="body2" color="text.secondary">2026/05/03 (日) 10:00〜 | 出品数 200点</Typography>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<InventoryIcon />}>出品一覧を見る</Button>
            <Button size="small" variant="outlined" startIcon={<MeetingRoomIcon />}>待機室に入る</Button>
          </Box>
        </Card>
      </Paper>

      {/* お知らせ */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          <CampaignIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          お知らせ
        </Typography>
        {[
          { title: 'GWスペシャルオークション出品受付開始', date: '2026-03-15', important: true },
          { title: 'システムメンテナンスのお知らせ (3/20)', date: '2026-03-10', important: false },
          { title: '春季オークション出品者募集中', date: '2026-03-01', important: false },
        ].map((a, i) => (
          <Card key={i} variant="outlined" sx={{ p: 1.5, mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {a.important && <Chip label="重要" size="small" color="error" />}
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{a.title}</Typography>
              <Typography variant="caption" color="text.secondary">{a.date}</Typography>
            </Box>
          </Card>
        ))}
      </Paper>
    </Box>
  );
}

/* ─── Tab 1: オークション一覧 ─── */
function AuctionListTab() {
  const statusConfig: Record<string, { label: string; color: 'error' | 'info' | 'success' | 'default' }> = {
    live: { label: '開催中', color: 'error' },
    scheduled: { label: '予定', color: 'info' },
    finished: { label: '終了', color: 'success' },
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        <GavelIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        オークション一覧
      </Typography>
      <Grid container spacing={2}>
        {MOCK_AUCTIONS.map(auction => {
          const sc = statusConfig[auction.status] || { label: auction.status, color: 'default' as const };
          return (
            <Grid item xs={12} md={4} key={auction.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip label={sc.label} size="small" color={sc.color} />
                    {auction.status === 'live' && (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444', animation: 'pulse 2s infinite' }} />
                    )}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold">{auction.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    <EventIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {auction.event_date} {auction.start_time}〜
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <InventoryIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    出品数: {auction.items_count}点
                    {auction.total_sold != null && ` | 落札: ${auction.total_sold}点`}
                  </Typography>
                  {auction.total_sales != null && (
                    <Typography variant="body2" color="primary.main" fontWeight="bold" sx={{ mt: 0.5 }}>
                      総売上: ¥{auction.total_sales.toLocaleString()}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  {auction.status === 'live' && (
                    <Button size="small" variant="contained" color="error" startIcon={<PlayArrowIcon />}>
                      参加する
                    </Button>
                  )}
                  {auction.status === 'scheduled' && (
                    <>
                      <Button size="small" variant="outlined" startIcon={<InventoryIcon />}>出品一覧</Button>
                      {auction.entrance_allowed && (
                        <Button size="small" variant="contained" startIcon={<MeetingRoomIcon />}>待機室</Button>
                      )}
                    </>
                  )}
                  {auction.status === 'finished' && (
                    <Button size="small" variant="outlined" startIcon={<CheckCircleIcon />}>結果を見る</Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

/* ─── Tab 2: 出品一覧 ─── */
function ItemListTab() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set([2, 5]));

  const toggleFav = (id: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        出品一覧 — 2026年春季メダカオークション
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        気になる商品にお気に入り登録や指値（上限価格）を事前に設定できます。
      </Alert>
      <Grid container spacing={2}>
        {MOCK_ITEMS.map(item => (
          <Grid item xs={6} sm={4} md={3} key={item.id}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{
                width: '100%', aspectRatio: '4/3', bgcolor: 'grey.100',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}>
                <PetsIcon sx={{ color: 'grey.400', fontSize: 40 }} />
                {item.is_premium && (
                  <Chip icon={<StarIcon />} label="P" size="small" color="warning"
                    sx={{ position: 'absolute', top: 8, right: 8 }} />
                )}
                {item.status === 'sold' && (
                  <Box sx={{
                    position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Chip label="落札済み" color="success" />
                  </Box>
                )}
              </Box>
              <CardContent sx={{ flex: 1, p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">#{item.item_number}</Typography>
                <Typography variant="body2" fontWeight={600} noWrap>{item.species_name}</Typography>
                <Typography variant="body2" color="primary.main" fontWeight="bold">
                  ¥{item.start_price.toLocaleString()}〜
                </Typography>
                <Typography variant="caption" color="text.secondary">{item.quantity}匹</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  <IconButton size="small" onClick={() => toggleFav(item.id)}>
                    {favorites.has(item.id)
                      ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 18 }} />
                      : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 18 }} />}
                  </IconButton>
                  <BidLimitBadge limitPrice={null} isTriggered={false} onEdit={() => {}} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

/* ─── Tab 4: 落札結果 ─── */
function WonItemsTab() {
  const deliverySteps = ['支払い待ち', '発送準備', '配送中', '受取完了'];

  const getStepIndex = (entry: MockWonEntry): number => {
    if (entry.delivery_status === 'completed') return 3;
    if (entry.delivery_status === 'shipped') return 2;
    if (entry.payment_status === 'paid') return 1;
    return 0;
  };

  const total = MOCK_WON_ITEMS.reduce((s, w) => s + w.total_amount, 0);

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        <TrophyIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f59e0b' }} />
        落札結果・配送状況
      </Typography>

      <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Grid container spacing={2} textAlign="center">
          <Grid item xs={4}>
            <Typography variant="h4" fontWeight="bold" color="primary.main">{MOCK_WON_ITEMS.length}</Typography>
            <Typography variant="caption">落札数</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {MOCK_WON_ITEMS.filter(w => w.payment_status === 'paid').length}
            </Typography>
            <Typography variant="caption">支払済み</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              ¥{total.toLocaleString()}
            </Typography>
            <Typography variant="caption">合計金額</Typography>
          </Grid>
        </Grid>
      </Paper>

      {MOCK_WON_ITEMS.map(entry => (
        <Card key={entry.id} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'grey.200', width: 48, height: 48 }}>
                <PetsIcon sx={{ color: 'grey.500' }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  #{entry.item_number} {entry.species_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {entry.quantity}匹 | 落札価格: ¥{entry.winning_price.toLocaleString()}/匹
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold" color="primary.main">
                ¥{entry.total_amount.toLocaleString()}
              </Typography>
            </Box>

            <Stepper activeStep={getStepIndex(entry)} alternativeLabel sx={{ mb: 1 }}>
              {deliverySteps.map(label => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {entry.tracking_number && (
              <Alert severity="info" sx={{ mt: 1 }}>
                追跡番号: {entry.tracking_number}
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

/* ─── Tab 5: 機能紹介 ─── */
function FeaturesTab() {
  const features = [
    { icon: <LiveTvIcon color="primary" />, title: '3レーン同時進行', desc: '複数のレーンで同時にオークションが進行。気になる商品を見逃しません。' },
    { icon: <GavelIcon color="primary" />, title: 'ワンタップ入札', desc: 'ボタン1つで入札ON/OFF。シンプルで直感的な操作。' },
    { icon: <ShoppingCartIcon color="primary" />, title: '指値（上限価格）設定', desc: '事前に上限価格を設定。到達時に自動で入札OFF。予算オーバーを防止。' },
    { icon: <FavoriteIcon color="primary" />, title: 'お気に入り登録', desc: '気になる商品をお気に入りに追加。オークション開始前にチェックリストを作成。' },
    { icon: <PaymentIcon color="primary" />, title: 'かんたん決済', desc: '落札後の支払いと配送手続きをアプリ内で完結。' },
    { icon: <LocalShippingIcon color="primary" />, title: '配送追跡', desc: 'ヤマト・佐川・日本郵便の追跡番号でリアルタイムに配送状況を確認。' },
    { icon: <CampaignIcon color="primary" />, title: 'お知らせ通知', desc: '新規オークション・落札結果をメールやLINEで受信。' },
    { icon: <SettingsIcon color="primary" />, title: 'プロフィール管理', desc: '住所・連絡先・通知設定をいつでも変更可能。' },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>主な機能</Typography>
      <Grid container spacing={2}>
        {features.map((f, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Paper sx={{ p: 2.5, height: '100%', textAlign: 'center' }}>
              <Box sx={{ mb: 1 }}>{f.icon}</Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{f.title}</Typography>
              <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>オークションの流れ</Typography>
        <Stepper activeStep={-1} orientation="vertical">
          {[
            { label: '会員登録', desc: 'メールアドレスで簡単登録。承認後すぐに利用可能。' },
            { label: '出品一覧を確認', desc: '開催前に出品される生体をチェック。お気に入り・指値を事前設定。' },
            { label: '待機室に入室', desc: '開催時間前に待機室が開放。ルール確認と入室準備。' },
            { label: 'リアルタイム入札', desc: '3レーン同時進行でテンポよく入札。フリーズ機能で誤タップ防止。' },
            { label: '落札・決済', desc: '落札した商品の支払いと配送先を確認。' },
            { label: '受取・完了', desc: '追跡番号で配送状況をリアルタイム確認。' },
          ].map((s, i) => (
            <Step key={i} active>
              <StepLabel>
                <Typography fontWeight="bold">{s.label}</Typography>
              </StepLabel>
              <Box sx={{ pl: 4, pb: 2 }}>
                <Typography variant="body2" color="text.secondary">{s.desc}</Typography>
              </Box>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Box>
  );
}

// ====================================================================
// Main Presentation Component
// ====================================================================

export default function Presentation() {
  const [tabIndex, setTabIndex] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });

  // ─── Live demo state (Tab 3) ───
  const [lanes, setLanes] = useState<LiveLane[]>(JSON.parse(JSON.stringify(INITIAL_LANES)));
  const [upcoming, setUpcoming] = useState(MOCK_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<{ species_name: string; winning_price: number; quantity: number; total_amount: number }[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const notify = useCallback((message: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const updateLaneItem = useCallback((laneId: number, updater: (item: LaneItem) => LaneItem) => {
    setLanes(prev => prev.map(lane =>
      lane.lane_id === laneId && lane.current_item
        ? { ...lane, current_item: updater(lane.current_item) }
        : lane
    ));
  }, []);

  const stopTimer = useCallback((laneId: number) => {
    const t = timersRef.current.get(laneId);
    if (t) { clearInterval(t); timersRef.current.delete(laneId); }
  }, []);

  const stopAllTimers = useCallback(() => {
    timersRef.current.forEach(t => clearInterval(t));
    timersRef.current.clear();
  }, []);

  const startCountdown = useCallback((laneId: number, seconds?: number) => {
    stopTimer(laneId);
    if (seconds !== undefined) {
      updateLaneItem(laneId, item => ({ ...item, countdown_seconds: seconds }));
    }
    const timer = setInterval(() => {
      setLanes(prev => {
        const lane = prev.find(l => l.lane_id === laneId);
        const cd = lane?.current_item?.countdown_seconds ?? 0;
        if (cd <= 1) { stopTimer(laneId); }
        return prev.map(l =>
          l.lane_id === laneId && l.current_item
            ? { ...l, current_item: { ...l.current_item, countdown_seconds: Math.max(0, l.current_item.countdown_seconds - 1) } }
            : l
        );
      });
    }, 1000);
    timersRef.current.set(laneId, timer);
  }, [stopTimer, updateLaneItem]);

  useEffect(() => () => stopAllTimers(), [stopAllTimers]);

  const handleBidToggle = useCallback((itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    const lane = lanes.find(l => l.current_item?.id === itemId);
    if (!lane?.current_item) return;
    const item = lane.current_item;
    if (item.phase === 'freeze') { notify('フリーズ中は入札できません', 'error'); return; }
    if (item.phase === 'pre_bid') { notify('入札開始待機中です', 'error'); return; }

    if (currentStatus === 'active') {
      updateLaneItem(lane.lane_id, i => ({ ...i, my_bid_status: 'inactive', active_bidders_count: Math.max(0, i.active_bidders_count - 1) }));
      notify('入札をオフにしました', 'info');
    } else {
      updateLaneItem(lane.lane_id, i => ({ ...i, my_bid_status: 'active', active_bidders_count: i.active_bidders_count + 1 }));
      startCountdown(lane.lane_id, 15);
      notify(`レーン${lane.lane_number}に入札しました！`, 'success');
    }
  }, [lanes, notify, updateLaneItem, startCountdown]);

  const simulateOpponentBid = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, item => {
      const inc = Math.max(100, Math.round(item.current_price * 0.1));
      return { ...item, phase: 'freeze' as const, freeze_remaining_seconds: 3, freeze_countdown_seconds: 3, current_price: item.current_price + inc, active_bidders_count: Math.max(2, item.active_bidders_count) };
    });
    notify('他の参加者が入札！価格が上昇しました', 'warning');
    let remaining = 3;
    const ft = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(ft);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
        startCountdown(laneId, 15);
      } else {
        updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const handleWin = useCallback(() => {
    const lane2 = lanes.find(l => l.lane_id === 2);
    if (!lane2?.current_item) return;
    stopTimer(2);
    updateLaneItem(2, item => ({ ...item, countdown_seconds: 0, my_bid_status: 'active' }));
    const price = lane2.current_item.current_price;
    const qty = lane2.current_item.quantity;
    setWonItems(prev => [...prev, { species_name: lane2.current_item!.species_name, winning_price: price, quantity: qty, total_amount: Math.floor(price * qty * 1.1) }]);
    setCelebration({ species_name: lane2.current_item.species_name, winning_price: price });
    setTimeout(() => setCelebration(null), 4000);
  }, [lanes, stopTimer, updateLaneItem]);

  const handleLiveReset = useCallback(() => {
    stopAllTimers();
    setLanes(JSON.parse(JSON.stringify(INITIAL_LANES)));
    setUpcoming(MOCK_UPCOMING.map(u => ({ ...u })));
    setWonItems([]);
    setCelebration(null);
    setLimitModalLaneId(null);
  }, [stopAllTimers]);

  // Limit modal helpers
  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItem = limitModalLane?.current_item;

  const handleSetLimit = useCallback((price: number) => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: price, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定しました`, 'success');
  }, [limitModalLaneId, updateLaneItem, notify]);

  const handleRemoveLimit = useCallback(() => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: null, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify('上限設定を解除しました', 'info');
  }, [limitModalLaneId, updateLaneItem, notify]);

  const toggleUpcomingFav = (itemId: number) => {
    setUpcoming(prev => prev.map(u => u.id === itemId ? { ...u, is_favorited: !u.is_favorited } : u));
  };

  const wonTotal = wonItems.reduce((sum, w) => sum + w.total_amount, 0);

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {celebration && <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />}

      {/* Header */}
      <AppBar position="sticky" sx={{ background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)' }}>
        <Toolbar>
          <GavelIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
            medaka-auction.com
          </Typography>
          <Chip label="PRESENTATION" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} />
        </Toolbar>
      </AppBar>

      {/* Tab navigation */}
      <Paper sx={{ position: 'sticky', top: 56, zIndex: 10 }}>
        <Container maxWidth="lg">
          <Tabs
            value={tabIndex}
            onChange={(_, v) => setTabIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ '& .MuiTab-root': { minWidth: 'auto', fontWeight: 600 } }}
          >
            <Tab icon={<HomeIcon />} label="ホーム" iconPosition="start" />
            <Tab icon={<GavelIcon />} label="オークション" iconPosition="start" />
            <Tab icon={<InventoryIcon />} label="出品一覧" iconPosition="start" />
            <Tab icon={<LiveTvIcon />} label="ライブ入札" iconPosition="start" />
            <Tab icon={<TrophyIcon />} label="落札結果" iconPosition="start" />
            <Tab icon={<StarIcon />} label="機能紹介" iconPosition="start" />
          </Tabs>
        </Container>
      </Paper>

      {/* Content */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Tab 0: Home */}
        {tabIndex === 0 && <HomeTab />}

        {/* Tab 1: Auction List */}
        {tabIndex === 1 && <AuctionListTab />}

        {/* Tab 2: Item List */}
        {tabIndex === 2 && <ItemListTab />}

        {/* Tab 3: Live Auction Demo */}
        {tabIndex === 3 && (
          <Box>
            <Box sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
              color: 'white', p: 2, borderRadius: 2, mb: 2,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip label="LIVE" size="small" sx={{ bgcolor: '#ef4444', color: 'white', fontWeight: 700 }} />
                <Typography variant="h6" fontWeight="bold">ライブ入札デモ</Typography>
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                入札ボタンをタップして実際の操作を体験できます
              </Typography>
            </Box>

            {/* Lane cards */}
            <Grid container spacing={2}>
              {lanes.map(lane => (
                <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                  <LaneCard
                    lane={lane}
                    isLoading={false}
                    onBidToggle={handleBidToggle}
                    onDetailOpen={() => {}}
                    onLimitEdit={(itemId) => {
                      const targetLane = lanes.find(la => la.current_item?.id === itemId);
                      if (targetLane) setLimitModalLaneId(targetLane.lane_id);
                    }}
                    onLimitRemove={(itemId) => {
                      const targetLane = lanes.find(la => la.current_item?.id === itemId);
                      if (targetLane) {
                        updateLaneItem(targetLane.lane_id, item => ({ ...item, my_limit_price: null, my_limit_triggered: false }));
                        notify('上限設定を解除しました', 'info');
                      }
                    }}
                  />
                </Grid>
              ))}
            </Grid>

            {/* Upcoming items */}
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>次の商品</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
                {upcoming.map(item => (
                  <Box key={item.id} sx={{
                    flexShrink: 0, width: 150, borderRadius: 1.5,
                    border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper',
                  }}>
                    <Box sx={{ width: '100%', aspectRatio: '3/2', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PetsIcon sx={{ color: 'grey.400', fontSize: 28 }} />
                    </Box>
                    <Box sx={{ p: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Chip label={`L${item.laneNumber}`} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} color="primary" variant="outlined" />
                        {item.is_premium && <Chip label="P" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />}
                      </Box>
                      <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>{item.species_name}</Typography>
                      <Typography variant="caption" color="primary.main" fontWeight="bold">¥{item.start_price.toLocaleString()}〜</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                        <IconButton size="small" onClick={() => toggleUpcomingFav(item.id)} sx={{ p: 0.25 }}>
                          {item.is_favorited
                            ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                            : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* Won items table */}
            {wonItems.length > 0 && (
              <Paper sx={{ mt: 3, p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrophyIcon color="warning" /> あなたの落札結果
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>品種</TableCell>
                        <TableCell align="right">単価</TableCell>
                        <TableCell align="right">数量</TableCell>
                        <TableCell align="right">合計(税込)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {wonItems.map((w, i) => (
                        <TableRow key={i}>
                          <TableCell>{w.species_name}</TableCell>
                          <TableCell align="right">¥{w.winning_price.toLocaleString()}/匹</TableCell>
                          <TableCell align="right">{w.quantity}匹</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{w.total_amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>合計</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>¥{wonTotal.toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {/* Demo controls */}
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>デモ操作</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(1)}>他者入札 (L1)</Button>
                <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(2)}>他者入札 (L2)</Button>
                <Button size="small" variant="outlined" onClick={() => {
                  updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 }));
                  setTimeout(() => handleWin(), 500);
                }}>落札体験</Button>
                <Button size="small" variant="outlined" color="secondary" onClick={handleLiveReset}>リセット</Button>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Tab 4: Won Items */}
        {tabIndex === 4 && <WonItemsTab />}

        {/* Tab 5: Features */}
        {tabIndex === 5 && <FeaturesTab />}
      </Container>

      {/* Limit modal */}
      {limitModalLaneId && limitModalItem && (
        <BidLimitModal
          open={!!limitModalLaneId}
          onClose={() => setLimitModalLaneId(null)}
          itemId={limitModalItem.id}
          speciesName={limitModalItem.species_name}
          currentLimitPrice={limitModalItem.my_limit_price ?? null}
          currentPrice={limitModalItem.current_price}
          quickOptions={null}
          isLive={true}
          isSetting={false}
          isRemoving={false}
          onSet={handleSetLimit}
          onRemove={handleRemoveLimit}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.900', color: 'grey.400', py: 3, mt: 4 }}>
        <Container maxWidth="lg">
          <Typography variant="body2" textAlign="center">
            medaka-auction.com | Presentation Mode
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
