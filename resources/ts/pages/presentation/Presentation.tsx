/**
 * /presentation — 認証不要のプレゼンテーション（商談用デモ）ページ
 *
 * 実際の参加者画面と完全に同じUIデザインを再現する。
 * API通信は一切行わず、フロントエンドのモックデータのみで動作する。
 * ParticipantLayout と同じヘッダー/フッター構造を使用し、
 * 各ページ（Home, AuctionList, AuctionItems, Favorites, WonItems, Demo, Settings）の
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
  TextField, Avatar, FormControlLabel, Switch, Link,
  CardActionArea, Stack,
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
  ArrowBack as ArrowBackIcon,
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
  Close as CloseIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  ListAlt as ListAltIcon,
  Announcement as AnnouncementIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem, UpcomingItem } from '@/types';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { ItemCard } from '../../features/auction-items/components/ItemCard';
import type { ItemData } from '../../features/auction-items/components/ItemCard';
import { DemoTourPopover, type TourStep } from '../../components/DemoTourPopover';

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

interface MockAnnouncement {
  id: number;
  title: string;
  content: string;
  published_at: string;
  is_important: boolean;
}

const MOCK_ANNOUNCEMENTS: MockAnnouncement[] = [
  { id: 1, title: 'GWスペシャルオークション出品受付開始', content: 'ゴールデンウィーク限定の大型オークションの出品受付を開始しました。出品をご希望の方は、マイページの出品管理から申請をお願いいたします。締め切りは4月20日です。\n\n今回は特別に出品手数料を50%OFFとさせていただきます。この機会にぜひご出品ください。', published_at: '2026-03-15T10:00:00', is_important: true },
  { id: 2, title: 'システムメンテナンスのお知らせ (3/20)', content: '下記日時にシステムメンテナンスを実施いたします。\n\n日時: 2026年3月20日(金) 02:00〜06:00\n\nメンテナンス中はサービスをご利用いただけません。ご不便をおかけしますが、ご理解のほどよろしくお願いいたします。', published_at: '2026-03-10T00:02:00', is_important: true },
  { id: 3, title: '春季オークション出品者募集中', content: '2026年春季メダカオークションの出品者を募集しています。高品質な個体をお持ちの方はぜひご参加ください。詳細は出品ガイドをご確認ください。', published_at: '2026-03-01T09:00:00', is_important: false },
  { id: 4, title: '新機能「指値（上限価格）」のご案内', content: '入札時に上限価格を設定できる「指値」機能をリリースしました。設定した金額に達すると自動的に入札がオフになります。予算管理にぜひご活用ください。\n\n設定方法: 出品一覧またはライブ画面のカード下部にある「上限設定」ボタンから設定できます。', published_at: '2026-02-20T05:36:00', is_important: false },
  { id: 5, title: '利用規約の一部改定について', content: '2026年3月1日より利用規約の一部を改定いたしました。主な変更点は以下の通りです。\n\n・落札後の支払期限を72時間から48時間に短縮\n・配送方法の選択肢を追加\n・キャンセルポリシーの明確化\n\n詳細は利用規約ページをご確認ください。', published_at: '2026-02-15T05:36:00', is_important: false },
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
    id: 1,
    item: { id: 1, item_number: 12, species_name: '紅白ラメ ペア', quantity: 2, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 8500, quantity: 2, total_amount: 18700, commission_amount: 1700,
    payment_status: 'confirmed', delivery_status: 'shipped',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101', tracking_number: '1234-5678-9012', shipping_company: 'ヤマト運輸', shipped_at: '2026-03-10',
  },
  {
    id: 2,
    item: { id: 2, item_number: 28, species_name: '幹之フルボディ 5匹セット', quantity: 5, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 12000, quantity: 5, total_amount: 66000, commission_amount: 6000,
    payment_status: 'confirmed', delivery_status: 'completed',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101', shipped_at: '2026-03-08',
  },
  {
    id: 3,
    item: { id: 3, item_number: 55, species_name: '楊貴妃ダルマ', quantity: 1, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 4200, quantity: 1, total_amount: 4620, commission_amount: 420,
    payment_status: 'pending', payment_deadline: '2026-03-19', delivery_status: 'pending',
    shipping_address: '未設定',
  },
  {
    id: 4,
    item: { id: 4, item_number: 71, species_name: 'サファイア ペア', quantity: 2, thumbnail_path: '/img/noimage.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 15000, quantity: 2, total_amount: 33000, commission_amount: 3000,
    payment_status: 'paid', delivery_status: 'preparing',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101',
  },
];

// 3 lanes x 4+ items each = 14 items
const MOCK_ITEMS: ItemData[] = [
  { id: 1, item_number: 1, species_name: '紅白ラメ ペア', quantity: 2, start_price: 2000, current_price: 3500, status: 'live', is_premium: false, thumbnail_path: '/img/noimage.png', inspection_info: '体長3cm前後、発色良好' },
  { id: 2, item_number: 2, species_name: '幹之フルボディ 5匹セット', quantity: 5, start_price: 3000, current_price: 3000, status: 'registered', is_premium: true, thumbnail_path: '/img/noimage.png', inspection_info: 'フルボディ確認済み' },
  { id: 3, item_number: 3, species_name: '楊貴妃ダルマ', quantity: 1, start_price: 1500, current_price: 1500, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 4, item_number: 4, species_name: '三色ラメ 3匹セット', quantity: 3, start_price: 4000, current_price: 4000, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png', inspection_info: '三色バランス良好' },
  { id: 5, item_number: 5, species_name: 'オロチ ペア', quantity: 2, start_price: 6000, current_price: 8000, status: 'live', is_premium: true, thumbnail_path: '/img/noimage.png', inspection_info: '漆黒度S級' },
  { id: 6, item_number: 6, species_name: '夜桜ゴールド', quantity: 1, start_price: 3500, current_price: 3500, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 7, item_number: 7, species_name: '煌 (きらめき) 3匹セット', quantity: 3, start_price: 5000, current_price: 8500, status: 'sold', is_premium: true, thumbnail_path: '/img/noimage.png', inspection_info: 'ラメ数100以上' },
  { id: 8, item_number: 8, species_name: 'サファイア ペア', quantity: 2, start_price: 8000, current_price: 12000, status: 'sold', is_premium: true, thumbnail_path: '/img/noimage.png' },
  { id: 9, item_number: 9, species_name: 'ブラックダイヤ', quantity: 1, start_price: 4500, current_price: 4500, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png', inspection_info: '体外光あり' },
  { id: 10, item_number: 10, species_name: '松井ヒレ長 ペア', quantity: 2, start_price: 3000, current_price: 3000, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 11, item_number: 11, species_name: '女雛 3匹セット', quantity: 3, start_price: 2500, current_price: 2500, status: 'unsold', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 12, item_number: 12, species_name: 'ユリシス ペア', quantity: 2, start_price: 7000, current_price: 10500, status: 'sold', is_premium: true, thumbnail_path: '/img/noimage.png', inspection_info: '青体外光確認済み' },
  { id: 13, item_number: 13, species_name: '琥珀透明鱗', quantity: 1, start_price: 2000, current_price: 2000, status: 'registered', is_premium: false, thumbnail_path: '/img/noimage.png' },
  { id: 14, item_number: 14, species_name: '白ラメ幹之 5匹セット', quantity: 5, start_price: 4000, current_price: 4000, status: 'unsold', is_premium: false, thumbnail_path: '/img/noimage.png' },
];

// Lane assignment: items 1-5 = lane1, items 6-10 = lane2, items 11-14 = lane3
const MOCK_LANES = [
  { lane_name: 'レーン 1', items: MOCK_ITEMS.filter((_, i) => i < 5) },
  { lane_name: 'レーン 2', items: MOCK_ITEMS.filter((_, i) => i >= 5 && i < 10) },
  { lane_name: 'レーン 3', items: MOCK_ITEMS.filter((_, i) => i >= 10) },
];

// ====================================================================
// Helper functions
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

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
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

const getTrackingUrl = (trackingNumber: string, company: string) => {
  const cleanNumber = trackingNumber.replace(/-/g, '');
  switch (company) {
    case 'ヤマト運輸':
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${cleanNumber}`;
    case '佐川急便':
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${cleanNumber}`;
    case '日本郵便':
      return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${cleanNumber}`;
    default:
      return '';
  }
};

// ====================================================================
// Sub-components
// ====================================================================

/* ─── HOME (matches Home.tsx) ─── */
function HomeTab({ onNavigate }: { onNavigate: (page: string) => void }) {
  const liveAuction = MOCK_AUCTIONS.find(a => a.status === 'live')!;
  const scheduledAuction = MOCK_AUCTIONS.find(a => a.status === 'scheduled')!;
  const [announcementDetail, setAnnouncementDetail] = useState<MockAnnouncement | null>(null);

  return (
    <Box>
      {/* LIVE banner */}
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
              animation: 'pulse 2s infinite',
              '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
              LIVE
            </Box>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>オークション開催中！</Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {liveAuction.title}
          </Typography>
          <Button
            variant="contained" size="large" endIcon={<ArrowForwardIcon />}
            onClick={() => onNavigate('live')}
            sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'grey.100' } }}
          >
            今すぐ参加する
          </Button>
        </Container>
      </Box>

      {/* Next auction card */}
      <Container maxWidth="lg" sx={{ pt: 3 }}>
        <Card sx={{ border: '1px solid', borderColor: 'primary.100' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EventIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle2" color="primary.main" fontWeight={600}>次回開催予定</Typography>
            </Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>{scheduledAuction.title}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {formatDate(scheduledAuction.event_date)} {scheduledAuction.start_time}〜
              </Typography>
              <Box sx={{ display: 'inline-flex', bgcolor: 'primary.50', color: 'primary.main', px: 1, py: 0.25, borderRadius: 0.75, fontWeight: 700, fontSize: '0.75rem' }}>
                {getDaysUntil(scheduledAuction.event_date)}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('live')} sx={{ fontWeight: 600 }}>
                待機室へ入室
              </Button>
              <Button variant="text" size="small" startIcon={<ListAltIcon />} onClick={() => onNavigate('items')} sx={{ fontWeight: 600 }}>
                出品一覧
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Announcements (matches AnnouncementList.tsx) */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnnouncementIcon />
            お知らせ
          </Typography>
          <Stack spacing={2}>
            {MOCK_ANNOUNCEMENTS.map((a) => (
              <Card key={a.id} sx={{
                border: a.is_important ? 2 : 0,
                borderColor: 'error.main',
                bgcolor: a.is_important ? 'error.50' : 'background.paper',
              }}>
                <CardActionArea onClick={() => setAnnouncementDetail(a)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      {a.is_important && <Chip label="重要" size="small" color="error" />}
                      <Typography variant="h6" component="div" sx={{ flex: 1, fontWeight: a.is_important ? 600 : 500 }}>
                        {a.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', mb: 1,
                    }}>
                      {a.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      公開日時: {formatDateTime(a.published_at)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              全{MOCK_ANNOUNCEMENTS.length}件
            </Typography>
          </Stack>
        </Box>

        {/* Sponsored ad */}
        <Box sx={{ mb: 5 }}>
          <Card sx={{ bgcolor: '#FAFAFA', border: '1px solid', borderColor: 'grey.200', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}>SPONSORED</Box>
            <CardContent sx={{ p: 2.5 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Box component="img" src="/img/noimage.png" alt="広告" sx={{ width: '100%', maxWidth: 120, height: 'auto', borderRadius: 1.5 }} />
                </Grid>
                <Grid item xs={12} sm={9}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>高品質メダカ用飼料「極」新発売！</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>色揚げ効果抜群！プロブリーダー推奨の最高級飼料。今なら初回購入20%OFF</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>提供: メダカフード株式会社</Typography>
                    <Button variant="outlined" size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />} sx={{ fontSize: '0.75rem' }}>詳しく見る</Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Container>

      {/* Announcement detail dialog */}
      <Dialog open={!!announcementDetail} onClose={() => setAnnouncementDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {announcementDetail?.is_important && <Chip label="重要" size="small" color="error" />}
              <Typography variant="h6">{announcementDetail?.title}</Typography>
            </Box>
            <IconButton onClick={() => setAnnouncementDetail(null)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>公開日時: {announcementDetail?.published_at ? formatDateTime(announcementDetail.published_at) : ''}</Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{announcementDetail?.content}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnnouncementDetail(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ─── AUCTION LIST (matches AuctionList.tsx) ─── */
function AuctionListTab({ onNavigate }: { onNavigate: (page: string) => void }) {
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
      case 'live': return <Chip icon={<PlayArrowIcon />} label="開催中" color="success" size="small" sx={{ fontWeight: 600 }} />;
      case 'scheduled': return <Chip icon={<ScheduleIcon />} label="開催予定" color="primary" size="small" variant="outlined" />;
      case 'finished': return <Chip icon={<CheckCircleIcon />} label="終了" size="small" variant="outlined" />;
      default: return <Chip label={status} size="small" />;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
          <GavelIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          オークション一覧
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>開催中・開催予定のオークションを確認できます</Typography>
      </Box>

      {liveAuctions.length > 0 && (
        <Paper elevation={0} sx={{ mb: 4, p: 3, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlayArrowIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.dark' }}>オークション開催中！</Typography>
                <Typography variant="body2" color="text.secondary">{liveAuctions[0].title}</Typography>
              </Box>
            </Box>
            <Button variant="contained" color="success" size="large" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('live')} sx={{ fontWeight: 600 }}>
              今すぐ参加する
            </Button>
          </Box>
        </Paper>
      )}

      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth" sx={{ '& .MuiTab-root': { py: 2, fontWeight: 600 } }}>
          <Tab label={`開催中・予定 (${liveAuctions.length + scheduledAuctions.length})`} />
          <Tab label={`開催中 (${liveAuctions.length})`} />
          <Tab label={`予定 (${scheduledAuctions.length})`} />
          <Tab label={`終了 (${finishedAuctions.length})`} />
        </Tabs>
      </Paper>

      {filteredAuctions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
          <GavelIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>該当するオークションはありません</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredAuctions.map((auction) => (
            <Grid item xs={12} md={6} key={auction.id}>
              <Card elevation={0} sx={{
                height: '100%', display: 'flex', flexDirection: 'column',
                border: auction.status === 'live' ? '2px solid' : '1px solid',
                borderColor: auction.status === 'live' ? 'success.main' : 'divider',
                borderRadius: 2, transition: 'all 0.2s',
                '&:hover': { borderColor: auction.status === 'live' ? 'success.dark' : 'primary.main', boxShadow: 2 },
              }}>
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, mr: 1 }}>{auction.title}</Typography>
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
                      <Button variant="outlined" size="large" onClick={() => onNavigate('items')} sx={{ fontWeight: 600, flex: 1 }}>出品一覧</Button>
                      <Button variant="contained" color="success" size="large" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('live')} sx={{ fontWeight: 600, flex: 1 }}>
                        オークション会場へ
                      </Button>
                    </Box>
                  ) : auction.status === 'scheduled' ? (
                    auction.entrance_allowed ? (
                      <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                        <Button variant="outlined" size="large" onClick={() => onNavigate('items')} sx={{ fontWeight: 600, flex: 1 }}>出品一覧</Button>
                        <Button variant="contained" color="primary" size="large" startIcon={<MeetingRoomIcon />} onClick={() => onNavigate('live')} sx={{ fontWeight: 600, flex: 1 }}>
                          待機室へ入室
                        </Button>
                      </Box>
                    ) : (
                      <Button variant="outlined" fullWidth size="large" onClick={() => onNavigate('items')} sx={{ fontWeight: 600 }}>出品一覧を見る</Button>
                    )
                  ) : (
                    <Button variant="text" fullWidth size="large" onClick={() => onNavigate('items')}>結果を見る</Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

/* ─── AUCTION ITEMS (matches AuctionItems.tsx) ─── */
function ItemListTab({ favoriteIds, setFavoriteIds, limitSettings, setLimitSettings, onNavigate }: {
  favoriteIds: Set<number>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  limitSettings: Record<number, { limit_price: number | null; is_triggered: boolean }>;
  setLimitSettings: React.Dispatch<React.SetStateAction<Record<number, { limit_price: number | null; is_triggered: boolean }>>>;
  onNavigate: (page: string) => void;
}) {
  const [selectedLane, setSelectedLane] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [limitModalItem, setLimitModalItem] = useState<ItemData | null>(null);

  const toggleFav = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setFavoriteIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const allLaneItems: ItemData[] = selectedLane === 0
    ? MOCK_ITEMS
    : MOCK_LANES[selectedLane - 1]?.items ?? [];

  const activeFilter = statusFilter;
  const currentItems = activeFilter.length > 0 ? allLaneItems.filter(item => activeFilter.includes(item.status)) : allLaneItems;
  const totalItems = MOCK_ITEMS.length;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => onNavigate('home')}><ArrowBackIcon /></IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">2026年春季メダカオークション</Typography>
              <Typography variant="body2" color="text.secondary">
                {activeFilter.length > 0 ? `${currentItems.length}件表示 / 全${totalItems}点` : `全${totalItems}点の出品`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button size="small" variant="contained" color="success" onClick={() => onNavigate('live')} sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>会場へ</Button>
            <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}><ViewModuleIcon /></IconButton>
            <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}><ViewListIcon /></IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Lane Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedLane} onChange={(_, v) => setSelectedLane(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`すべて (${totalItems})`} />
          {MOCK_LANES.map((lane, i) => (
            <Tab key={i} label={`${lane.lane_name} (${lane.items.length})`} />
          ))}
        </Tabs>
      </Paper>

      {/* Status filter chips */}
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
                if (isAll) setStatusFilter([]);
                else setStatusFilter(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
              }}
              sx={{ cursor: 'pointer', fontWeight: isActive ? 600 : 400 }}
            />
          );
        })}
      </Box>

      {/* Items */}
      {currentItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">出品がありません</Typography></Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {currentItems.map(item => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ItemCard item={item} isFavorited={favoriteIds.has(item.id)}
                  onClick={() => setSelectedItem(item)}
                  onFavoriteToggle={(e) => toggleFav(e, item.id)} />
                <Box sx={{ px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderTop: 'none', borderColor: 'divider', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
                  <BidLimitBadge
                    limitPrice={limitSettings[item.id]?.limit_price ?? null}
                    isTriggered={limitSettings[item.id]?.is_triggered ?? false}
                    onEdit={() => setLimitModalItem(item)}
                    onRemove={() => setLimitSettings(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
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
                <TableCell>No.</TableCell>
                <TableCell>品種名</TableCell>
                <TableCell align="center">匹数</TableCell>
                <TableCell align="right">開始価格</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">上限価格</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentItems.map(item => {
                const s = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };
                return (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedItem(item)}>
                    <TableCell>{item.item_number}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.species_name}
                        {item.is_premium && <Chip label="プレミアム" color="warning" size="small" />}
                      </Box>
                    </TableCell>
                    <TableCell align="center">{item.quantity}匹</TableCell>
                    <TableCell align="right">¥{Number(item.start_price).toLocaleString()}</TableCell>
                    <TableCell align="center"><Chip label={s.label} color={s.color} size="small" /></TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <BidLimitBadge
                        limitPrice={limitSettings[item.id]?.limit_price ?? null}
                        isTriggered={limitSettings[item.id]?.is_triggered ?? false}
                        onEdit={() => setLimitModalItem(item)}
                        onRemove={() => setLimitSettings(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFav(e, item.id); }}>
                        {favoriteIds.has(item.id) ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 18 }} /> : <FavoriteBorderIcon sx={{ color: 'grey.500', fontSize: 18 }} />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Detail dialog */}
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
              {selectedItem?.inspection_info && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2, color: 'primary.main' }} gutterBottom>個体情報</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.inspection_info}</Typography>
                </>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Box>
            {selectedItem && (
              <BidLimitBadge
                limitPrice={limitSettings[selectedItem.id]?.limit_price ?? null}
                isTriggered={limitSettings[selectedItem.id]?.is_triggered ?? false}
                onEdit={() => setLimitModalItem(selectedItem)}
                onRemove={() => setLimitSettings(prev => { const n = { ...prev }; delete n[selectedItem.id]; return n; })}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setSelectedItem(null)}>閉じる</Button>
            <Button variant="contained" onClick={() => { setSelectedItem(null); onNavigate('live'); }}>ライブ画面へ</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* BidLimitModal */}
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
          isSetting={false}
          onSet={(price) => {
            setLimitSettings(prev => ({ ...prev, [limitModalItem.id]: { limit_price: price, is_triggered: false } }));
            setFavoriteIds(prev => { const n = new Set(prev); n.add(limitModalItem.id); return n; });
            setLimitModalItem(null);
          }}
          onRemove={() => {
            setLimitSettings(prev => { const n = { ...prev }; delete n[limitModalItem.id]; return n; });
            setLimitModalItem(null);
          }}
        />
      )}
    </Container>
  );
}

/* ─── FAVORITES (matches Favorites.tsx) ─── */
function FavoritesTab({ favoriteIds, setFavoriteIds, limitSettings, setLimitSettings, onNavigate }: {
  favoriteIds: Set<number>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  limitSettings: Record<number, { limit_price: number | null; is_triggered: boolean }>;
  setLimitSettings: React.Dispatch<React.SetStateAction<Record<number, { limit_price: number | null; is_triggered: boolean }>>>;
  onNavigate: (page: string) => void;
}) {
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [limitModalItem, setLimitModalItem] = useState<ItemData | null>(null);

  const favoriteItems = MOCK_ITEMS.filter(item => favoriteIds.has(item.id));

  const removeFav = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setFavoriteIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => onNavigate('home')}><ArrowBackIcon /></IconButton>
          <Box>
            <Typography variant="h5" fontWeight="bold">お気に入り</Typography>
            <Typography variant="body2" color="text.secondary">{favoriteItems.length}件のお気に入り</Typography>
          </Box>
        </Box>
      </Paper>

      {favoriteItems.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <FavoriteIcon sx={{ fontSize: 48, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>お気に入りはまだありません</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            オークションの出品一覧からハートアイコンをタップして追加できます
          </Typography>
          <Button variant="contained" onClick={() => onNavigate('items')}>出品一覧へ</Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {favoriteItems.map(item => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={item.id}>
              <Card
                sx={{
                  cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative',
                  borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                }}
                onClick={() => setSelectedItem(item)}
              >
                <IconButton
                  onClick={(e) => removeFav(e, item.id)}
                  sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,1)' }, width: 32, height: 32 }}
                  size="small"
                >
                  <FavoriteIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                </IconButton>
                {item.is_premium && <Chip label="プレミアム" color="warning" size="small" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} />}
                <CardMedia component="img" image={item.thumbnail_path || '/img/noimage.png'} alt={item.species_name} sx={{ aspectRatio: '3/2', objectFit: 'cover' }} />
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
                    {(() => { const s = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const }; return <Chip label={s.label} color={s.color} size="small" />; })()}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>{item.species_name}</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">¥{Number(item.start_price).toLocaleString()}〜</Typography>
                    <Typography variant="caption" color="text.secondary">{item.quantity}匹セット</Typography>
                  </Box>
                </CardContent>
              </Card>
              <Box sx={{ px: 1.5, py: 1, bgcolor: 'background.paper', border: '1px solid', borderTop: 'none', borderColor: 'divider', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
                <BidLimitBadge
                  limitPrice={limitSettings[item.id]?.limit_price ?? null}
                  isTriggered={limitSettings[item.id]?.is_triggered ?? false}
                  onEdit={() => setLimitModalItem(item)}
                  onRemove={() => setLimitSettings(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Detail dialog */}
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
          <Button variant="outlined" onClick={() => { setSelectedItem(null); onNavigate('items'); }}>出品一覧へ</Button>
        </DialogActions>
      </Dialog>

      {/* BidLimitModal */}
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
          isSetting={false}
          onSet={(price) => {
            setLimitSettings(prev => ({ ...prev, [limitModalItem.id]: { limit_price: price, is_triggered: false } }));
            setLimitModalItem(null);
          }}
          onRemove={() => {
            setLimitSettings(prev => { const n = { ...prev }; delete n[limitModalItem.id]; return n; });
            setLimitModalItem(null);
          }}
        />
      )}
    </Container>
  );
}

/* ─── WON ITEMS (matches WonItems.tsx) ─── */
function WonItemsTab() {
  const [activeTab, setActiveTab] = useState('all');
  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MockWonItem | null>(null);
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MockWonItem | null>(null);
  const [addressForm, setAddressForm] = useState({
    shipping_postal_code: '', shipping_prefecture: '', shipping_city: '',
    shipping_address_line1: '', shipping_address_line2: '', shipping_name: '', shipping_phone: '',
  });
  const [wonItemAddresses, setWonItemAddresses] = useState<Record<number, string>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const getWonItemAddress = (item: MockWonItem) => wonItemAddresses[item.id] ?? item.shipping_address;

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

  const handleEditAddress = (item: MockWonItem) => {
    setAddressForm({
      shipping_postal_code: '150-0001', shipping_prefecture: '東京都',
      shipping_city: '渋谷区', shipping_address_line1: '神宮前1-2-3',
      shipping_address_line2: 'メダカハイツ101', shipping_name: 'デモ ユーザー', shipping_phone: '090-1234-5678',
    });
    setEditingItem(item);
    setEditAddressOpen(true);
  };

  const handleSaveAddress = () => {
    if (!editingItem) return;
    const addr = `〒${addressForm.shipping_postal_code} ${addressForm.shipping_prefecture}${addressForm.shipping_city}${addressForm.shipping_address_line1} ${addressForm.shipping_address_line2}`;
    setWonItemAddresses(prev => ({ ...prev, [editingItem.id]: addr }));
    setSnackbar({ open: true, message: '配送先を更新しました', severity: 'success' });
    setEditAddressOpen(false);
    setEditingItem(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>落札管理</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>落札した商品の支払い状況と配送状況を確認できます</Typography>

      {/* Summary */}
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

      {/* Tab filter */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`すべて (${tabCounts.all})`} value="all" />
          <Tab label={`支払い待ち (${tabCounts.payment_pending})`} value="payment_pending" />
          <Tab label={`発送待ち (${tabCounts.shipping_pending})`} value="shipping_pending" />
          <Tab label={`配送中 (${tabCounts.shipped})`} value="shipped" />
          <Tab label={`配達完了 (${tabCounts.completed})`} value="completed" />
        </Tabs>
      </Paper>

      {/* Won items list */}
      {filteredItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {activeTab === 'all' ? '落札した商品はまだありません。' : '該当する商品はありません。'}
          </Typography>
        </Paper>
      ) : (
        filteredItems.map((wonItem) => (
          <Card key={wonItem.id} sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={3}>
                  <CardMedia component="img" image={wonItem.item.thumbnail_path} alt={wonItem.item.species_name}
                    sx={{ borderRadius: 2, aspectRatio: '3/2', objectFit: 'cover', width: '100%' }} />
                </Grid>
                <Grid item xs={12} sm={9}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>No.{wonItem.item.item_number}</Typography>
                    <Chip label={getPaymentStatusLabel(wonItem.payment_status)} size="small"
                      sx={{ ...getPaymentStatusColor(wonItem.payment_status), fontWeight: 600, fontSize: '0.7rem' }} />
                    <Chip label={getDeliveryStatusLabel(wonItem.delivery_status)} size="small"
                      sx={{ bgcolor: '#DBEAFE', color: '#3B82F6', fontWeight: 600, fontSize: '0.7rem' }} />
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{wonItem.item.species_name}</Typography>
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

                  {/* Tracking info */}
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
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{wonItem.tracking_number}</Typography>
                        <Tooltip title="コピー">
                          <IconButton size="small" onClick={() => handleCopy(wonItem.tracking_number!)}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        {wonItem.shipping_company && (
                          <Button size="small" variant="outlined" endIcon={<OpenInNewIcon />}
                            component={Link} href={getTrackingUrl(wonItem.tracking_number, wonItem.shipping_company)} target="_blank">
                            配送状況を確認
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Shipping address */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>配送先</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{getWonItemAddress(wonItem)}</Typography>
                      {wonItem.payment_status === 'pending' && (
                        <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditAddress(wonItem)}>
                          {getWonItemAddress(wonItem) !== '未設定' ? '変更' : '設定'}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* Action buttons */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {wonItem.payment_status === 'pending' && (
                      <Button variant="contained" color="warning" startIcon={<ReceiptIcon />}
                        onClick={() => setSnackbar({ open: true, message: '請求書画面に遷移します（デモ）', severity: 'success' })}>
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

      {/* Address edit dialog */}
      <Dialog open={editAddressOpen} onClose={() => setEditAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送先住所の変更</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>※ 入金確認前のみ変更可能です</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="郵便番号" value={addressForm.shipping_postal_code}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_postal_code: e.target.value })} placeholder="123-4567" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="都道府県" value={addressForm.shipping_prefecture}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_prefecture: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="市区町村" value={addressForm.shipping_city}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_city: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="番地" value={addressForm.shipping_address_line1}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_address_line1: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="建物名・部屋番号（任意）" value={addressForm.shipping_address_line2}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_address_line2: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="受取人氏名" value={addressForm.shipping_name}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="電話番号" value={addressForm.shipping_phone}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_phone: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAddressOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveAddress} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* Tracking detail dialog */}
      <Dialog open={trackingDetailOpen} onClose={() => setTrackingDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送状況詳細</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{selectedItem.item.species_name}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{selectedItem.item.auction.title}</Typography>
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
                    <IconButton size="small" onClick={() => handleCopy(selectedItem.tracking_number!)}>
                      <CopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{selectedItem.shipping_company}</Typography>
                </Box>
              )}
              {selectedItem.tracking_number && selectedItem.shipping_company && (
                <Button fullWidth variant="contained" endIcon={<OpenInNewIcon />}
                  component={Link} href={getTrackingUrl(selectedItem.tracking_number, selectedItem.shipping_company)} target="_blank">
                  {selectedItem.shipping_company}の配送状況ページを開く
                </Button>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDetailOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}

/* ─── SETTINGS (matches Settings.tsx) ─── */
function SettingsTab() {
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [profile, setProfile] = useState({
    name: 'デモ ユーザー', email: 'demo@example.com', phone: '090-1234-5678',
    postal_code: '150-0001', prefecture: '東京都', city: '渋谷区',
    address_line1: '神宮前1-2-3', address_line2: 'メダカハイツ101',
  });
  const [notifications, setNotifications] = useState({
    email_won_item: true, email_payment_confirmed: true, email_shipping: true,
    email_new_auction: true, email_auction_start: true,
  });

  const handleProfileChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [field]: e.target.value });
  };

  function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
    return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>アカウント設定</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>プロフィールと通知設定を管理します</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: '#3B82F6', fontSize: '2rem', mx: 'auto', mb: 2 }}>
                {profile.name.charAt(0)}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{profile.name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{profile.email}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={9}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab icon={<PersonIcon />} label="プロフィール" iconPosition="start" />
                <Tab icon={<NotificationsIcon />} label="通知設定" iconPosition="start" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>基本情報</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth required label="お名前" value={profile.name} onChange={handleProfileChange('name')} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="メールアドレス" value={profile.email} disabled helperText="メールアドレスは変更できません" />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="電話番号" value={profile.phone} onChange={handleProfileChange('phone')} />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 4 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <SettingsIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>配送先住所（デフォルト）</Typography>
                </Box>
                <Alert severity="info" sx={{ mb: 3 }}>落札時の配送先として使用されます。落札ごとに変更することも可能です。</Alert>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <TextField fullWidth label="郵便番号" value={profile.postal_code} onChange={handleProfileChange('postal_code')} placeholder="123-4567" />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField fullWidth label="都道府県" value={profile.prefecture} onChange={handleProfileChange('prefecture')} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="市区町村" value={profile.city} onChange={handleProfileChange('city')} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="住所1" value={profile.address_line1} onChange={handleProfileChange('address_line1')} placeholder="番地・丁目" />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="住所2（建物名など）" value={profile.address_line2} onChange={handleProfileChange('address_line2')} placeholder="マンション名・部屋番号" />
                  </Grid>
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button variant="contained" size="large" startIcon={<SaveIcon />}
                    onClick={() => setSnackbar({ open: true, message: 'プロフィールを保存しました。', severity: 'success' })}>
                    変更を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <NotificationsIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>メール通知設定</Typography>
                </Box>
                <Alert severity="info" sx={{ mb: 3 }}>受け取りたいメール通知を選択してください。重要なお知らせは設定に関わらず送信されます。</Alert>

                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#059669' }}>取引に関する通知</Typography>
                  {[
                    { key: 'email_won_item', label: '落札通知', desc: '商品を落札した際にメールでお知らせします' },
                    { key: 'email_payment_confirmed', label: '入金確認通知', desc: '入金が確認された際にメールでお知らせします' },
                    { key: 'email_shipping', label: '発送通知', desc: '商品が発送された際にメールでお知らせします' },
                  ].map(({ key, label, desc }) => (
                    <Box key={key}>
                      <FormControlLabel
                        control={<Switch checked={(notifications as any)[key]} onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })} />}
                        label={label}
                      />
                      <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>{desc}</Typography>
                    </Box>
                  ))}
                </Box>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#3B82F6' }}>オークションに関する通知</Typography>
                  {[
                    { key: 'email_new_auction', label: '新規オークション通知', desc: '新しいオークションが開催される際にメールでお知らせします' },
                    { key: 'email_auction_start', label: 'オークション開始通知', desc: 'オークションが開始された際にメールでお知らせします' },
                  ].map(({ key, label, desc }) => (
                    <Box key={key}>
                      <FormControlLabel
                        control={<Switch checked={(notifications as any)[key]} onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })} />}
                        label={label}
                      />
                      <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>{desc}</Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button variant="contained" size="large" startIcon={<SaveIcon />}
                    onClick={() => setSnackbar({ open: true, message: '通知設定を保存しました。', severity: 'success' })}>
                    通知設定を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
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

  // Shared state across pages
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set([2, 5, 7]));
  const [limitSettings, setLimitSettings] = useState<Record<number, { limit_price: number | null; is_triggered: boolean }>>({});

  // ─── Live demo state ───
  const [lanes, setLanes] = useState<LiveLane[]>(JSON.parse(JSON.stringify(INITIAL_LANES)));
  const [upcoming, setUpcoming] = useState(MOCK_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<{ species_name: string; winning_price: number; quantity: number; total_amount: number }[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [upcomingDetailItem, setUpcomingDetailItem] = useState<(UpcomingItem & { laneNumber: number }) | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  // Tour refs
  const demoHeaderRef = useRef<HTMLDivElement>(null);
  const laneCardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const lane1Ref = useRef<HTMLDivElement | null>(null);
  const lane2Ref = useRef<HTMLDivElement | null>(null);
  const lane3Ref = useRef<HTMLDivElement | null>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const wonTableRef = useRef<HTMLDivElement>(null);

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

  // Auto-simulation: start countdowns and random opponent bids on live page
  useEffect(() => {
    if (currentPage !== 'live') return;
    // Start countdowns for all lanes
    lanes.forEach(lane => {
      if (lane.current_item && lane.current_item.phase === 'bidding' && lane.current_item.countdown_seconds > 0) {
        startCountdown(lane.lane_id);
      }
    });
    // Random opponent bids every 5-10 seconds
    const autoInterval = setInterval(() => {
      const randomLaneId = [1, 2, 3][Math.floor(Math.random() * 3)];
      simulateOpponentBid(randomLaneId);
    }, 5000 + Math.random() * 5000);
    return () => clearInterval(autoInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

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
      if (tourActive && tourStep === 2) {
        setTimeout(() => setTourStep(3), 1200);
      }
    }
  }, [lanes, notify, updateLaneItem, startCountdown, tourActive, tourStep]);

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

  const simulateFreeze = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, item => {
      const inc = Math.max(100, Math.round(item.current_price * 0.1));
      return { ...item, phase: 'freeze' as const, freeze_remaining_seconds: 3, freeze_countdown_seconds: 3, current_price: item.current_price + inc, active_bidders_count: Math.max(2, item.active_bidders_count) };
    });
    notify('フリーズ中！入札ボタンが一時的に無効になります', 'warning');
    let remaining = 3;
    const ft = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(ft);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
        startCountdown(laneId, 15);
        notify('フリーズ解除！入札可能になりました', 'success');
      } else {
        updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulatePreBid = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, () => makeLaneItem({
      id: 7, species_name: '三色ラメ 新着', current_price: 4500, quantity: 3,
      phase: 'pre_bid', pre_bid_remaining_seconds: 5, countdown_seconds: 15,
      my_bid_status: null, active_bidders_count: 0, seller_name: 'ブリーダーD',
    }));
    notify('新商品がレーンに登場！入札開始まで待機中...', 'info');
    let remaining = 5;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', pre_bid_remaining_seconds: 0 }));
        startCountdown(laneId, 15);
        notify('入札開始！入札できるようになりました', 'success');
      } else {
        updateLaneItem(laneId, item => ({ ...item, pre_bid_remaining_seconds: remaining }));
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

  const simulateMultipleOpponentBids = useCallback(async (laneId: number, count: number) => {
    notify('他の参加者が入札！価格が上昇しています...', 'warning');
    for (let i = 0; i < count; i++) {
      await new Promise<void>(resolve => {
        stopTimer(laneId);
        updateLaneItem(laneId, item => {
          const inc = Math.max(100, Math.round(item.current_price * 0.1));
          return { ...item, phase: 'freeze' as const, freeze_remaining_seconds: 1, freeze_countdown_seconds: 1, current_price: item.current_price + inc, active_bidders_count: Math.max(2, item.active_bidders_count) };
        });
        setTimeout(() => {
          updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
          startCountdown(laneId, 15);
          resolve();
        }, 1000);
      });
      if (i < count - 1) await new Promise(r => setTimeout(r, 300));
    }
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulateLimitTrigger = useCallback(() => {
    const lane1 = lanes.find(l => l.lane_id === 1);
    const limitPrice = lane1?.current_item?.my_limit_price;
    if (!limitPrice) { notify('先にレーン1で指値を設定してください', 'error'); return; }
    let currentPrice = lane1!.current_item!.current_price;
    const steps: number[] = [];
    while (currentPrice < limitPrice) {
      const inc = Math.max(100, Math.round(currentPrice * 0.1));
      currentPrice += inc;
      steps.push(currentPrice);
    }
    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        updateLaneItem(1, item => ({ ...item, my_bid_status: 'inactive', my_limit_triggered: true }));
        notify('指値に到達！自動で入札がオフになりました', 'error');
        return;
      }
      updateLaneItem(1, item => ({ ...item, current_price: steps[i], active_bidders_count: Math.max(2, item.active_bidders_count) }));
      notify(`他の参加者が入札！ ¥${steps[i].toLocaleString()}`, 'warning');
      i++;
    }, 800);
  }, [lanes, updateLaneItem, notify]);

  const handleLiveReset = useCallback(() => {
    stopAllTimers();
    setLanes(JSON.parse(JSON.stringify(INITIAL_LANES)));
    setUpcoming(MOCK_UPCOMING.map(u => ({ ...u })));
    setWonItems([]);
    setCelebration(null);
    setLimitModalLaneId(null);
    setTourActive(false);
    setTourStep(0);
    setIsAutoPlaying(false);
  }, [stopAllTimers]);

  // Sync lane refs
  useEffect(() => {
    lane1Ref.current = laneCardRefs.current[0];
    lane2Ref.current = laneCardRefs.current[1];
    lane3Ref.current = laneCardRefs.current[2];
  });

  // ─── Tour steps ───
  const tourSteps: TourStep[] = [
    { targetRef: demoHeaderRef, title: 'オークション体験デモへようこそ！', description: 'このデモでは、実際のオークション画面を操作しながら、入札の流れを体験できます。吹き出しの指示に従って進めてください。', placement: 'bottom' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: 'レーンカードの見方', description: '各レーンには品種名、現在価格、カウントダウンが表示されています。3つのレーンが同時に進行するのがこのオークションの特徴です。', placement: 'right' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '入札してみよう！', description: 'レーン1の「入札する」ボタンをタップしてみてください！カードが金色に光り「最高入札者」バッジが表示されます。', placement: 'right', waitForAction: 'レーン1の「入札する」をタップ' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '他の参加者が入札してきた！', description: '他の参加者がレーン1に入札してきます。フリーズ（誤タップ防止）が3秒入った後、価格が上がりカウントダウンがリセットされる様子を確認してください。', placement: 'right', autoAction: () => { simulateOpponentBid(1); }, autoActionDelay: 4500 },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '入札合戦！連続入札が発生', description: '複数の参加者が連続で入札してきます。入札のたびに短いフリーズが発生し、価格が競り上がっていきます。', placement: 'right', autoAction: () => { simulateMultipleOpponentBids(1, 3); }, autoActionDelay: 5000 },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: 'フリーズ（誤タップ防止）', description: '価格上昇直後、数秒間入札ボタンが無効になる「フリーズ」状態になります。誤タップを防ぐ安全機能です。', placement: 'right', autoAction: () => { simulateFreeze(1); }, autoActionDelay: 4000 },
    { targetRef: lane3Ref as React.RefObject<HTMLDivElement | null>, title: '新商品の入札開始待機', description: 'レーン3に新しい商品が来ました。入札開始まで数秒間の待機（プレビッド）フェーズがあります。', placement: 'left', autoAction: () => { simulatePreBid(3); }, autoActionDelay: 6000 },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '指値（上限価格）を設定しよう', description: '指値を設定すると、価格がその金額に達したとき自動で入札がオフになります。レーン1の「上限設定」ボタンを押してみてください。', placement: 'right', waitForAction: 'レーン1の「上限設定」をタップ' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '指値が発動！自動入札オフ', description: '相手が連続入札して指値に到達します。自動で入札がオフになる様子を確認してください。', placement: 'right', autoAction: () => { simulateLimitTrigger(); }, autoActionDelay: 3000 },
    { targetRef: upcomingRef, title: '次の商品を確認', description: '下にスクロールすると「次の商品」を確認できます。お気に入り登録もできるので、気になる商品を事前にチェックしておきましょう。', placement: 'top' },
    { targetRef: lane2Ref as React.RefObject<HTMLDivElement | null>, title: '落札の瞬間！', description: 'レーン2を落札します。紙吹雪の落札演出と結果テーブルが表示されます。おめでとうございます！', placement: 'left', autoAction: () => { updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 })); setTimeout(() => handleWin(), 500); }, autoActionDelay: 4500 },
    { targetRef: wonTableRef, title: 'デモ完了！お疲れさまでした', description: '落札結果がここに表示されます。実際のオークションでも同様の流れで進みます。「最初から」ボタンで何度でも練習できます。', placement: 'top' },
  ];

  const handleTourNext = useCallback(() => {
    const nextStep = tourStep + 1;
    if (nextStep >= tourSteps.length) return;
    const step = tourSteps[nextStep];
    if (step.autoAction) {
      setIsAutoPlaying(true);
      setTourStep(nextStep);
      step.autoAction();
      setTimeout(() => setIsAutoPlaying(false), step.autoActionDelay || 1500);
    } else {
      setTourStep(nextStep);
    }
  }, [tourStep, tourSteps]);

  const handleTourPrev = useCallback(() => {
    if (tourStep > 0) setTourStep(tourStep - 1);
  }, [tourStep]);

  const handleTourClose = useCallback(() => {
    setTourActive(false);
    setTourStep(0);
  }, []);

  const handleStartTour = useCallback(() => {
    handleLiveReset();
    setTimeout(() => { setTourActive(true); setTourStep(0); }, 100);
  }, [handleLiveReset]);

  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItemData = limitModalLane?.current_item;

  const handleSetLimit = useCallback((price: number) => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: price, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定しました`, 'success');
    if (tourActive && tourStep === 7) {
      setTimeout(() => setTourStep(8), 800);
    }
  }, [limitModalLaneId, updateLaneItem, notify, tourActive, tourStep]);

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

  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  }, []);

  // Menu items
  const menuItems = [
    { text: 'ホーム', icon: <HomeIcon />, page: 'home' },
    { text: 'オークション', icon: <GavelIcon />, page: 'auctions' },
    { text: '出品一覧', icon: <InventoryIcon />, page: 'items' },
    { text: 'お気に入り', icon: <FavoriteIcon />, page: 'favorites' },
    { text: '落札管理', icon: <ReceiptIcon />, page: 'won-items' },
    { text: '会場', icon: <PlayArrowIcon />, page: 'live' },
    { text: 'デモ', icon: <DemoIcon />, page: 'demo' },
    { text: '設定', icon: <SettingsIcon />, page: 'settings' },
  ];

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {celebration && <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />}

      {/* AppBar */}
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src="/img/logo.png" alt="MEDAKA AUCTION PORT"
              onClick={() => handleNavigate('home')}
              sx={{ height: 48, width: '100%', maxWidth: 200, objectFit: 'contain', cursor: 'pointer' }} />
            <Chip label="PRESENTATION" size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: '0.65rem' }} />
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
            {menuItems.map((item) => (
              <Button key={item.page} color="inherit" onClick={() => handleNavigate(item.page)}
                sx={{ borderBottom: currentPage === item.page ? 2 : 0, borderRadius: 0 }}>
                {item.text}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 250 }} role="presentation">
          <Box sx={{ p: 2 }}><Typography variant="h6">メニュー</Typography></Box>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.page} disablePadding>
                <ListItemButton selected={currentPage === item.page}
                  onClick={() => { handleNavigate(item.page); setDrawerOpen(false); }}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* LIVE banner (shown on non-home, non-demo, non-live pages) */}
      {currentPage !== 'home' && currentPage !== 'demo' && currentPage !== 'live' && (
        <Box sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)', color: 'white', py: { xs: 3, md: 4 }, px: 2 }}>
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
            <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} onClick={() => handleNavigate('live')}
              sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'grey.100' } }}>
              今すぐ参加する
            </Button>
          </Container>
        </Box>
      )}

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        {currentPage === 'home' && <HomeTab onNavigate={handleNavigate} />}
        {currentPage === 'auctions' && <AuctionListTab onNavigate={handleNavigate} />}
        {currentPage === 'items' && (
          <ItemListTab favoriteIds={favoriteIds} setFavoriteIds={setFavoriteIds}
            limitSettings={limitSettings} setLimitSettings={setLimitSettings} onNavigate={handleNavigate} />
        )}
        {currentPage === 'favorites' && (
          <FavoritesTab favoriteIds={favoriteIds} setFavoriteIds={setFavoriteIds}
            limitSettings={limitSettings} setLimitSettings={setLimitSettings} onNavigate={handleNavigate} />
        )}
        {currentPage === 'won-items' && <WonItemsTab />}
        {currentPage === 'settings' && <SettingsTab />}

        {/* LIVE AUCTION PAGE (realistic simulation) */}
        {currentPage === 'live' && (
          <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
            {/* Live header */}
            <Box sx={{ background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)', color: 'white', py: 2, px: 2 }}>
              <Container maxWidth="xl">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.75,
                    bgcolor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1,
                    fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
                    animation: 'livePulse2 2s infinite',
                    '@keyframes livePulse2': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                    LIVE
                  </Box>
                  <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                    2026年春季メダカオークション
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {wonItems.length > 0 ? `落札: ${wonItems.length}件 | 合計: ¥${wonTotal.toLocaleString()}` : 'リアルタイムで入札が進行中です'}
                </Typography>
              </Container>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3 }}>
              {/* Lane grid */}
              <Grid container spacing={2}>
                {lanes.map(lane => (
                  <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                    <LaneCard
                      lane={lane} isLoading={false}
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
                          <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setUpcomingDetailItem(item)}>
                            <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => toggleUpcomingFav(item.id)} sx={{ p: 0.25 }}>
                            {item.is_favorited ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
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

              {/* Won items */}
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
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>¥{wonTotal.toLocaleString()}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button size="small" variant="text" color="inherit" onClick={handleLiveReset}>リセット</Button>
                <Button size="small" variant="text" onClick={() => handleNavigate('items')}>出品一覧</Button>
                <Button size="small" variant="text" onClick={() => handleNavigate('demo')}>デモモード</Button>
              </Box>
            </Container>
          </Box>
        )}

        {/* DEMO PAGE */}
        {currentPage === 'demo' && (
          <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
            {/* Demo header */}
            <Box ref={demoHeaderRef} sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)', color: 'white', py: 3, px: 2 }}>
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
                {!tourActive && (
                  <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={handleStartTour}
                    sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'grey.100' } }}>
                    ガイド付きデモを開始
                  </Button>
                )}
                {tourActive && (
                  <Chip label={`ガイド進行中 (${tourStep + 1}/${tourSteps.length})`}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: '0.85rem' }} />
                )}
              </Container>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3 }}>
              {/* Lane grid */}
              <Grid container spacing={2}>
                {lanes.map((lane, idx) => (
                  <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                    <Box ref={(el: HTMLDivElement | null) => { laneCardRefs.current[idx] = el; }}>
                      <LaneCard
                        lane={lane} isLoading={false}
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
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* Upcoming items */}
              <Paper ref={upcomingRef} sx={{ mt: 3, p: 2 }}>
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
                          <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setUpcomingDetailItem(item)}>
                            <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => toggleUpcomingFav(item.id)} sx={{ p: 0.25 }}>
                            {item.is_favorited ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
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

              {/* Won items table */}
              <Box ref={wonTableRef}>
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
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>¥{wonTotal.toLocaleString()}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}
                {wonItems.length === 0 && (
                  <Paper sx={{ mt: 3, p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary" align="center">落札した商品がここに表示されます</Typography>
                  </Paper>
                )}
              </Box>

              {/* Free mode controls (hidden during tour) */}
              {!tourActive && (
                <Paper sx={{ mt: 3, p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>フリーモード — 自由に操作できます</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    ガイドなしで自由に操作できます。「ガイド付きデモを開始」ボタンでチュートリアルを再開できます。
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(1)}>レーン1に他者入札</Button>
                    <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(2)}>レーン2に他者入札</Button>
                    <Button size="small" variant="outlined" onClick={() => simulateFreeze(1)}>フリーズ体験</Button>
                    <Button size="small" variant="outlined" onClick={() => simulatePreBid(3)}>新商品登場</Button>
                    <Button size="small" variant="outlined" onClick={() => {
                      updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 }));
                      setTimeout(() => handleWin(), 500);
                    }}>落札体験</Button>
                    <Button size="small" variant="outlined" color="secondary" onClick={handleLiveReset}>リセット</Button>
                  </Box>
                </Paper>
              )}
            </Container>

            {/* Tour popover */}
            {tourActive && (
              <DemoTourPopover
                steps={tourSteps}
                activeStep={tourStep}
                onNext={handleTourNext}
                onPrev={handleTourPrev}
                onClose={handleTourClose}
                onReset={handleStartTour}
                isAutoPlaying={isAutoPlaying}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
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
            &copy; 2025 メダカオークション運営事務局
          </Typography>
        </Container>
      </Box>

      {/* Upcoming item detail dialog */}
      <Dialog open={!!upcomingDetailItem} onClose={() => setUpcomingDetailItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">No.{upcomingDetailItem?.item_number} {upcomingDetailItem?.species_name}</Typography>
            <IconButton onClick={() => setUpcomingDetailItem(null)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100', mb: 2 }}>
            <img src={upcomingDetailItem?.thumbnail_path || '/img/noimage.png'} alt={upcomingDetailItem?.species_name}
              style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {upcomingDetailItem?.is_premium && <Chip label="プレミアム" color="warning" />}
            <Chip label={`レーン ${upcomingDetailItem?.laneNumber}`} color="primary" variant="outlined" />
          </Box>
          <Typography variant="h5" color="primary.main" fontWeight="bold" gutterBottom>
            ¥{(upcomingDetailItem?.start_price ?? 0).toLocaleString()}〜
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>匹数</Typography>
          <Typography variant="body1">{upcomingDetailItem?.quantity}匹セット</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpcomingDetailItem(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* BidLimitModal for demo lanes */}
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

      {/* Global snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
