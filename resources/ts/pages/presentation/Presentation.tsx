/**
 * /presentation — 認証不要のプレゼンテーション（商談用デモ）ページ
 *
 * 実際の参加者画面と完全に同じUIデザインを再現する。
 * API通信は一切行わず、フロントエンドのモックデータのみで動作する。
 * ParticipantLayout と同じヘッダー/フッター構造を使用し、
 * 各ページ（Home, AuctionList, AuctionItems, AuctionLive/Demo, WonItems）の
 * UIをそのまま再現する。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid, Tabs, Tab,
  Card, CardContent, CardActions, CardMedia, Chip, IconButton,
  Alert, Snackbar, AppBar, Toolbar, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stepper, Step, StepLabel,
  Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Gavel as GavelIcon,
  EmojiEvents as TrophyIcon,
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  PlayArrow as PlayArrowIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Inventory as InventoryIcon,
  ArrowForward as ArrowForwardIcon,
  MeetingRoom as MeetingRoomIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Receipt as ReceiptIcon,
  LocalShipping as LocalShippingIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  SportsEsports as DemoIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem, UpcomingItem } from '@/types';
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

interface MockAuction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  status: string;
  description?: string;
  total_items?: number;
  entrance_allowed?: boolean;
}

const MOCK_AUCTIONS: MockAuction[] = [
  { id: 1, title: '2026年春季メダカオークション', event_date: '2026-04-15', start_time: '13:00', status: 'live', total_items: 120, description: '厳選された個体を多数出品！希少品種も見逃せない春の特別オークションです。' },
  { id: 2, title: '2026年GWスペシャルオークション', event_date: '2026-05-03', start_time: '10:00', status: 'scheduled', total_items: 200, entrance_allowed: true, description: 'ゴールデンウィーク限定の大型オークション。初心者の方も大歓迎！' },
  { id: 3, title: '2026年早春オークション', event_date: '2026-03-01', start_time: '13:00', status: 'finished', total_items: 80, description: '早春の人気品種を集めたオークションです。' },
];

interface MockWonItem {
  id: number;
  item: {
    id: number;
    item_number: number;
    species_name: string;
    quantity: number;
    thumbnail_path: string;
    auction: { id: number; title: string; event_date: string };
  };
  winning_price: number;
  quantity: number;
  total_amount: number;
  commission_amount: number;
  payment_status: 'pending' | 'paid' | 'confirmed';
  payment_deadline?: string;
  delivery_status: 'pending' | 'preparing' | 'shipped' | 'completed';
  shipping_address: string;
  tracking_number?: string;
  shipping_company?: string;
  shipped_at?: string;
}

const MOCK_WON_ITEMS: MockWonItem[] = [
  {
    id: 1, item: { id: 1, item_number: 12, species_name: '紅白ラメ ペア', quantity: 2, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 8500, quantity: 2, total_amount: 18700, commission_amount: 1700,
    payment_status: 'confirmed', delivery_status: 'shipped',
    shipping_address: '東京都渋谷区1-2-3', tracking_number: '1234-5678-9012', shipping_company: 'ヤマト運輸', shipped_at: '2026-03-10',
  },
  {
    id: 2, item: { id: 2, item_number: 28, species_name: '幹之フルボディ 5匹セット', quantity: 5, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 12000, quantity: 5, total_amount: 66000, commission_amount: 6000,
    payment_status: 'confirmed', delivery_status: 'completed',
    shipping_address: '東京都渋谷区1-2-3', shipped_at: '2026-03-08',
  },
  {
    id: 3, item: { id: 3, item_number: 55, species_name: '楊貴妃ダルマ', quantity: 1, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 4200, quantity: 1, total_amount: 4620, commission_amount: 420,
    payment_status: 'pending', payment_deadline: '2026-03-19', delivery_status: 'pending',
    shipping_address: '未設定',
  },
];

const MOCK_ITEMS = [
  { id: 1, item_number: 1, species_name: '紅白ラメ ペア', quantity: 2, start_price: 2000, current_price: 2000, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 2, item_number: 2, species_name: '幹之フルボディ 5匹セット', quantity: 5, start_price: 3000, current_price: 3000, status: 'registered', is_premium: true, thumbnail_path: '/img/noimage.png' },
  { id: 3, item_number: 3, species_name: '楊貴妃ダルマ', quantity: 1, start_price: 1500, current_price: 1500, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 4, item_number: 4, species_name: '三色ラメ', quantity: 3, start_price: 4000, current_price: 4000, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 5, item_number: 5, species_name: 'オロチ ペア', quantity: 2, start_price: 6000, current_price: 6000, status: 'registered', is_premium: true, thumbnail_path: '/img/noimage.png' },
  { id: 6, item_number: 6, species_name: '夜桜ゴールド', quantity: 1, start_price: 3500, current_price: 3500, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 7, item_number: 7, species_name: '煌 (きらめき)', quantity: 3, start_price: 5000, current_price: 8500, status: 'sold', is_premium: true, thumbnail_path: '/img/noimage.png' },
  { id: 8, item_number: 8, species_name: 'サファイア ペア', quantity: 2, start_price: 8000, current_price: 12000, status: 'sold', is_premium: true, thumbnail_path: '/img/noimage.png' },
];

// ====================================================================
// Helper functions (copied from actual pages)
// ====================================================================

function getDaysUntil(dateString: string): string {
  const target = new Date(dateString + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '本日開催';
  if (diff === 1) return 'あと1日';
  return `あと${diff}日`;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  registered: { label: '出品中', color: 'primary' },
  live: { label: '入札中', color: 'error' },
  sold: { label: '落札済', color: 'success' },
  unsold: { label: '不成立', color: 'default' },
};

const getPaymentStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '支払い待ち';
    case 'paid': return '入金済み';
    case 'confirmed': return '入金確認済み';
    default: return status;
  }
};

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return { color: '#F59E0B', bgcolor: '#FEF3C7' };
    case 'paid':
    case 'confirmed': return { color: '#059669', bgcolor: '#ECFDF5' };
    default: return { color: '#64748B', bgcolor: '#F1F5F9' };
  }
};

const getDeliveryStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '発送待ち';
    case 'preparing': return '発送準備中';
    case 'shipped': return '配送中';
    case 'completed': return '配達完了';
    default: return status;
  }
};

const getDeliveryStepIndex = (status: string) => {
  switch (status) {
    case 'pending':
    case 'preparing': return 0;
    case 'shipped': return 1;
    case 'completed': return 2;
    default: return 0;
  }
};

// ====================================================================
// Sub-components (実際の画面と同じUI)
// ====================================================================

/* ─── Tab 0: ホーム（Home.tsx と同じデザイン） ─── */
function HomeTab() {
  const liveAuction = MOCK_AUCTIONS.find(a => a.status === 'live')!;
  const scheduledAuction = MOCK_AUCTIONS.find(a => a.status === 'scheduled')!;

  return (
    <Box>
      {/* 開催中のオークション - 大型バナー（Home.tsx と同じ） */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
          color: 'white',
          py: { xs: 3, md: 4 },
          px: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                bgcolor: '#ef4444', px: 1.5, py: 0.5, borderRadius: 1,
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
              LIVE
            </Box>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
              オークション開催中！
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {liveAuction.title}
          </Typography>
          <Button
            variant="contained" size="large" endIcon={<ArrowForwardIcon />}
            sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'grey.100' } }}
          >
            今すぐ参加する
          </Button>
        </Container>
      </Box>

      {/* 次回開催予定（Home.tsx 次回予定セクションと同じ） */}
      <Container maxWidth="lg" sx={{ pt: 3 }}>
        <Card sx={{ border: '1px solid', borderColor: 'primary.100' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EventIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
                次回開催予定
              </Typography>
            </Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
              {scheduledAuction.title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {formatDate(scheduledAuction.event_date)} {scheduledAuction.start_time}〜
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex', bgcolor: 'primary.50', color: 'primary.main',
                  px: 1, py: 0.25, borderRadius: 0.75, fontWeight: 700, fontSize: '0.75rem',
                }}
              >
                {getDaysUntil(scheduledAuction.event_date)}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 600 }}>
                待機室へ入室
              </Button>
              <Button variant="text" size="small" startIcon={<InventoryIcon />} sx={{ fontWeight: 600 }}>
                出品一覧
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* お知らせ（AnnouncementList と同じデザイン） */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>お知らせ</Typography>
          {[
            { title: 'GWスペシャルオークション出品受付開始', date: '2026-03-15', important: true },
            { title: 'システムメンテナンスのお知らせ (3/20)', date: '2026-03-10', important: false },
            { title: '春季オークション出品者募集中', date: '2026-03-01', important: false },
          ].map((a, i) => (
            <Card key={i} sx={{ mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {a.important && <Chip label="重要" size="small" color="error" />}
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{a.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{a.date}</Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* 広告（Home.tsx と同じ） */}
        <Box sx={{ mb: 5 }}>
          <Card sx={{ bgcolor: '#FAFAFA', border: '1px solid', borderColor: 'grey.200', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}>
              SPONSORED
            </Box>
            <CardContent sx={{ p: 2.5 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Box component="img" src="/img/noimage.png" alt="広告"
                    sx={{ width: '100%', maxWidth: 120, height: 'auto', borderRadius: 1.5 }} />
                </Grid>
                <Grid item xs={12} sm={9}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    高品質メダカ用飼料「極」新発売！
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    色揚げ効果抜群！プロブリーダー推奨の最高級飼料。今なら初回購入20%OFF
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      提供: メダカフード株式会社
                    </Typography>
                    <Button variant="outlined" size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />} sx={{ fontSize: '0.75rem' }}>
                      詳しく見る
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}

/* ─── Tab 1: オークション一覧（AuctionList.tsx と同じデザイン） ─── */
function AuctionListTab() {
  const [tabValue, setTabValue] = useState(0);

  const liveAuctions = MOCK_AUCTIONS.filter(a => a.status === 'live');
  const scheduledAuctions = MOCK_AUCTIONS.filter(a => a.status === 'scheduled');
  const finishedAuctions = MOCK_AUCTIONS.filter(a => a.status === 'finished');

  const getFilteredAuctions = () => {
    switch (tabValue) {
      case 0: return [...liveAuctions, ...scheduledAuctions];
      case 1: return liveAuctions;
      case 2: return scheduledAuctions;
      case 3: return finishedAuctions;
      default: return MOCK_AUCTIONS;
    }
  };

  const filteredAuctions = getFilteredAuctions();

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'live':
        return <Chip icon={<PlayArrowIcon />} label="開催中" color="success" size="small" sx={{ fontWeight: 600 }} />;
      case 'scheduled':
        return <Chip icon={<ScheduleIcon />} label="開催予定" color="primary" size="small" variant="outlined" />;
      case 'finished':
        return <Chip icon={<CheckCircleIcon />} label="終了" size="small" variant="outlined" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
          <GavelIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          オークション一覧
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          開催中・開催予定のオークションを確認できます
        </Typography>
      </Box>

      {/* 開催中バナー */}
      {liveAuctions.length > 0 && (
        <Paper
          elevation={0}
          sx={{ mb: 4, p: 3, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main', borderRadius: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlayArrowIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.dark' }}>
                  オークション開催中！
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {liveAuctions[0].title}
                </Typography>
              </Box>
            </Box>
            <Button variant="contained" color="success" size="large" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 600 }}>
              今すぐ参加する
            </Button>
          </Box>
        </Paper>
      )}

      {/* タブ */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          sx={{ '& .MuiTab-root': { py: 2, fontWeight: 600 } }}
        >
          <Tab label={`開催中・予定 (${liveAuctions.length + scheduledAuctions.length})`} />
          <Tab label={`開催中 (${liveAuctions.length})`} />
          <Tab label={`予定 (${scheduledAuctions.length})`} />
          <Tab label={`終了 (${finishedAuctions.length})`} />
        </Tabs>
      </Paper>

      {/* オークションカード */}
      <Grid container spacing={3}>
        {filteredAuctions.map((auction) => (
          <Grid item xs={12} md={6} key={auction.id}>
            <Card
              elevation={0}
              sx={{
                height: '100%', display: 'flex', flexDirection: 'column',
                border: auction.status === 'live' ? '2px solid' : '1px solid',
                borderColor: auction.status === 'live' ? 'success.main' : 'divider',
                borderRadius: 2, transition: 'all 0.2s',
                '&:hover': { borderColor: auction.status === 'live' ? 'success.dark' : 'primary.main', boxShadow: 2 },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, mr: 1 }}>
                    {auction.title}
                  </Typography>
                  {getStatusChip(auction.status)}
                </Box>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EventIcon fontSize="small" sx={{ color: 'primary.main' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">開催日</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatDate(auction.event_date)}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTimeIcon fontSize="small" sx={{ color: 'primary.main' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">開始時刻</Typography>
                        <Typography variant="body2" fontWeight={600}>{auction.start_time}〜</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  {auction.total_items !== undefined && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InventoryIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">出品数</Typography>
                          <Typography variant="body2" fontWeight={600}>{auction.total_items}点</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>
                {auction.description && (
                  <Typography variant="body2" color="text.secondary"
                    sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {auction.description}
                  </Typography>
                )}
              </CardContent>
              <CardActions sx={{ p: 3, pt: 0 }}>
                {auction.status === 'live' ? (
                  <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                    <Button variant="outlined" size="large" sx={{ fontWeight: 600, flex: 1 }}>出品一覧</Button>
                    <Button variant="contained" color="success" size="large" endIcon={<ArrowForwardIcon />} sx={{ fontWeight: 600, flex: 1 }}>
                      オークション会場へ
                    </Button>
                  </Box>
                ) : auction.status === 'scheduled' ? (
                  auction.entrance_allowed ? (
                    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                      <Button variant="outlined" size="large" sx={{ fontWeight: 600, flex: 1 }}>出品一覧</Button>
                      <Button variant="contained" color="primary" size="large" startIcon={<MeetingRoomIcon />} sx={{ fontWeight: 600, flex: 1 }}>
                        待機室へ入室
                      </Button>
                    </Box>
                  ) : (
                    <Button variant="outlined" fullWidth size="large" sx={{ fontWeight: 600 }}>出品一覧を見る</Button>
                  )
                ) : (
                  <Button variant="text" fullWidth size="large">結果を見る</Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

/* ─── Tab 2: 出品一覧（AuctionItems.tsx と同じデザイン） ─── */
function ItemListTab() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set([2, 5]));
  const [selectedItem, setSelectedItem] = useState<typeof MOCK_ITEMS[0] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const toggleFav = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const activeFilter = statusFilter;
  const currentItems = activeFilter.length > 0
    ? MOCK_ITEMS.filter(item => activeFilter.includes(item.status))
    : MOCK_ITEMS;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー（AuctionItems.tsx と同じ） */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">2026年春季メダカオークション</Typography>
              <Typography variant="body2" color="text.secondary">
                {currentItems.length}件表示 / 全{MOCK_ITEMS.length}点の出品
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button size="small" variant="contained" color="success" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              会場へ
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* レーンタブ */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={0} variant="scrollable" scrollButtons="auto">
          <Tab label={`すべて (${MOCK_ITEMS.length})`} />
          <Tab label="レーン 1 (3)" />
          <Tab label="レーン 2 (3)" />
          <Tab label="レーン 3 (2)" />
        </Tabs>
      </Paper>

      {/* ステータスフィルター */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>表示:</Typography>
        {[
          { key: 'all', label: 'すべて', color: 'default' as const },
          { key: 'registered', label: '出品中', color: 'primary' as const },
          { key: 'live', label: '入札中', color: 'error' as const },
          { key: 'sold', label: '落札済み', color: 'success' as const },
          { key: 'unsold', label: '不成立', color: 'default' as const },
        ].map(({ key, label, color }) => {
          const isAll = key === 'all';
          const isActive = isAll ? statusFilter.length === 0 : activeFilter.includes(key);
          return (
            <Chip key={key} label={label} size="small" color={isActive ? color : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
              onClick={() => {
                if (isAll) { setStatusFilter([]); }
                else {
                  setStatusFilter(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
                }
              }}
              sx={{ cursor: 'pointer', fontWeight: isActive ? 600 : 400 }}
            />
          );
        })}
      </Box>

      {/* アイテムグリッド（ItemCard と同じデザイン） */}
      <Grid container spacing={2}>
        {currentItems.map(item => {
          const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };
          return (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Card
                  sx={{
                    height: '100%', cursor: 'pointer', position: 'relative',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                  }}
                  onClick={() => setSelectedItem(item)}
                >
                  <IconButton
                    onClick={(e) => toggleFav(e, item.id)}
                    sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, bgcolor: 'rgba(255,255,255,0.85)', width: 32, height: 32 }}
                    size="small"
                  >
                    {favorites.has(item.id)
                      ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                      : <FavoriteBorderIcon sx={{ color: 'grey.500', fontSize: 20 }} />}
                  </IconButton>
                  {item.is_premium && (
                    <Chip label="プレミアム" color="warning" size="small"
                      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} />
                  )}
                  <CardMedia component="img" image={item.thumbnail_path} alt={item.species_name}
                    sx={{ aspectRatio: '3/2', objectFit: 'cover' }} />
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
                      <Chip label={status.label} color={status.color} size="small" />
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
                {/* 指値バッジ（AuctionItems.tsx と同じ配置） */}
                <Box sx={{
                  px: 1.5, py: 1, bgcolor: 'background.paper',
                  border: '1px solid', borderTop: 'none', borderColor: 'divider',
                  borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
                }}>
                  <BidLimitBadge limitPrice={null} isTriggered={false} onEdit={() => {}} />
                </Box>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* 詳細ダイアログ（AuctionItems.tsx と同じ） */}
      <Dialog open={!!selectedItem} onClose={() => setSelectedItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">No.{selectedItem?.item_number} {selectedItem?.species_name}</Typography>
            <IconButton onClick={() => setSelectedItem(null)}><CheckCircleIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                <img src={selectedItem?.thumbnail_path || '/img/noimage.png'} alt={selectedItem?.species_name}
                  style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
              </Box>
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
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Box>
            <BidLimitBadge limitPrice={null} isTriggered={false} onEdit={() => {}} />
          </Box>
          <Button onClick={() => setSelectedItem(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

/* ─── Tab 4: 落札管理（WonItems.tsx と同じデザイン） ─── */
function WonItemsTab() {
  const [activeTab, setActiveTab] = useState('all');
  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MockWonItem | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const summary = {
    total_amount: MOCK_WON_ITEMS.reduce((s, w) => s + w.total_amount, 0),
    paid_amount: MOCK_WON_ITEMS.filter(w => w.payment_status !== 'pending').reduce((s, w) => s + w.total_amount, 0),
    pending_amount: MOCK_WON_ITEMS.filter(w => w.payment_status === 'pending').reduce((s, w) => s + w.total_amount, 0),
  };

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'payment_pending': return MOCK_WON_ITEMS.filter(i => i.payment_status === 'pending');
      case 'shipping_pending': return MOCK_WON_ITEMS.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status));
      case 'shipped': return MOCK_WON_ITEMS.filter(i => i.delivery_status === 'shipped');
      case 'completed': return MOCK_WON_ITEMS.filter(i => i.delivery_status === 'completed');
      default: return MOCK_WON_ITEMS;
    }
  };

  const filteredItems = getFilteredItems();
  const tabCounts = {
    all: MOCK_WON_ITEMS.length,
    payment_pending: MOCK_WON_ITEMS.filter(i => i.payment_status === 'pending').length,
    shipping_pending: MOCK_WON_ITEMS.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status)).length,
    shipped: MOCK_WON_ITEMS.filter(i => i.delivery_status === 'shipped').length,
    completed: MOCK_WON_ITEMS.filter(i => i.delivery_status === 'completed').length,
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>落札管理</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        落札した商品の支払い状況と配送状況を確認できます
      </Typography>

      {/* サマリー（WonItems.tsx と同じ） */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>合計落札金額</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>¥{summary.total_amount.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, bgcolor: '#ECFDF5' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>入金確認済み</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>¥{summary.paid_amount.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, bgcolor: '#FEF3C7' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>支払い待ち</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>¥{summary.pending_amount.toLocaleString()}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* タブフィルター */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`すべて (${tabCounts.all})`} value="all" />
          <Tab label={`支払い待ち (${tabCounts.payment_pending})`} value="payment_pending" />
          <Tab label={`発送待ち (${tabCounts.shipping_pending})`} value="shipping_pending" />
          <Tab label={`配送中 (${tabCounts.shipped})`} value="shipped" />
          <Tab label={`配達完了 (${tabCounts.completed})`} value="completed" />
        </Tabs>
      </Paper>

      {/* 落札商品一覧（WonItems.tsx と同じカードデザイン） */}
      {filteredItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">該当する商品はありません。</Typography>
        </Paper>
      ) : (
        filteredItems.map((wonItem) => (
          <Card key={wonItem.id} sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={3}>
                  <CardMedia component="img" image={wonItem.item.thumbnail_path}
                    alt={wonItem.item.species_name}
                    sx={{ borderRadius: 2, aspectRatio: '3/2', objectFit: 'cover', width: '100%' }} />
                </Grid>
                <Grid item xs={12} sm={9}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      No.{wonItem.item.item_number}
                    </Typography>
                    <Chip label={getPaymentStatusLabel(wonItem.payment_status)} size="small"
                      sx={{ ...getPaymentStatusColor(wonItem.payment_status), fontWeight: 600, fontSize: '0.7rem' }} />
                    <Chip label={getDeliveryStatusLabel(wonItem.delivery_status)} size="small"
                      sx={{ bgcolor: '#DBEAFE', color: '#3B82F6', fontWeight: 600, fontSize: '0.7rem' }} />
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {wonItem.item.species_name}
                  </Typography>

                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {wonItem.item.auction.title} ({wonItem.item.auction.event_date})
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        落札単価: ¥{Number(wonItem.winning_price).toLocaleString()} × {wonItem.quantity}匹
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        手数料: ¥{Number(wonItem.commission_amount).toLocaleString()}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#059669', fontWeight: 700, mt: 0.5 }}>
                        合計: ¥{Number(wonItem.total_amount).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      {wonItem.payment_deadline && wonItem.payment_status === 'pending' && (
                        <Typography variant="body2" sx={{ color: 'error.main' }}>
                          支払期限: {new Date(wonItem.payment_deadline).toLocaleDateString('ja-JP')}
                        </Typography>
                      )}
                      {wonItem.shipped_at && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          発送日: {new Date(wonItem.shipped_at).toLocaleDateString('ja-JP')}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>

                  {wonItem.tracking_number && (
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>配送情報</Typography>
                        <Button size="small" endIcon={<OpenInNewIcon />}
                          onClick={() => { setSelectedItem(wonItem); setTrackingDetailOpen(true); }}>
                          詳細を見る
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                        <Typography variant="body2">{wonItem.shipping_company}: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {wonItem.tracking_number}
                        </Typography>
                        <Tooltip title="コピー">
                          <IconButton size="small" onClick={() => setSnackbar({ open: true, message: 'コピーしました' })}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>配送先</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{wonItem.shipping_address || '未設定'}</Typography>
                      {wonItem.payment_status === 'pending' && (
                        <Button size="small" startIcon={<EditIcon />}>
                          {wonItem.shipping_address !== '未設定' ? '変更' : '設定'}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {wonItem.payment_status === 'pending' && (
                      <Button variant="contained" color="warning" startIcon={<ReceiptIcon />}>
                        請求書を確認・支払い
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))
      )}

      {/* 配送詳細ダイアログ（WonItems.tsx と同じ） */}
      <Dialog open={trackingDetailOpen} onClose={() => setTrackingDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送状況詳細</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedItem.item.species_name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {selectedItem.item.auction.title}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Stepper activeStep={getDeliveryStepIndex(selectedItem.delivery_status)} sx={{ mb: 3 }}>
                <Step><StepLabel>発送準備中</StepLabel></Step>
                <Step><StepLabel>配送中</StepLabel></Step>
                <Step><StepLabel>配達完了</StepLabel></Step>
              </Stepper>
              {selectedItem.tracking_number && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>伝票番号</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>{selectedItem.tracking_number}</Typography>
                    <IconButton size="small" onClick={() => setSnackbar({ open: true, message: 'コピーしました' })}>
                      <CopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {selectedItem.shipping_company}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDetailOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSnackbar({ open: false, message: '' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

// ====================================================================
// Main Presentation Component
// ====================================================================

export default function Presentation() {
  const [currentPage, setCurrentPage] = useState('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });

  // ─── Live demo state ───
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

  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItemData = limitModalLane?.current_item;

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

  // ─── Menu items (ParticipantLayout と同じ) ───
  const menuItems = [
    { text: 'ホーム', icon: <HomeIcon />, page: 'home' },
    { text: 'オークション', icon: <GavelIcon />, page: 'auctions' },
    { text: 'お気に入り', icon: <FavoriteIcon />, page: 'items' },
    { text: '落札管理', icon: <ReceiptIcon />, page: 'won-items' },
    { text: 'デモ', icon: <DemoIcon />, page: 'demo' },
    { text: '設定', icon: <SettingsIcon />, page: 'settings' },
  ];

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {celebration && <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />}

      {/* ヘッダー（ParticipantLayout.tsx と同じ AppBar デザイン） */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start" color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img" src="/img/logo.png" alt="MEDAKA AUCTION PORT"
              onClick={() => setCurrentPage('home')}
              sx={{ height: 48, width: '100%', maxWidth: 200, objectFit: 'contain', cursor: 'pointer' }}
            />
            <Chip label="PRESENTATION" size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: '0.65rem' }} />
          </Box>

          {/* デスクトップメニュー */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.page} color="inherit"
                onClick={() => setCurrentPage(item.page)}
                sx={{ borderBottom: currentPage === item.page ? 2 : 0, borderRadius: 0 }}
              >
                {item.text}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>

      {/* サイドメニュー（モバイル）（ParticipantLayout.tsx と同じ） */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 250 }} role="presentation">
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">メニュー</Typography>
          </Box>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.page} disablePadding>
                <ListItemButton
                  selected={currentPage === item.page}
                  onClick={() => { setCurrentPage(item.page); setDrawerOpen(false); }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* LIVEバナー（ParticipantLayout.tsx と同じ、ホーム以外で表示） */}
      {currentPage !== 'home' && currentPage !== 'demo' && (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
            color: 'white', py: { xs: 3, md: 4 }, px: 2,
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                bgcolor: '#ef4444', px: 1.5, py: 0.5, borderRadius: 1,
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
                animation: 'livePulse 2s infinite',
                '@keyframes livePulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
              }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                LIVE
              </Box>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>オークション開催中！</Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
              2026年春季メダカオークション
            </Typography>
            <Button
              variant="contained" size="large" endIcon={<ArrowForwardIcon />}
              onClick={() => setCurrentPage('demo')}
              sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'grey.100' } }}
            >
              今すぐ参加する
            </Button>
          </Container>
        </Box>
      )}

      {/* メインコンテンツ */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        {/* ホーム */}
        {currentPage === 'home' && <HomeTab />}

        {/* オークション一覧 */}
        {currentPage === 'auctions' && <AuctionListTab />}

        {/* 出品一覧 (お気に入り も同じ画面) */}
        {(currentPage === 'items' || currentPage === 'settings') && <ItemListTab />}

        {/* ライブデモ（Demo.tsx と同じデザイン） */}
        {currentPage === 'demo' && (
          <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
            {/* ヘッダー（Demo.tsx と同じ） */}
            <Box sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)', color: 'white', py: 3, px: 2 }}>
              <Container maxWidth="xl">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <GavelIcon sx={{ fontSize: 32 }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.3rem', md: '2rem' } }}>
                    オークション体験デモ
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                  実際のオークション画面を操作しながら、入札の流れを体験できます
                </Typography>
              </Container>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3 }}>
              {/* レーングリッド（Demo.tsx と同じ） */}
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

              {/* 次の商品（Demo.tsx と同じ） */}
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
                          <IconButton size="small" sx={{ p: 0.25 }} onClick={() => notify(`${item.species_name} の詳細（デモ）`, 'info')}>
                            <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => toggleUpcomingFav(item.id)} sx={{ p: 0.25 }}>
                            {item.is_favorited
                              ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                              : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
                          </IconButton>
                        </Box>
                        <Box sx={{ mt: 0.5 }}>
                          <BidLimitBadge limitPrice={null} isTriggered={false}
                            onEdit={() => notify('次の商品への指値は、商品がレーンに来てから設定できます', 'info')} />
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>

              {/* 落札結果テーブル（Demo.tsx と同じ） */}
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
                          <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>合計</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>
                            ¥{wonTotal.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
              {wonItems.length === 0 && (
                <Paper sx={{ mt: 3, p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary" align="center">
                    落札した商品がここに表示されます
                  </Typography>
                </Paper>
              )}

              {/* フリーモード操作パネル（Demo.tsx と同じ） */}
              <Paper sx={{ mt: 3, p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                  フリーモード — 自由に操作できます
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  入札ボタンや操作パネルで自由にお試しください。
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(1)}>
                    レーン1に他者入札
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(2)}>
                    レーン2に他者入札
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => {
                    updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 }));
                    setTimeout(() => handleWin(), 500);
                  }}>
                    落札体験
                  </Button>
                  <Button size="small" variant="outlined" color="secondary" onClick={handleLiveReset}>
                    リセット
                  </Button>
                </Box>
              </Paper>
            </Container>
          </Box>
        )}

        {/* 落札管理 */}
        {currentPage === 'won-items' && <WonItemsTab />}
      </Box>

      {/* フッター（ParticipantLayout.tsx と同じ） */}
      <Box
        component="footer"
        sx={{ py: 3, px: 2, mt: 'auto', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="caption" component="a" href="/legal/privacy" target="_blank" rel="noopener noreferrer"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              プライバシーポリシー
            </Typography>
            <Typography variant="caption" color="text.secondary">|</Typography>
            <Typography variant="caption" component="a" href="/legal/tokushoho" target="_blank" rel="noopener noreferrer"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              特定商取引法に基づく表記
            </Typography>
            <Typography variant="caption" color="text.secondary">|</Typography>
            <Typography variant="caption" component="a" href="/legal/terms" target="_blank" rel="noopener noreferrer"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              利用規約
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" align="center">
            © 2025 メダカオークション運営事務局
          </Typography>
        </Container>
      </Box>

      {/* 指値モーダル */}
      {limitModalLaneId && limitModalItemData && (
        <BidLimitModal
          open={!!limitModalLaneId}
          onClose={() => setLimitModalLaneId(null)}
          itemId={limitModalItemData.id}
          speciesName={limitModalItemData.species_name}
          currentLimitPrice={limitModalItemData.my_limit_price ?? null}
          currentPrice={limitModalItemData.current_price}
          quickOptions={null}
          isLive={true}
          isSetting={false}
          isRemoving={false}
          onSet={handleSetLimit}
          onRemove={handleRemoveLimit}
        />
      )}

      {/* スナックバー */}
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
    </Box>
  );
}
