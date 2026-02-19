import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  Chip,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  People as PeopleIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  EmojiEvents as EmojiEventsIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

interface LaneItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  quantity_unit?: string;
  current_price: number;
  estimated_price?: number;
  inspection_info?: string;
  individual_info?: string;
  is_premium: boolean;
  thumbnail_path?: string;
  media?: any[];
  active_bidders_count: number;
  countdown_seconds: number;
  my_bid_status: 'active' | 'inactive' | null;
  phase?: 'bidding' | 'pre_bid';
  pre_bid_remaining_seconds?: number;
  countdown_mode?: 'default' | 'competitive';
}

interface Lane {
  lane_id: number;
  lane_number: number;
  lane_name: string | null;
  status: string;
  current_item: LaneItem | null;
}

interface LiveState {
  auction_id: number;
  auction_title: string;
  status: string;
  countdown_seconds: number;
  starting_countdown?: number;
  entrance_allowed?: boolean;
  entrance_at?: string;
  start_at?: string;
  venue_open_minutes_before_start?: number;
  message?: string;
  lanes: Lane[];
}

interface WonItemSummary {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  quantity_unit?: string;
  winning_price: number;
  total_amount: number;
}

export default function AuctionLive() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LaneItem | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [bidLoading, setBidLoading] = useState<Record<number, boolean>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [isPollingPaused] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [showConsentScreen, setShowConsentScreen] = useState(false);

  // 待機室・カウントダウン
  const [startingCountdown, setStartingCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 入室不可状態
  const [entranceAllowed, setEntranceAllowed] = useState<boolean>(true);
  const [entranceAt, setEntranceAt] = useState<string | null>(null);
  const [entranceCountdown, setEntranceCountdown] = useState<string | null>(null);
  const entranceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 落札一覧
  const [wonItems, setWonItems] = useState<WonItemSummary[]>([]);
  const [wonTotalAmount, setWonTotalAmount] = useState(0);

  // 紙吹雪演出
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationItem, setCelebrationItem] = useState<{ species_name: string; winning_price: number } | null>(null);

  // 動画全画面再生
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoDialogUrl, setVideoDialogUrl] = useState('');

  // 紙吹雪を発射
  const fireCelebration = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff', '#9900ff'],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff', '#9900ff'],
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // 中央からも大きく発射
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff', '#9900ff', '#ff69b4'],
    });
  }, []);

  // 落札一覧を取得
  const fetchWonItems = useCallback(async () => {
    try {
      const response = await axios.get(`/api/participant/auctions/${auctionId}/my-won-items`);
      if (response.data.success) {
        setWonItems(response.data.data.items);
        setWonTotalAmount(response.data.data.total_amount);
      }
    } catch (err) {
      console.error('落札一覧取得エラー:', err);
    }
  }, [auctionId]);

  // ライブ状態を取得
  const fetchLiveState = useCallback(async () => {
    if (isPollingPaused || Object.values(bidLoading).some(Boolean)) {
      return;
    }
    
    try {
      const response = await axios.get(`/api/participant/auctions/${auctionId}/live`);
      if (response.data.success) {
        const data = response.data.data;
        setLiveState(data);
        setError(null);

        // 入室可否判定
        if (data.entrance_allowed !== undefined) {
          setEntranceAllowed(data.entrance_allowed);
          if (!data.entrance_allowed && data.entrance_at) {
            setEntranceAt(data.entrance_at);
          } else {
            setEntranceAt(null);
          }
        }

        // 同意画面の表示設定を取得
        if (data.show_consent_screen !== undefined) {
          setShowConsentScreen(data.show_consent_screen);
        }

        // 開始カウントダウン中の場合
        if (data.status === 'starting' && data.starting_countdown) {
          setStartingCountdown(data.starting_countdown);
        }
      }
    } catch (err: any) {
      console.error('ライブ状態取得エラー:', err);
      if (err.response?.status === 400) {
        setError('オークションが開催中ではありません。');
      } else {
        setError('データの取得に失敗しました。');
      }
    } finally {
      setLoading(false);
    }
  }, [auctionId, isPollingPaused, bidLoading]);

  useEffect(() => {
    fetchLiveState();
    fetchWonItems();
  }, [auctionId]);

  // 入室不可のカウントダウン表示
  useEffect(() => {
    if (!entranceAllowed && entranceAt) {
      const updateCountdown = () => {
        const target = new Date(entranceAt).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((target - now) / 1000));
        if (diff <= 0) {
          setEntranceCountdown(null);
          setEntranceAllowed(true);
          fetchLiveState();
          if (entranceIntervalRef.current) {
            clearInterval(entranceIntervalRef.current);
            entranceIntervalRef.current = null;
          }
          return;
        }
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        if (hours > 0) {
          setEntranceCountdown(`${hours}時間${minutes}分${seconds.toString().padStart(2, '0')}秒`);
        } else if (minutes > 0) {
          setEntranceCountdown(`${minutes}分${seconds.toString().padStart(2, '0')}秒`);
        } else {
          setEntranceCountdown(`${seconds}秒`);
        }
      };

      updateCountdown();
      entranceIntervalRef.current = setInterval(updateCountdown, 1000);

      return () => {
        if (entranceIntervalRef.current) {
          clearInterval(entranceIntervalRef.current);
          entranceIntervalRef.current = null;
        }
      };
    }
  }, [entranceAllowed, entranceAt]);

  // 待機室用ポーリング（scheduledの場合のみ）
  useEffect(() => {
    if (liveState?.status === 'scheduled' && entranceAllowed) {
      const interval = setInterval(fetchLiveState, 5000);
      return () => clearInterval(interval);
    } else if (liveState?.status === 'scheduled' && !entranceAllowed) {
      // 入室不可の場合は30秒ごとにポーリング
      const interval = setInterval(fetchLiveState, 30000);
      return () => clearInterval(interval);
    }
  }, [liveState?.status, entranceAllowed, fetchLiveState]);

  // 開始カウントダウンタイマー
  useEffect(() => {
    if (startingCountdown !== null && startingCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setStartingCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    }
  }, [startingCountdown !== null && startingCountdown > 0]);

  // WebSocket連携
  useAuctionSocket({
    auctionId: Number(auctionId),
    onPriceUpdated: (event) => {
      setLiveState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: prev.lanes.map((lane) =>
            lane.lane_id === event.lane_id && lane.current_item
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    current_price: event.new_price,
                    active_bidders_count: event.active_bidders_count,
                    countdown_seconds: event.countdown_seconds,
                  },
                }
              : lane
          ),
        };
      });
      setSocketConnected(true);
    },
    onBidderUpdated: (event) => {
      setLiveState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: prev.lanes.map((lane) =>
            lane.lane_id === event.lane_id && lane.current_item
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    active_bidders_count: event.active_bidders_count,
                  },
                }
              : lane
          ),
        };
      });
      setSocketConnected(true);
    },
    onLaneChanged: (event) => {
      setLiveState((prev) => {
        if (!prev) return prev;
        const preBidRemaining = (event.current_item as any)?.pre_bid_remaining_seconds || 0;
        return {
          ...prev,
          lanes: prev.lanes.map((lane) =>
            lane.lane_id === event.lane_id
              ? {
                  ...lane,
                  current_item: event.current_item ? {
                    id: event.current_item.id,
                    item_number: event.current_item.item_number,
                    species_name: event.current_item.species_name,
                    quantity: event.current_item.quantity,
                    current_price: event.current_item.current_price,
                    is_premium: event.current_item.is_premium,
                    thumbnail_path: event.current_item.thumbnail_path,
                    active_bidders_count: (event.current_item as any).active_bidders_count || 0,
                    countdown_seconds: prev.countdown_seconds,
                    my_bid_status: null,
                    estimated_price: event.current_item.estimated_price,
                    inspection_info: event.current_item.inspection_info,
                    individual_info: event.current_item.individual_info,
                    media: (event.current_item as any).media,
                    phase: preBidRemaining > 0 ? 'pre_bid' : 'bidding',
                    pre_bid_remaining_seconds: preBidRemaining,
                  } as LaneItem : null,
                  status: event.current_item ? 'active' : 'finished',
                }
              : lane
          ),
        };
      });
      setSocketConnected(true);
    },
    onItemSold: (event) => {
      // 自分が落札した場合
      if (event.winner_id === user?.id) {
        // 紙吹雪演出
        setCelebrationItem({
          species_name: event.species_name || '商品',
          winning_price: event.winning_price,
        });
        setShowCelebration(true);
        fireCelebration();

        // 3秒後に演出を非表示
        setTimeout(() => {
          setShowCelebration(false);
          setCelebrationItem(null);
        }, 4000);

        // 落札一覧を更新
        fetchWonItems();

        setSnackbar({
          open: true,
          message: `🎉 おめでとうございます！${event.species_name || '商品'}を落札しました！`,
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: '商品が落札されました',
          severity: 'success',
        });
      }
      setSocketConnected(true);
    },
    onAuctionStatus: (event) => {
      if (event.status === 'starting' && event.countdown_seconds) {
        // 開始カウントダウン
        setStartingCountdown(event.countdown_seconds);
        setLiveState((prev) => prev ? { ...prev, status: 'starting' } : prev);
      } else if (event.status === 'live') {
        // オークション開始
        setStartingCountdown(0);
        fetchLiveState();
      } else if (event.status === 'finished') {
        // オークション終了
        fetchLiveState();
        fetchWonItems();
        setSnackbar({
          open: true,
          message: event.message || 'オークションが終了しました',
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: event.message,
          severity: 'success',
        });
        fetchLiveState();
      }
      setSocketConnected(true);
    },
    onCountdownTick: (event) => {
      setLiveState((prev) => {
        if (!prev) return prev;
        const phase = (event as any).phase || 'bidding';
        return {
          ...prev,
          lanes: prev.lanes.map((lane) =>
            lane.lane_id === event.lane_id && lane.current_item
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    countdown_seconds: phase === 'pre_bid' ? lane.current_item.countdown_seconds : event.remaining_seconds,
                    active_bidders_count: event.active_bidders_count,
                    current_price: event.current_price,
                    phase: phase,
                    pre_bid_remaining_seconds: phase === 'pre_bid' ? event.remaining_seconds : 0,
                  },
                }
              : lane
          ),
        };
      });
      setSocketConnected(true);
    },
  });

  // 入札ON/OFF切り替え
  const handleBidToggle = async (itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    // pre_bidフェーズの場合は入札を受け付けない
    const currentLane = liveState?.lanes.find(l => l.current_item?.id === itemId);
    if (currentLane?.current_item?.phase === 'pre_bid') {
      setSnackbar({
        open: true,
        message: '入札開始待機中です。もう少々お待ちください。',
        severity: 'error',
      });
      return;
    }

    const newStatus = currentStatus !== 'active';
    setBidLoading((prev) => ({ ...prev, [itemId]: true }));

    try {
      const response = await axios.post('/api/participant/bids', {
        item_id: itemId,
        is_active: newStatus,
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: newStatus ? '入札に参加しました' : '入札から離脱しました',
          severity: 'success',
        });
        await fetchLiveState();
      }
    } catch (err: any) {
      console.error('入札切り替えエラー:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || '入札の切り替えに失敗しました',
        severity: 'error',
      });
    } finally {
      setBidLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDetailOpen = (item: LaneItem) => {
    setSelectedItem(item);
    setSelectedMediaIndex(0);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
    setSelectedMediaIndex(0);
  };

  // S3ベースURLを推測して相対パスをフルURLに変換
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

  // メディア一覧を構築
  const getMediaList = (item: LaneItem | null) => {
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

  // カウントダウン秒数のフォーマット（0.5秒対応）
  const formatCountdownSeconds = (seconds: number): string => {
    if (seconds <= 0) return '0秒';
    if (Number.isInteger(seconds)) {
      return `${seconds}秒`;
    }
    return `${seconds.toFixed(1)}秒`;
  };

  // 入札者数表示コンポーネント
  const BidderCountDisplay = ({ count }: { count: number }) => {
    if (count === 0) return null;
    return (
      <Chip
        icon={<PeopleIcon />}
        label="入札中"
        size="small"
        color="error"
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/participant')}>
          ホームに戻る
        </Button>
      </Container>
    );
  }

  if (!liveState) {
    return null;
  }

  // ======== 入室不可画面 ========
  if (liveState.status === 'scheduled' && !entranceAllowed) {
    return (
      <Box sx={{
        bgcolor: 'grey.100',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Paper elevation={6} sx={{ maxWidth: 500, mx: 2, p: 5, textAlign: 'center', borderRadius: 3 }}>
          <TimerIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {liveState.auction_title}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            {liveState.message || `オークション開始${liveState.venue_open_minutes_before_start || 30}分前から入室できます`}
          </Typography>
          {entranceCountdown && (
            <Box sx={{
              bgcolor: 'warning.50',
              border: '2px solid',
              borderColor: 'warning.300',
              borderRadius: 2,
              p: 3,
              mb: 3,
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                入室可能まで
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="warning.main">
                {entranceCountdown}
              </Typography>
            </Box>
          )}
          {liveState.start_at && (
            <Typography variant="body2" color="text.secondary">
              オークション開始予定: {new Date(liveState.start_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
        </Paper>
      </Box>
    );
  }

  // ======== 待機室 ========
  if (liveState.status === 'scheduled') {
    return (
      <Box sx={{
        bgcolor: 'grey.100',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Paper elevation={6} sx={{ maxWidth: 500, mx: 2, p: 5, textAlign: 'center', borderRadius: 3 }}>
          <TimerIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {liveState.auction_title}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            オークション開始をお待ちください
          </Typography>
          <Box sx={{
            bgcolor: 'primary.50',
            border: '2px solid',
            borderColor: 'primary.200',
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}>
            <CircularProgress size={30} sx={{ mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              まもなく開始されます...
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            開始されると自動的に画面が切り替わります
          </Typography>
        </Paper>
      </Box>
    );
  }

  // ======== 開始カウントダウン ========
  if ((liveState.status === 'starting' || startingCountdown !== null) && startingCountdown !== null && startingCountdown > 0) {
    return (
      <Box sx={{
        bgcolor: '#1a1a2e',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <Typography variant="h5" sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}>
          {liveState.auction_title}
        </Typography>
        <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)', mb: 4 }}>
          オークションが間もなく開始されます
        </Typography>
        <Box sx={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          border: '6px solid',
          borderColor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
          animation: 'pulse 1s infinite',
          '@keyframes pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.5)' },
            '70%': { boxShadow: '0 0 0 30px rgba(25, 118, 210, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
          },
        }}>
          <Typography variant="h1" sx={{ color: 'white', fontWeight: 'bold', fontSize: '5rem' }}>
            {startingCountdown}
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          画像は同じ品種のイメージ画像です。実際の映像は詳細ボタンよりご確認ください。
        </Typography>
      </Box>
    );
  }

  // ======== オークション終了画面 ========
  if (liveState.status === 'finished') {
    return (
      <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
            <EmojiEventsIcon sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              オークション終了
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {liveState.auction_title}
            </Typography>
          </Paper>

          {wonItems.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon color="warning" />
                あなたの落札結果
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell>
                      <TableCell>品種</TableCell>
                      <TableCell align="right">単価</TableCell>
                      <TableCell align="right">数量</TableCell>
                      <TableCell align="right">合計(税込)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wonItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_number}</TableCell>
                        <TableCell>{item.species_name}</TableCell>
                        <TableCell align="right">
                          ¥{Math.floor(item.winning_price).toLocaleString()}
                          /1{item.quantity_unit === 'kg' ? 'kg' : 
                             item.quantity_unit === 'bag' ? '袋' : '匹'}
                        </TableCell>
                        <TableCell align="right">
                          {item.quantity}
                          {item.quantity_unit === 'kg' ? 'kg' : 
                           item.quantity_unit === 'bag' ? '袋' : '匹'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{Math.floor(item.total_amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        合計金額
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'primary.main' }}>
                        ¥{Math.floor(wonTotalAmount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Box sx={{ textAlign: 'center' }}>
            <Button variant="contained" size="large" onClick={() => navigate('/participant/won-items')}>
              落札管理へ
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  // 自分の入札中アイテムを取得
  const myActiveBids = liveState.lanes
    .filter((lane) => lane.current_item?.my_bid_status === 'active')
    .map((lane) => lane);

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* 同意画面オーバーレイ */}
      {showConsentScreen && !agreed && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              bgcolor: 'rgba(0,0,0,0.4)',
            }}
          />
          <Paper
            elevation={8}
            sx={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 480,
              mx: 2,
              p: 4,
              borderRadius: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              ご確認ください
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
              画像は同じ品種のイメージ画像です。実際の映像は詳細ボタンよりご確認ください。
            </Typography>
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => setAgreed(true)}
              sx={{ py: 1.5, fontWeight: 'bold', fontSize: '1rem' }}
            >
              同意してオークションに参加する
            </Button>
          </Paper>
        </Box>
      )}

      {/* 落札おめでとう演出 */}
      {showCelebration && celebrationItem && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Paper
            elevation={12}
            sx={{
              p: 4,
              borderRadius: 3,
              textAlign: 'center',
              bgcolor: 'rgba(255,255,255,0.95)',
              border: '3px solid',
              borderColor: 'warning.main',
              animation: 'celebrationPop 0.5s ease-out',
              '@keyframes celebrationPop': {
                '0%': { transform: 'scale(0.5)', opacity: 0 },
                '50%': { transform: 'scale(1.1)' },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
            }}
          >
            <Typography variant="h2" sx={{ mb: 1 }}>🎉</Typography>
            <Typography variant="h5" fontWeight="bold" color="warning.dark" gutterBottom>
              落札おめでとうございます！
            </Typography>
            <Typography variant="h6" gutterBottom>
              {celebrationItem.species_name}
            </Typography>
            <Typography variant="h4" color="primary.main" fontWeight="bold">
              ¥{Math.floor(celebrationItem.winning_price).toLocaleString()}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {liveState.auction_title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {liveState.lanes.filter(l => l.status === 'active').length}/{liveState.lanes.length}レーン進行中
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={fetchLiveState} title="更新">
                <RefreshIcon />
              </IconButton>
              <Chip
                label={socketConnected ? 'リアルタイム接続中' : 'ポーリング中'}
                color={socketConnected ? 'success' : 'warning'}
                icon={socketConnected ? <WifiIcon /> : <WifiOffIcon />}
                size="small"
              />
              <Chip label="開催中" color="success" icon={<PlayArrowIcon />} />
            </Box>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {liveState.lanes.map((lane) => (
            <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
              {lane.current_item ? (
                <Card
                  sx={{
                    height: '100%',
                    border: lane.current_item.my_bid_status === 'active' ? 3 : 1,
                    borderColor: lane.current_item.my_bid_status === 'active' ? 'success.main' : 'divider',
                    position: 'relative',
                  }}
                >
                  {/* レーン番号 */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      bgcolor: 'primary.main',
                      color: 'white',
                      px: 2,
                      py: 0.5,
                      borderRadius: 1,
                      fontWeight: 'bold',
                      zIndex: 1,
                      fontSize: '0.85rem',
                    }}
                  >
                    レーン {lane.lane_number}{lane.lane_name ? ` (${lane.lane_name})` : ''}
                  </Box>

                  {/* プレミアムバッジ */}
                  {lane.current_item.is_premium && (
                    <Chip
                      label="プレミアム"
                      color="warning"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* サムネイル */}
                  <CardMedia
                    component="img"
                    image={lane.current_item.thumbnail_path || '/img/noimage.png'}
                    alt={lane.current_item.species_name}
                    sx={{ aspectRatio: '3/2', objectFit: 'cover' }}
                  />

                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      No.{lane.current_item.item_number}
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                      {lane.current_item.species_name}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        現在単価
                      </Typography>
                      <Typography variant="h4" color="primary.main" fontWeight="bold">
                        ¥{Math.floor(lane.current_item.current_price).toLocaleString()}
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          /1{lane.current_item.quantity_unit === 'kg' ? 'kg' : 
                             lane.current_item.quantity_unit === 'bag' ? '袋' : '匹'}
                        </Typography>
                      </Typography>
                    </Box>

                    {lane.current_item.phase === 'pre_bid' ? (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        mb: 1,
                        bgcolor: 'info.50',
                        border: '2px solid',
                        borderColor: 'info.200',
                        borderRadius: 1,
                        p: 1.5,
                      }}>
                        <TimerIcon sx={{ color: 'info.main', fontSize: 20 }} />
                        <Typography variant="body1" fontWeight="bold" color="info.main">
                          入札開始まで {formatCountdownSeconds(lane.current_item.pre_bid_remaining_seconds ?? 0)}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Chip
                          label={`残り ${formatCountdownSeconds(lane.current_item.countdown_seconds ?? (lane.current_item.active_bidders_count >= 2 ? 1 : 10))}`}
                          size="small"
                          color={
                            lane.current_item.active_bidders_count >= 2
                              ? 'error'
                              : (lane.current_item.countdown_seconds ?? 10) <= 3
                                ? 'warning'
                                : 'default'
                          }
                          sx={{
                            fontWeight: 'bold',
                            minWidth: 80,
                            ...(lane.current_item.active_bidders_count >= 2 && {
                              animation: 'pulse 0.5s infinite',
                              '@keyframes pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.7 },
                              },
                            }),
                          }}
                        />
                        <BidderCountDisplay count={lane.current_item.active_bidders_count} />
                      </Box>
                    )}
                  </CardContent>

                  <CardActions>
                    {lane.current_item.phase === 'pre_bid' ? (
                      <Button
                        fullWidth
                        variant="outlined"
                        color="inherit"
                        size="large"
                        disabled
                        startIcon={<TimerIcon />}
                      >
                        入札準備中...
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        variant={lane.current_item.my_bid_status === 'active' ? 'contained' : 'outlined'}
                        color={lane.current_item.my_bid_status === 'active' ? 'success' : 'primary'}
                        size="large"
                        onClick={() => handleBidToggle(lane.current_item!.id, lane.current_item!.my_bid_status)}
                        startIcon={
                          bidLoading[lane.current_item.id] ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : lane.current_item.my_bid_status === 'active' ? (
                            <PauseIcon />
                          ) : (
                            <PlayArrowIcon />
                          )
                        }
                        disabled={bidLoading[lane.current_item.id]}
                      >
                        {lane.current_item.my_bid_status === 'active' ? '入札中' : '入札する'}
                      </Button>
                    )}
                    <IconButton
                      color="primary"
                      onClick={() => handleDetailOpen(lane.current_item!)}
                    >
                      <InfoIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              ) : (
                <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CardContent>
                    <Typography variant="h6" color="text.secondary" align="center">
                      レーン {lane.lane_number}{lane.lane_name ? ` (${lane.lane_name})` : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      {lane.status === 'finished' ? '全出品終了' : '待機中'}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Grid>
          ))}
        </Grid>

        {/* 自分の入札状況 */}
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            あなたの入札状況
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {myActiveBids.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                現在入札中の商品はありません
              </Typography>
            ) : (
              myActiveBids.map((lane) => (
                <Chip
                  key={lane.lane_id}
                  label={`レーン${lane.lane_number}${lane.lane_name ? `(${lane.lane_name})` : ''}: ${lane.current_item?.species_name}`}
                  color="success"
                  onDelete={() => lane.current_item && handleBidToggle(lane.current_item.id, 'active')}
                />
              ))
            )}
          </Box>
        </Paper>

        {/* 落札一覧パネル */}
        {wonItems.length > 0 && (
          <Paper sx={{ mt: 2, p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEventsIcon color="warning" />
              あなたの落札一覧（{wonItems.length}件）
            </Typography>
            <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell>
                      <TableCell>品種</TableCell>
                      <TableCell align="right">単価</TableCell>
                      <TableCell align="right">数量</TableCell>
                      <TableCell align="right">合計(税込)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wonItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_number}</TableCell>
                        <TableCell>{item.species_name}</TableCell>
                        <TableCell align="right">
                          ¥{Math.floor(item.winning_price).toLocaleString()}
                          /1{item.quantity_unit === 'kg' ? 'kg' : 
                             item.quantity_unit === 'bag' ? '袋' : '匹'}
                        </TableCell>
                        <TableCell align="right">
                          {item.quantity}
                          {item.quantity_unit === 'kg' ? 'kg' : 
                           item.quantity_unit === 'bag' ? '袋' : '匹'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{Math.floor(item.total_amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  <TableRow>
                    <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>
                      合計金額
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.1rem' }}>
                      ¥{Math.floor(wonTotalAmount).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Container>

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
              <Grid container spacing={2}>
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
                            cursor: 'pointer', position: 'relative', bgcolor: 'grey.200',
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
                  {selectedItem && (
                    <Box sx={{ mb: 2 }}><BidderCountDisplay count={selectedItem.active_bidders_count} /></Box>
                  )}
                  <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                    ¥{selectedItem?.current_price ? Math.floor(selectedItem.current_price).toLocaleString() : '0'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>匹数</Typography>
                  <Typography variant="body1" gutterBottom>{selectedItem?.quantity}匹</Typography>
                  {selectedItem?.inspection_info && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>審査情報</Typography>
                      <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.inspection_info}</Typography>
                    </>
                  )}
                  {selectedItem?.individual_info && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>個体情報</Typography>
                      <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.individual_info}</Typography>
                    </>
                  )}
                </Grid>
              </Grid>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDetailClose}>閉じる</Button>
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

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
