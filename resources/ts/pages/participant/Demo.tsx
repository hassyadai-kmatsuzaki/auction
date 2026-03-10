import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid,
  Stepper, Step, StepLabel, StepContent, Alert, IconButton,
  Snackbar, Tooltip, Fade, Divider, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon,
  EmojiEvents as TrophyIcon,
  Gavel as GavelIcon,
  Block as BlockIcon,
  PlayCircleOutline as PlayCircleIcon,
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem, UpcomingItem } from '@/types';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';

// ─── Demo data builders ───

const makeLaneItem = (overrides: Partial<LaneItem> & { id: number; species_name: string }): LaneItem => ({
  item_number: overrides.id,
  current_price: 3000,
  quantity: 2,
  quantity_unit: 'fish',
  active_bidders_count: 1,
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
  seller_name: `デモ出品者`,
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
  makeLaneItem({ id: 1, species_name: '紅白ラメ ペア', current_price: 3000, quantity: 2, seller_name: 'デモ出品者A' }),
  makeLaneItem({ id: 2, species_name: '幹之フルボディ 5匹セット', current_price: 5000, quantity: 5, is_premium: true, seller_name: 'デモ出品者B' }),
  makeLaneItem({ id: 3, species_name: '楊貴妃ダルマ', current_price: 2000, quantity: 1, seller_name: 'デモ出品者C' }),
];

const INITIAL_LANES: LiveLane[] = [
  makeLane(1, 1, 'レーン 1', INITIAL_ITEMS[0]),
  makeLane(2, 2, 'レーン 2', INITIAL_ITEMS[1]),
  makeLane(3, 3, 'レーン 3', INITIAL_ITEMS[2]),
];

const INITIAL_UPCOMING: (UpcomingItem & { laneNumber: number })[] = [
  { id: 10, item_number: 4, species_name: '三色ラメ', start_price: 4000, thumbnail_path: '/img/noimage.png', is_premium: false, is_favorited: false, quantity: 3, laneNumber: 1 },
  { id: 11, item_number: 5, species_name: 'オロチ ペア', start_price: 6000, thumbnail_path: '/img/noimage.png', is_premium: true, is_favorited: true, quantity: 2, laneNumber: 2 },
  { id: 12, item_number: 6, species_name: '夜桜ゴールド', start_price: 3500, thumbnail_path: '/img/noimage.png', is_premium: false, is_favorited: false, quantity: 1, laneNumber: 3 },
];

interface WonEntry { species_name: string; winning_price: number; quantity: number; total_amount: number; }

// ─── Steps ───

const DEMO_STEPS = [
  { title: 'オークション画面の見方', description: '3つのレーンが同時に進行しています。各レーンには品種名、現在価格、カウントダウンが表示されています。下にスクロールすると「次の商品」も確認できます。' },
  { title: '入札してみよう', description: 'レーン1の「入札する」ボタンをタップしてみてください！カードが金色に光り「最高入札者」バッジが表示されます。', highlight: 'bid' as const },
  { title: '他の参加者が入札', description: '「次へ」を押すと、他の参加者がレーン1に入札します。価格が上がりカウントダウンがリセットされます。', autoAction: 'opponent_bid' as const },
  { title: 'フリーズ（誤タップ防止）', description: '価格上昇直後、数秒間入札ボタンが無効になる「フリーズ」状態になります。「次へ」で体験できます。', autoAction: 'freeze' as const },
  { title: '新商品の入札開始待機', description: 'レーン3に新しい商品が来ました。入札開始まで数秒間の待機（pre_bid）フェーズがあります。「次へ」で体験できます。', autoAction: 'pre_bid' as const },
  { title: '指値（上限価格）を設定', description: '指値を設定すると、価格がその金額に達したとき自動で入札がオフになります。レーン1の「上限設定」を押してみてください。', highlight: 'limit' as const },
  { title: '指値が発動！自動入札オフ', description: '「次へ」を押すと、相手が連続入札して指値に到達します。自動で入札がオフになる様子を確認できます。', autoAction: 'limit_trigger' as const },
  { title: '詳細ダイアログを確認', description: 'レーンカードの「i」ボタンを押すと、画像や個体情報を確認できます。試してみてください。', highlight: 'info' as const },
  { title: '落札おめでとう！', description: '「次へ」でレーン2を落札します。紙吹雪の落札演出と結果テーブルが表示されます。', autoAction: 'win' as const },
];

// ─── Component ───

export default function Demo() {
  const [activeStep, setActiveStep] = useState(0);
  const [lanes, setLanes] = useState<LiveLane[]>(JSON.parse(JSON.stringify(INITIAL_LANES)));
  const [upcoming, setUpcoming] = useState(INITIAL_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [detailLane, setDetailLane] = useState<LiveLane | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const notify = useCallback((message: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ─── Helpers to update lane items ───

  const updateLaneItem = useCallback((laneId: number, updater: (item: LaneItem) => LaneItem) => {
    setLanes(prev => prev.map(lane =>
      lane.lane_id === laneId && lane.current_item
        ? { ...lane, current_item: updater(lane.current_item) }
        : lane
    ));
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

  // ─── Lane Actions ───

  const handleBidToggle = useCallback((itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    const lane = lanes.find(l => l.current_item?.id === itemId);
    if (!lane?.current_item) return;
    const item = lane.current_item;

    if (item.phase === 'freeze') {
      notify('フリーズ中は入札できません。数秒お待ちください。', 'error');
      return;
    }
    if (item.phase === 'pre_bid') {
      notify('入札開始待機中です。もう少々お待ちください。', 'error');
      return;
    }

    if (currentStatus === 'active') {
      updateLaneItem(lane.lane_id, i => ({
        ...i,
        my_bid_status: 'inactive',
        active_bidders_count: Math.max(0, i.active_bidders_count - 1),
      }));
      notify('入札をオフにしました', 'info');
    } else {
      updateLaneItem(lane.lane_id, i => ({
        ...i,
        my_bid_status: 'active',
        active_bidders_count: i.active_bidders_count + 1,
      }));
      startCountdown(lane.lane_id, 15);
      notify(`レーン${lane.lane_number}に入札しました！`, 'success');
      if (activeStep === 1) setTimeout(() => setActiveStep(2), 1500);
    }
  }, [lanes, activeStep, notify, updateLaneItem, startCountdown]);

  const simulateOpponentBid = useCallback((laneId: number) => {
    const lane = lanes.find(l => l.lane_id === laneId);
    const price = lane?.current_item?.current_price ?? 3000;
    const increment = Math.max(100, Math.round(price * 0.1));
    updateLaneItem(laneId, item => ({
      ...item,
      current_price: item.current_price + increment,
      active_bidders_count: Math.max(2, item.active_bidders_count),
    }));
    startCountdown(laneId, 15);
    notify(`他の参加者がレーン${lane?.lane_number}に入札！ +¥${increment.toLocaleString()}`, 'warning');
  }, [lanes, notify, updateLaneItem, startCountdown]);

  const simulateFreeze = useCallback((laneId: number) => {
    stopTimer(laneId);
    const lane = lanes.find(l => l.lane_id === laneId);
    const price = lane?.current_item?.current_price ?? 3000;
    const increment = Math.max(100, Math.round(price * 0.1));
    updateLaneItem(laneId, item => ({
      ...item,
      phase: 'freeze',
      freeze_remaining_seconds: 3,
      freeze_countdown_seconds: 3,
      current_price: item.current_price + increment,
      active_bidders_count: Math.max(2, item.active_bidders_count),
    }));
    notify('フリーズ中！入札ボタンが一時的に無効になります（誤タップ防止）', 'warning');

    let remaining = 3;
    const freezeTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(freezeTimer);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
        startCountdown(laneId, 15);
        notify('フリーズ解除！入札可能になりました', 'success');
      } else {
        updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [lanes, stopTimer, updateLaneItem, startCountdown, notify]);

  const simulatePreBid = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, () => makeLaneItem({
      id: 7,
      species_name: '三色ラメ 新着',
      current_price: 4500,
      quantity: 3,
      phase: 'pre_bid',
      pre_bid_remaining_seconds: 5,
      countdown_seconds: 15,
      my_bid_status: null,
      active_bidders_count: 0,
      seller_name: 'デモ出品者D',
    }));
    notify('新商品がレーン3に登場！入札開始まで待機中...', 'info');

    let remaining = 5;
    const preBidTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(preBidTimer);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', pre_bid_remaining_seconds: 0 }));
        startCountdown(laneId, 15);
        notify('入札開始！レーン3で入札できるようになりました', 'success');
      } else {
        updateLaneItem(laneId, item => ({ ...item, pre_bid_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulateLimitTrigger = useCallback(() => {
    const lane1 = lanes.find(l => l.lane_id === 1);
    const limitPrice = lane1?.current_item?.my_limit_price;
    if (!limitPrice) {
      notify('先にレーン1で指値を設定してください', 'error');
      return;
    }
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
      updateLaneItem(1, item => ({
        ...item,
        current_price: steps[i],
        active_bidders_count: Math.max(2, item.active_bidders_count),
      }));
      notify(`他の参加者が入札！ ¥${steps[i].toLocaleString()}`, 'warning');
      i++;
    }, 800);
  }, [lanes, updateLaneItem, notify]);

  const handleWin = useCallback(() => {
    const lane2 = lanes.find(l => l.lane_id === 2);
    if (!lane2?.current_item) return;
    stopTimer(2);
    updateLaneItem(2, item => ({ ...item, countdown_seconds: 0, my_bid_status: 'active' }));

    const price = lane2.current_item.current_price;
    const qty = lane2.current_item.quantity;
    setWonItems(prev => [...prev, {
      species_name: lane2.current_item!.species_name,
      winning_price: price,
      quantity: qty,
      total_amount: Math.floor(price * qty * 1.1),
    }]);
    setCelebration({ species_name: lane2.current_item.species_name, winning_price: price });
    setTimeout(() => setCelebration(null), 4000);
  }, [lanes, stopTimer, updateLaneItem]);

  // ─── Limit modal handlers (for BidLimitModal) ───

  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItem = limitModalLane?.current_item;

  const handleSetLimit = useCallback((price: number) => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: price, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定しました`, 'success');
    if (activeStep === 5) setTimeout(() => setActiveStep(6), 1000);
  }, [limitModalLaneId, updateLaneItem, notify, activeStep]);

  const handleRemoveLimit = useCallback(() => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: null, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify('上限設定を解除しました', 'info');
  }, [limitModalLaneId, updateLaneItem, notify]);

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
      updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 }));
      setTimeout(() => handleWin(), 500);
    }
    setActiveStep(nextStep);
  };

  const handleReset = () => {
    stopAllTimers();
    setActiveStep(0);
    setLanes(JSON.parse(JSON.stringify(INITIAL_LANES)));
    setUpcoming(INITIAL_UPCOMING.map(u => ({ ...u })));
    setWonItems([]);
    setCelebration(null);
    setLimitModalLaneId(null);
    setDetailLane(null);
  };

  const toggleFavorite = (itemId: number) => {
    setUpcoming(prev => prev.map(u => u.id === itemId ? { ...u, is_favorited: !u.is_favorited } : u));
  };

  const wonTotal = wonItems.reduce((sum, w) => sum + w.total_amount, 0);

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* 落札演出（実際のCelebrationOverlay） */}
      {celebration && (
        <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />
      )}

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
                          <Button size="small" startIcon={<PrevIcon />} onClick={() => setActiveStep(Math.max(0, activeStep - 1))}>前へ</Button>
                        )}
                        {activeStep < DEMO_STEPS.length - 1 && (
                          <Button size="small" variant="contained" endIcon={<NextIcon />} onClick={handleNextStep}>次へ</Button>
                        )}
                        {activeStep === DEMO_STEPS.length - 1 && (
                          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleReset}>最初から</Button>
                        )}
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>

              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 1 }}>デモのルール</Typography>
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

          {/* 右: デモオークション画面（実際のコンポーネント使用） */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* レーングリッド（実際の LaneCard を使用） */}
            <Grid container spacing={2}>
              {lanes.map(lane => (
                <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                  <LaneCard
                    lane={lane}
                    isLoading={false}
                    onBidToggle={handleBidToggle}
                    onDetailOpen={(l) => setDetailLane(l)}
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
                        <Chip label={`L${item.laneNumber}`} size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} color="primary" variant="outlined" />
                        {item.is_premium && <Chip label="P" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />}
                      </Box>
                      <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>{item.species_name}</Typography>
                      <Typography variant="caption" color="primary.main" fontWeight="bold">¥{item.start_price.toLocaleString()}〜</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                        <Tooltip title="詳細を見る" arrow>
                          <IconButton size="small" sx={{ p: 0.25 }} onClick={() => notify(`${item.species_name} の詳細（デモ）`, 'info')}>
                            <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => toggleFavorite(item.id)} sx={{ p: 0.25 }}>
                          {item.is_favorited
                            ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                            : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
                        </IconButton>
                      </Box>
                      <Box sx={{ mt: 0.5 }}>
                        <BidLimitBadge
                          limitPrice={null}
                          isTriggered={false}
                          onEdit={() => notify('次の商品への指値は、商品がレーンに来てから設定できます', 'info')}
                        />
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

      {/* 指値モーダル（実際の BidLimitModal を使用） */}
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
