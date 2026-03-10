import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Card, CardMedia, CardContent,
  CardActions, Chip, Stepper, Step, StepLabel, StepContent, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Tooltip, Fade,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, CircularProgress, LinearProgress,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Refresh as RefreshIcon,
  TouchApp as TouchAppIcon,
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon,
  EmojiEvents as TrophyIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  PriceCheck as PriceCheckIcon,
  Gavel as GavelIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Pets as PetsIcon,
  Block as BlockIcon,
  PlayCircleOutline as PlayCircleIcon,
  Person as PersonIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';

// ─── Types ───

interface DemoLane {
  id: number;
  lane_number: number;
  lane_name: string;
  species_name: string;
  item_number: number;
  seller_name: string;
  quantity: number;
  current_price: number;
  start_price: number;
  countdown: number;
  active_bidders_count: number;
  my_bid_status: 'active' | 'inactive' | null;
  phase: 'bidding' | 'pre_bid' | 'freeze';
  pre_bid_remaining: number;
  freeze_remaining: number;
  is_premium: boolean;
  thumbnail: string;
  limit_price: number | null;
  limit_triggered: boolean;
}

interface DemoUpcoming {
  id: number;
  item_number: number;
  species_name: string;
  start_price: number;
  thumbnail: string;
  is_premium: boolean;
  is_favorited: boolean;
  lane_number: number;
}

interface WonEntry {
  species_name: string;
  winning_price: number;
  quantity: number;
  total_amount: number;
}

// ─── Initial Data ───

const createLane = (id: number, num: number, name: string, species: string, price: number, premium: boolean): DemoLane => ({
  id,
  lane_number: num,
  lane_name: name,
  species_name: species,
  item_number: id,
  seller_name: `デモ出品者${id}`,
  quantity: id === 1 ? 2 : id === 2 ? 5 : 1,
  current_price: price,
  start_price: price,
  countdown: 15,
  active_bidders_count: 1,
  my_bid_status: null,
  phase: 'bidding',
  pre_bid_remaining: 0,
  freeze_remaining: 0,
  is_premium: premium,
  thumbnail: '/img/noimage.png',
  limit_price: null,
  limit_triggered: false,
});

const INITIAL_LANES: DemoLane[] = [
  createLane(1, 1, 'レーン 1', '紅白ラメ ペア', 3000, false),
  createLane(2, 2, 'レーン 2', '幹之フルボディ 5匹セット', 5000, true),
  createLane(3, 3, 'レーン 3', '楊貴妃ダルマ', 2000, false),
];

const INITIAL_UPCOMING: DemoUpcoming[] = [
  { id: 10, item_number: 4, species_name: '三色ラメ', start_price: 4000, thumbnail: '/img/noimage.png', is_premium: false, is_favorited: false, lane_number: 1 },
  { id: 11, item_number: 5, species_name: 'オロチ ペア', start_price: 6000, thumbnail: '/img/noimage.png', is_premium: true, is_favorited: true, lane_number: 2 },
  { id: 12, item_number: 6, species_name: '夜桜ゴールド', start_price: 3500, thumbnail: '/img/noimage.png', is_premium: false, is_favorited: false, lane_number: 3 },
];

// ─── Steps ───

const DEMO_STEPS = [
  {
    title: 'オークション画面の見方',
    description: '3つのレーンが同時に進行しています。各レーンには品種名、現在価格、カウントダウンが表示されています。下にスクロールすると「次の商品」も確認できます。',
  },
  {
    title: '入札してみよう',
    description: 'レーン1の「入札する」ボタンをタップしてみてください！カードが金色に光り「最高入札者」バッジが表示されます。複数レーンに同時入札もできます。',
    highlight: 'bid',
  },
  {
    title: '他の参加者が入札',
    description: '「次へ」を押すと、他の参加者がレーン1に入札します。価格が上がりカウントダウンがリセットされます。',
    autoAction: 'opponent_bid',
  },
  {
    title: 'フリーズ（誤タップ防止）',
    description: '価格上昇直後、数秒間入札ボタンが無効になる「フリーズ」状態になります。「次へ」で体験できます。誤タップを防ぐ安全機能です。',
    autoAction: 'freeze',
  },
  {
    title: '新商品の入札開始待機',
    description: 'レーン3に新しい商品が来ました。入札開始まで数秒間の待機（pre_bid）フェーズがあります。「次へ」で体験できます。',
    autoAction: 'pre_bid',
  },
  {
    title: '指値（上限価格）を設定',
    description: '指値を設定すると、価格がその金額に達したとき自動で入札がオフになります。レーン1の「上限設定」ボタンを押してみてください。',
    highlight: 'limit',
  },
  {
    title: '指値が発動！自動入札オフ',
    description: '「次へ」を押すと、相手が連続入札して指値に到達します。自動で入札がオフになる様子を確認できます。',
    autoAction: 'limit_trigger',
  },
  {
    title: '詳細ダイアログを確認',
    description: 'レーンカードの「i」ボタンや、次の商品の「i」ボタンを押すと、画像や個体情報を確認できます。試してみてください。',
    highlight: 'info',
  },
  {
    title: '落札おめでとう！',
    description: '「次へ」でレーン2のカウントダウンが0になり落札します。落札結果テーブルも表示されます。',
    autoAction: 'win',
  },
];

// ─── Component ───

export default function Demo() {
  const [activeStep, setActiveStep] = useState(0);
  const [lanes, setLanes] = useState<DemoLane[]>(INITIAL_LANES.map(l => ({ ...l })));
  const [upcoming, setUpcoming] = useState<DemoUpcoming[]>(INITIAL_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  const [showLimitDialog, setShowLimitDialog] = useState<number | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState<number | null>(null);
  const [showUpcomingDetail, setShowUpcomingDetail] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const notify = useCallback((message: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ─── Timer Management ───

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
      setLanes(prev => prev.map(l => l.id === laneId ? { ...l, countdown: seconds } : l));
    }
    const timer = setInterval(() => {
      setLanes(prev => {
        const lane = prev.find(l => l.id === laneId);
        if (!lane || lane.countdown <= 1) {
          stopTimer(laneId);
          return prev.map(l => l.id === laneId ? { ...l, countdown: 0 } : l);
        }
        return prev.map(l => l.id === laneId ? { ...l, countdown: l.countdown - 1 } : l);
      });
    }, 1000);
    timersRef.current.set(laneId, timer);
  }, [stopTimer]);

  useEffect(() => () => stopAllTimers(), [stopAllTimers]);

  // ─── Lane Actions ───

  const handleBidToggle = useCallback((laneId: number) => {
    setLanes(prev => prev.map(lane => {
      if (lane.id !== laneId) return lane;
      if (lane.phase === 'freeze') {
        notify('フリーズ中は入札できません。数秒お待ちください。', 'error');
        return lane;
      }
      if (lane.phase === 'pre_bid') {
        notify('入札開始待機中です。もう少々お待ちください。', 'error');
        return lane;
      }
      if (lane.my_bid_status === 'active') {
        notify('入札をオフにしました', 'info');
        return { ...lane, my_bid_status: 'inactive' as const, active_bidders_count: Math.max(0, lane.active_bidders_count - 1) };
      }
      notify(`レーン${lane.lane_number}に入札しました！`, 'success');
      return { ...lane, my_bid_status: 'active' as const, active_bidders_count: lane.active_bidders_count + 1 };
    }));
    // Reset countdown on bid
    const lane = lanes.find(l => l.id === laneId);
    if (lane && lane.my_bid_status !== 'active' && lane.phase === 'bidding') {
      startCountdown(laneId, 15);
    }
    // Auto-advance from step 1
    if (activeStep === 1) {
      setTimeout(() => setActiveStep(2), 1500);
    }
  }, [lanes, activeStep, notify, startCountdown]);

  const simulateOpponentBid = useCallback((laneId: number) => {
    setLanes(prev => prev.map(lane => {
      if (lane.id !== laneId) return lane;
      const increment = Math.max(100, Math.round(lane.current_price * 0.1));
      return {
        ...lane,
        current_price: lane.current_price + increment,
        active_bidders_count: Math.max(2, lane.active_bidders_count),
      };
    }));
    startCountdown(laneId, 15);
    const lane = lanes.find(l => l.id === laneId);
    if (lane) {
      const increment = Math.max(100, Math.round(lane.current_price * 0.1));
      notify(`他の参加者がレーン${lane.lane_number}に入札！ +¥${increment.toLocaleString()}`, 'warning');
    }
  }, [lanes, notify, startCountdown]);

  const simulateFreeze = useCallback((laneId: number) => {
    stopTimer(laneId);
    setLanes(prev => prev.map(lane => {
      if (lane.id !== laneId) return lane;
      const increment = Math.max(100, Math.round(lane.current_price * 0.1));
      return {
        ...lane,
        phase: 'freeze' as const,
        freeze_remaining: 3,
        current_price: lane.current_price + increment,
        active_bidders_count: Math.max(2, lane.active_bidders_count),
      };
    }));
    notify('フリーズ中！入札ボタンが一時的に無効になります（誤タップ防止）', 'warning');

    let remaining = 3;
    const freezeTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(freezeTimer);
        setLanes(prev => prev.map(lane =>
          lane.id === laneId ? { ...lane, phase: 'bidding' as const, freeze_remaining: 0 } : lane
        ));
        startCountdown(laneId, 15);
        notify('フリーズ解除！入札可能になりました', 'success');
      } else {
        setLanes(prev => prev.map(lane =>
          lane.id === laneId ? { ...lane, freeze_remaining: remaining } : lane
        ));
      }
    }, 1000);
  }, [stopTimer, startCountdown, notify]);

  const simulatePreBid = useCallback((laneId: number) => {
    stopTimer(laneId);
    setLanes(prev => prev.map(lane => {
      if (lane.id !== laneId) return lane;
      return {
        ...lane,
        species_name: '三色ラメ 新着',
        item_number: 7,
        current_price: 4500,
        start_price: 4500,
        phase: 'pre_bid' as const,
        pre_bid_remaining: 5,
        countdown: 15,
        my_bid_status: null,
        active_bidders_count: 0,
      };
    }));
    notify('新商品がレーン3に登場！入札開始まで待機中...', 'info');

    let remaining = 5;
    const preBidTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(preBidTimer);
        setLanes(prev => prev.map(lane =>
          lane.id === laneId ? { ...lane, phase: 'bidding' as const, pre_bid_remaining: 0 } : lane
        ));
        startCountdown(laneId, 15);
        notify('入札開始！レーン3で入札できるようになりました', 'success');
      } else {
        setLanes(prev => prev.map(lane =>
          lane.id === laneId ? { ...lane, pre_bid_remaining: remaining } : lane
        ));
      }
    }, 1000);
  }, [stopTimer, startCountdown, notify]);

  const simulateLimitTrigger = useCallback(() => {
    const lane1 = lanes.find(l => l.id === 1);
    if (!lane1 || !lane1.limit_price) {
      notify('先にレーン1で指値を設定してください', 'error');
      return;
    }
    const targetPrice = lane1.limit_price;
    let currentPrice = lane1.current_price;
    const steps: number[] = [];
    while (currentPrice < targetPrice) {
      const inc = Math.max(100, Math.round(currentPrice * 0.1));
      currentPrice += inc;
      steps.push(currentPrice);
    }

    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        setLanes(prev => prev.map(lane =>
          lane.id === 1
            ? { ...lane, my_bid_status: 'inactive' as const, limit_triggered: true }
            : lane
        ));
        notify('指値に到達！自動で入札がオフになりました', 'error');
        return;
      }
      setLanes(prev => prev.map(lane =>
        lane.id === 1
          ? { ...lane, current_price: steps[i], active_bidders_count: Math.max(2, lane.active_bidders_count) }
          : lane
      ));
      notify(`他の参加者が入札！ ¥${steps[i].toLocaleString()}`, 'warning');
      i++;
    }, 800);
  }, [lanes, notify]);

  const handleWin = useCallback(() => {
    const lane2 = lanes.find(l => l.id === 2);
    if (!lane2) return;
    stopTimer(2);
    setLanes(prev => prev.map(l => l.id === 2 ? { ...l, countdown: 0, my_bid_status: 'active' as const } : l));

    const entry: WonEntry = {
      species_name: lane2.species_name,
      winning_price: lane2.current_price,
      quantity: lane2.quantity,
      total_amount: Math.floor(lane2.current_price * lane2.quantity * 1.1),
    };
    setWonItems(prev => [...prev, entry]);
    setCelebrationText(`${lane2.species_name} を ¥${lane2.current_price.toLocaleString()} で落札！`);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 5000);
  }, [lanes, stopTimer]);

  // ─── Step Navigation ───

  const handleNextStep = () => {
    const nextStep = activeStep + 1;
    if (nextStep >= DEMO_STEPS.length) return;

    const step = DEMO_STEPS[nextStep];
    if (step.autoAction === 'opponent_bid') simulateOpponentBid(1);
    else if (step.autoAction === 'freeze') simulateFreeze(1);
    else if (step.autoAction === 'pre_bid') simulatePreBid(3);
    else if (step.autoAction === 'limit_trigger') simulateLimitTrigger();
    else if (step.autoAction === 'win') {
      // Ensure lane 2 has active bid for win
      setLanes(prev => prev.map(l => l.id === 2 ? { ...l, my_bid_status: 'active' as const, active_bidders_count: 2 } : l));
      setTimeout(() => handleWin(), 500);
    }
    setActiveStep(nextStep);
  };

  const handleReset = () => {
    stopAllTimers();
    setActiveStep(0);
    setLanes(INITIAL_LANES.map(l => ({ ...l })));
    setUpcoming(INITIAL_UPCOMING.map(u => ({ ...u })));
    setWonItems([]);
    setShowCelebration(false);
    setShowLimitDialog(null);
    setShowDetailDialog(null);
    setShowUpcomingDetail(null);
  };

  const handleSetLimit = (laneId: number, price: number) => {
    setLanes(prev => prev.map(l => l.id === laneId ? { ...l, limit_price: price, limit_triggered: false } : l));
    setShowLimitDialog(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定しました`, 'success');
    if (activeStep === 5) setTimeout(() => setActiveStep(6), 1000);
  };

  const toggleFavorite = (itemId: number) => {
    setUpcoming(prev => prev.map(u => u.id === itemId ? { ...u, is_favorited: !u.is_favorited } : u));
  };

  // Current highlight
  const currentHighlight = DEMO_STEPS[activeStep]?.highlight;

  // ─── Render helpers ───

  const renderLaneCard = (lane: DemoLane) => {
    const isMyBidActive = lane.my_bid_status === 'active';
    const isFreeze = lane.phase === 'freeze';
    const isPreBid = lane.phase === 'pre_bid';

    return (
      <Card
        key={lane.id}
        sx={{
          height: '100%',
          position: 'relative',
          overflow: 'visible',
          border: isMyBidActive ? '2px solid transparent' : 1,
          borderColor: isMyBidActive ? undefined : 'divider',
          borderRadius: 2,
          transition: 'all 0.3s ease',
          transform: isMyBidActive ? 'translateY(-2px)' : 'none',
          ...(isMyBidActive && {
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, #FFD700, #FFA500, #FFD700, #DAA520, #FFD700)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: '0 0 18px 4px rgba(255, 215, 0, 0.35), 0 0 40px 8px rgba(255, 165, 0, 0.15)',
            animation: 'activeBidGlow 2s ease-in-out infinite',
            '@keyframes activeBidGlow': {
              '0%, 100%': { boxShadow: '0 0 18px 4px rgba(255, 215, 0, 0.35)' },
              '50%': { boxShadow: '0 0 24px 8px rgba(255, 215, 0, 0.55)' },
            },
          }),
        }}
      >
        {/* シマーエフェクト */}
        {isMyBidActive && (
          <Box sx={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: 2,
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: '-100%',
              width: '60%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.12), rgba(255, 255, 255, 0.18), rgba(255, 215, 0, 0.12), transparent)',
              animation: 'shimmerSweep 3s ease-in-out infinite',
              '@keyframes shimmerSweep': { '0%': { left: '-100%' }, '100%': { left: '200%' } },
            },
          }} />
        )}

        {/* 最高入札者バッジ */}
        {isMyBidActive && (
          <Box sx={{
            position: 'absolute', top: -10, right: -6, zIndex: 3,
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            color: '#5D3A00', px: 1.5, py: 0.4, borderRadius: '12px',
            fontSize: '0.7rem', fontWeight: 800,
            boxShadow: '0 2px 8px rgba(255, 165, 0, 0.5)',
            animation: 'badgePulse 2s ease-in-out infinite',
            '@keyframes badgePulse': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' } },
          }}>
            最高入札者
          </Box>
        )}

        {/* レーン番号 */}
        <Box sx={{
          position: 'absolute', top: 8, left: 8,
          bgcolor: 'primary.main', color: 'white',
          px: 1.5, py: 0.3, borderRadius: 1, fontWeight: 'bold', zIndex: 1, fontSize: '0.75rem',
        }}>
          {lane.lane_name}
        </Box>

        {/* プレミアム */}
        {lane.is_premium && (
          <Chip label="プレミアム" color="warning" size="small"
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, fontSize: '0.65rem' }} />
        )}

        <CardMedia component="img" image={lane.thumbnail} alt={lane.species_name}
          sx={{ aspectRatio: '3/2', objectFit: 'cover' }} />

        <CardContent sx={{ pb: 1 }}>
          <Typography variant="caption" color="text.secondary">No.{lane.item_number}</Typography>
          <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3, fontSize: '0.95rem' }}>
            {lane.species_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {lane.seller_name} / {lane.quantity}匹
          </Typography>

          {/* 現在単価 */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">現在単価</Typography>
            <Typography variant="h5" color="primary.main" fontWeight="bold" sx={{ fontSize: '1.3rem' }}>
              ¥{lane.current_price.toLocaleString()}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>/1匹</Typography>
            </Typography>
          </Box>

          {/* フェーズ表示 */}
          {isPreBid ? (
            <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid', borderColor: 'primary.200', borderRadius: 1.5, p: 1.5, mb: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="primary.main" fontWeight={600}>入札開始まで</Typography>
              <Typography variant="h5" color="primary.main" fontWeight="bold">{lane.pre_bid_remaining}秒</Typography>
            </Box>
          ) : isFreeze ? (
            <Box sx={{ mb: 1 }}>
              <Chip icon={<BlockIcon sx={{ fontSize: 14 }} />} label={`ブロック中 ${lane.freeze_remaining}秒`}
                size="small" sx={{ fontWeight: 'bold', minWidth: 80, bgcolor: 'grey.300', color: 'grey.700' }} />
              <LinearProgress variant="determinate" value={(lane.freeze_remaining / 3) * 100}
                sx={{ mt: 0.5, borderRadius: 1, height: 4 }} color="warning" />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={lane.countdown > 0 ? `残り ${lane.countdown}秒` : '終了'}
                size="small"
                color={lane.countdown <= 5 && lane.countdown > 0 ? 'warning' : 'default'}
                sx={{ fontWeight: 'bold', minWidth: 70, fontSize: '0.75rem' }}
              />
              <Typography variant="caption" color="text.secondary">
                入札者: {lane.active_bidders_count}人
              </Typography>
            </Box>
          )}

          {/* 指値バッジ */}
          <Box sx={{
            ...(currentHighlight === 'limit' && lane.id === 1 && {
              animation: 'highlightPulse 1.5s ease-in-out infinite',
              '@keyframes highlightPulse': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' } },
            }),
          }}>
            <Chip
              icon={<PriceCheckIcon sx={{ fontSize: 14 }} />}
              label={
                lane.limit_triggered ? `上限到達: ¥${lane.limit_price?.toLocaleString()}`
                : lane.limit_price ? `上限: ¥${lane.limit_price.toLocaleString()}`
                : '上限設定'
              }
              size="small"
              variant={lane.limit_price ? 'filled' : 'outlined'}
              color={lane.limit_triggered ? 'default' : lane.limit_price ? 'primary' : 'default'}
              onClick={() => setShowLimitDialog(lane.id)}
              sx={{
                cursor: 'pointer', fontSize: '0.65rem',
                opacity: lane.limit_triggered ? 0.6 : 1,
                textDecoration: lane.limit_triggered ? 'line-through' : 'none',
              }}
            />
          </Box>
        </CardContent>

        <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
          <Box sx={{
            flex: 1,
            ...(currentHighlight === 'bid' && lane.id === 1 && lane.my_bid_status !== 'active' && {
              animation: 'highlightPulse 1.5s ease-in-out infinite',
              '@keyframes highlightPulse': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' } },
            }),
          }}>
            <Button
              variant="contained" fullWidth
              color={isMyBidActive ? 'warning' : 'primary'}
              startIcon={isMyBidActive ? undefined : <TouchAppIcon />}
              onClick={() => handleBidToggle(lane.id)}
              disabled={(lane.countdown === 0 && lane.phase === 'bidding') || isFreeze || isPreBid}
              sx={{ fontWeight: 700, py: 1 }}
            >
              {isFreeze ? 'フリーズ中...' : isPreBid ? '待機中...' : isMyBidActive ? '入札中' : '入札する'}
            </Button>
          </Box>
          <IconButton
            color="primary"
            onClick={() => setShowDetailDialog(lane.id)}
            sx={{
              ...(currentHighlight === 'info' && {
                animation: 'highlightPulse 1.5s ease-in-out infinite',
                '@keyframes highlightPulse': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' } },
              }),
            }}
          >
            <InfoIcon />
          </IconButton>
        </CardActions>
      </Card>
    );
  };

  const detailLane = lanes.find(l => l.id === showDetailDialog);
  const limitLane = lanes.find(l => l.id === showLimitDialog);
  const upcomingDetail = upcoming.find(u => u.id === showUpcomingDetail);
  const wonTotal = wonItems.reduce((sum, w) => sum + w.total_amount, 0);

  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: 'calc(100vh - 64px)' }}>
      {/* ヘッダー */}
      <Box sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)', color: 'white', py: 3, px: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <GavelIcon sx={{ fontSize: 32 }} />
            <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.3rem', md: '2rem' } }}>
              オークション体験デモ
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            3レーン同時進行・フリーズ・入札待機・指値発動・落札まで、すべての流れをナビ付きで体験
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>

          {/* 左: ナビゲーション */}
          <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
            <Paper sx={{ p: 2, position: { lg: 'sticky' }, top: { lg: 80 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">ガイド ({activeStep + 1}/{DEMO_STEPS.length})</Typography>
                <Tooltip title="最初からやり直す">
                  <IconButton size="small" onClick={handleReset}><RefreshIcon /></IconButton>
                </Tooltip>
              </Box>
              <Stepper activeStep={activeStep} orientation="vertical">
                {DEMO_STEPS.map((step, index) => (
                  <Step key={index}>
                    <StepLabel
                      sx={{ cursor: 'pointer', '& .MuiStepLabel-label': { fontWeight: index === activeStep ? 700 : 400, fontSize: '0.85rem' } }}
                      onClick={() => setActiveStep(index)}
                    >
                      {step.title}
                    </StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem' }}>
                        {step.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {activeStep > 0 && (
                          <Button size="small" startIcon={<PrevIcon />} onClick={() => setActiveStep(Math.max(0, activeStep - 1))}>
                            前へ
                          </Button>
                        )}
                        {activeStep < DEMO_STEPS.length - 1 && (
                          <Button size="small" variant="contained" endIcon={<NextIcon />} onClick={handleNextStep}>
                            次へ
                          </Button>
                        )}
                        {activeStep === DEMO_STEPS.length - 1 && (
                          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleReset}>
                            最初から
                          </Button>
                        )}
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>

              {/* ルール情報 */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                デモのルール
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingUpIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography variant="caption">上がり幅: 10%（最低¥100）</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimerIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                  <Typography variant="caption">カウントダウン: 15秒</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BlockIcon sx={{ fontSize: 14, color: 'grey.500' }} />
                  <Typography variant="caption">フリーズ: 3秒</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PlayCircleIcon sx={{ fontSize: 14, color: 'info.main' }} />
                  <Typography variant="caption">入札待機: 5秒</Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* 右: デモオークション画面 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* 落札演出 */}
            {showCelebration && (
              <Fade in>
                <Alert
                  severity="success"
                  icon={<TrophyIcon sx={{ color: '#f59e0b' }} />}
                  sx={{
                    mb: 2, bgcolor: '#fef3c7', border: '2px solid #f59e0b',
                    '& .MuiAlert-message': { fontWeight: 700, fontSize: '1rem' },
                  }}
                >
                  落札おめでとうございます！ {celebrationText}
                </Alert>
              </Fade>
            )}

            {/* レーングリッド */}
            <Grid container spacing={2}>
              {lanes.map(lane => (
                <Grid item xs={12} sm={6} md={4} key={lane.id}>
                  {renderLaneCard(lane)}
                </Grid>
              ))}
            </Grid>

            {/* 次の商品 */}
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>次の商品</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
                {upcoming.map(item => (
                  <Box key={item.id} sx={{
                    flexShrink: 0, width: 150, borderRadius: 1.5,
                    border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper',
                  }}>
                    <Box sx={{
                      width: '100%', aspectRatio: '3/2', bgcolor: 'grey.100',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <PetsIcon sx={{ color: 'grey.400', fontSize: 28 }} />
                    </Box>
                    <Box sx={{ p: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Chip label={`L${item.lane_number}`} size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} color="primary" variant="outlined" />
                        {item.is_premium && <Chip label="P" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />}
                      </Box>
                      <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>
                        {item.species_name}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight="bold">
                        ¥{item.start_price.toLocaleString()}〜
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                        <Tooltip title="詳細を見る" arrow>
                          <IconButton size="small" onClick={() => setShowUpcomingDetail(item.id)} sx={{ p: 0.25 }}>
                            <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => toggleFavorite(item.id)} sx={{ p: 0.25 }}>
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

            {/* 落札結果テーブル */}
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
          </Box>
        </Box>
      </Container>

      {/* ─── 詳細ダイアログ（レーン） ─── */}
      <Dialog open={!!detailLane} onClose={() => setShowDetailDialog(null)} maxWidth="sm" fullWidth>
        {detailLane && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">No.{detailLane.item_number} {detailLane.species_name}</Typography>
                <IconButton onClick={() => setShowDetailDialog(null)}><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100', mb: 2 }}>
                <img src={detailLane.thumbnail} alt={detailLane.species_name}
                  style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'contain' }} />
              </Box>
              {detailLane.is_premium && <Chip label="プレミアム" color="warning" size="small" sx={{ mb: 1 }} />}
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">現在単価</Typography>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  ¥{detailLane.current_price.toLocaleString()}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>/1匹</Typography>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{detailLane.seller_name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InventoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{detailLane.quantity}匹</Typography>
                </Box>
              </Box>
              {detailLane.phase === 'bidding' && (
                <Box sx={{ mb: 1.5 }}>
                  <Chip
                    label={detailLane.countdown > 0 ? `残り ${detailLane.countdown}秒` : '終了'}
                    size="small"
                    color={detailLane.countdown <= 5 && detailLane.countdown > 0 ? 'warning' : 'default'}
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
              )}
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" color="primary.main" gutterBottom>個体情報（デモ）</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                体長: 約3cm{'\n'}色: 赤白のコントラストが鮮明{'\n'}ラメ: 全身に散りばめられた金ラメ{'\n'}健康状態: 良好
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetailDialog(null)}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ─── 詳細ダイアログ（次の商品） ─── */}
      <Dialog open={!!upcomingDetail} onClose={() => setShowUpcomingDetail(null)} maxWidth="xs" fullWidth>
        {upcomingDetail && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight="bold">{upcomingDetail.species_name}</Typography>
                <IconButton onClick={() => setShowUpcomingDetail(null)} size="small"><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{
                width: '100%', aspectRatio: '3/2', bgcolor: 'grey.100', borderRadius: 1.5, mb: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PetsIcon sx={{ color: 'grey.400', fontSize: 48 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                <Chip label={`レーン ${upcomingDetail.lane_number}`} size="small" color="primary" />
                {upcomingDetail.is_premium && <Chip label="プレミアム" size="small" color="warning" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No.{upcomingDetail.item_number}
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight="bold" sx={{ mb: 2 }}>
                ¥{upcomingDetail.start_price.toLocaleString()}〜
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" color="primary.main" gutterBottom>個体情報（デモ）</Typography>
              <Typography variant="body2" color="text.secondary">
                この商品の詳細情報はオークション開始後に確認できます。
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowUpcomingDetail(null)}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ─── 指値設定ダイアログ ─── */}
      <Dialog open={!!limitLane} onClose={() => setShowLimitDialog(null)} maxWidth="xs" fullWidth>
        {limitLane && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight="bold">上限価格の設定</Typography>
                <IconButton onClick={() => setShowLimitDialog(null)} size="small"><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {limitLane.lane_name} - {limitLane.species_name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                現在価格: <strong>¥{limitLane.current_price.toLocaleString()}</strong>
              </Typography>
              <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
                設定した価格に達すると自動で入札がオフになります。
              </Alert>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[500, 1000, 2000, 5000].map(add => {
                  const price = limitLane.current_price + add;
                  return (
                    <Button key={add} variant="outlined" onClick={() => handleSetLimit(limitLane.id, price)}
                      sx={{ justifyContent: 'space-between' }}>
                      <span>¥{price.toLocaleString()}</span>
                      <Chip label={`+¥${add.toLocaleString()}`} size="small" />
                    </Button>
                  );
                })}
              </Box>
              {limitLane.limit_price && (
                <Button fullWidth color="error" sx={{ mt: 2 }}
                  onClick={() => {
                    setLanes(prev => prev.map(l => l.id === limitLane.id ? { ...l, limit_price: null, limit_triggered: false } : l));
                    setShowLimitDialog(null);
                    notify('上限設定を解除しました', 'info');
                  }}>
                  上限設定を解除
                </Button>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

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
