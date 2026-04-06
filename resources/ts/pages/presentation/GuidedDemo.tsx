/**
 * ガイド付きデモ
 * フロー: ホーム画面 → 出品一覧 → 待機室 → オークション（既存のツアー） → 落札者管理ガイド
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Paper, Grid, Button,
  Chip, IconButton, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Wifi as WifiIcon,
  PlayArrow as PlayArrowIcon,
  ViewList as ViewListIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem } from '@/types';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { DemoTourPopover, type TourStep } from '../../components/DemoTourPopover';
import { DemoLayout } from './DemoLayout';
import { DemoHome } from './DemoHome';
import { DemoItemList } from './DemoItemList';
import { DemoFavorites } from './DemoFavorites';
import { DemoWaitingRoom } from './DemoWaitingRoom';
import { PostAuctionGuide } from './PostAuctionGuide';
import {
  GUIDED_INITIAL_LANES, GUIDED_UPCOMING,
  MOCK_AUCTIONS,
  type WonEntry,
} from './mockData';

type GuidedPhase = 'home' | 'items' | 'favorites' | 'waiting' | 'auction' | 'post-auction';

interface GuidedDemoProps {
  onBackToTop: () => void;
}

// ====================================================================
// メインコンポーネント
// ====================================================================

export function GuidedDemo({ onBackToTop }: GuidedDemoProps) {
  const [phase, setPhase] = useState<GuidedPhase>('home');

  // ─── Auction state ───
  const [lanes, setLanes] = useState<LiveLane[]>(JSON.parse(JSON.stringify(GUIDED_INITIAL_LANES)));
  const [upcoming, setUpcoming] = useState(GUIDED_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // Post-auction controlled tab
  const [postAuctionTab, setPostAuctionTab] = useState<string>('won-items');

  // Tour refs - auction phase (static)
  const demoHeaderRef = useRef<HTMLDivElement>(null);
  const laneCardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const lane1Ref = useRef<HTMLDivElement | null>(null);
  const lane2Ref = useRef<HTMLDivElement | null>(null);
  const lane3Ref = useRef<HTMLDivElement | null>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const wonTableRef = useRef<HTMLDivElement>(null);
  const goToStepRef = useRef<(step: number) => void>(() => {});

  // Tour refs - dynamic (resolved via data-tour-target attributes)
  const homeBannerRef = useRef<HTMLElement | null>(null);
  const itemsButtonRef = useRef<HTMLElement | null>(null);
  const itemsHeaderRef = useRef<HTMLElement | null>(null);
  const firstItemFavoriteRef = useRef<HTMLElement | null>(null);
  const firstItemLimitRef = useRef<HTMLElement | null>(null);
  const waitingRoomButtonRef = useRef<HTMLElement | null>(null);
  const favoritesNavRef = useRef<HTMLElement | null>(null);
  const favoritesHeaderRef = useRef<HTMLElement | null>(null);
  const wonItemsHeaderRef = useRef<HTMLElement | null>(null);
  const firstWonItemRef = useRef<HTMLElement | null>(null);
  const settingsTabRef = useRef<HTMLElement | null>(null);
  const notificationSectionRef = useRef<HTMLElement | null>(null);

  // Resolve dynamic refs after phase/tab changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const resolve = () => {
      homeBannerRef.current = document.querySelector('[data-tour-target="home-banner"]');
      itemsButtonRef.current = document.querySelector('[data-tour-target="home-items-button"]');
      itemsHeaderRef.current = document.querySelector('[data-tour-target="items-header"]');
      firstItemFavoriteRef.current = document.querySelector('[data-tour-target="items-first-favorite"]');
      firstItemLimitRef.current = document.querySelector('[data-tour-target="items-first-limit"]');
      waitingRoomButtonRef.current = document.querySelector('[data-tour-target="items-waiting-button"]');
      favoritesNavRef.current = document.querySelector('[data-tour-target="favorites-nav"]');
      favoritesHeaderRef.current = document.querySelector('[data-tour-target="favorites-header"]');
      wonItemsHeaderRef.current = document.querySelector('[data-tour-target="won-items-header"]');
      firstWonItemRef.current = document.querySelector('[data-tour-target="won-first-item"]');
      settingsTabRef.current = document.querySelector('[data-tour-target="settings-tab"]');
      notificationSectionRef.current = document.querySelector('[data-tour-target="notification-section"]');
    };
    // Resolve immediately and after a short delay (for DOM to settle)
    resolve();
    const t = setTimeout(() => { resolve(); forceUpdate(n => n + 1); }, 100);
    return () => clearTimeout(t);
  }, [phase, postAuctionTab, tourStep]);

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

  // Sync lane refs
  useEffect(() => {
    lane1Ref.current = laneCardRefs.current[0];
    lane2Ref.current = laneCardRefs.current[1];
    lane3Ref.current = laneCardRefs.current[2];
  });

  // ─── Simulation helpers ───

  const simulateBattleCycle = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, item => {
      const inc = Math.max(100, Math.round(item.current_price * 0.1));
      return { ...item, phase: 'freeze' as const, freeze_remaining_seconds: 3, freeze_countdown_seconds: 3, current_price: item.current_price + inc, active_bidders_count: Math.max(2, item.active_bidders_count) };
    });
    notify('他の参加者が入札！フリーズ中...', 'warning');
    let remaining = 3;
    const ft = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(ft);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0, my_bid_status: 'inactive', active_bidders_count: Math.max(1, item.active_bidders_count) }));
        startCountdown(laneId, 15);
        notify('入札が解除されました。再度入札してください！', 'info');
      } else {
        updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulateFreezeHold = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, item => {
      const inc = Math.max(100, Math.round(item.current_price * 0.1));
      return { ...item, phase: 'freeze' as const, freeze_remaining_seconds: 3, freeze_countdown_seconds: 3, current_price: item.current_price + inc, active_bidders_count: Math.max(2, item.active_bidders_count) };
    });
    notify('フリーズ中！この状態では入札ボタンが無効です', 'warning');
  }, [stopTimer, updateLaneItem, notify]);

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

  const handleWin = useCallback((laneId: number = 1) => {
    const targetLane = lanes.find(l => l.lane_id === laneId);
    if (!targetLane?.current_item) return;
    stopTimer(laneId);
    updateLaneItem(laneId, item => ({ ...item, countdown_seconds: 0, my_bid_status: 'active' }));
    const price = targetLane.current_item.current_price;
    const qty = targetLane.current_item.quantity;
    setWonItems(prev => [...prev, { species_name: targetLane.current_item!.species_name, winning_price: price, quantity: qty, total_amount: Math.floor(price * qty * 1.1) }]);
    setCelebration({ species_name: targetLane.current_item.species_name, winning_price: price });
    setTimeout(() => setCelebration(null), 4000);
  }, [lanes, stopTimer, updateLaneItem]);

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

  // ─── Bid toggle ───

  const handleBidToggle = useCallback((itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    const lane = lanes.find(l => l.current_item?.id === itemId);
    if (!lane?.current_item) return;
    const item = lane.current_item;
    if (item.phase === 'freeze') { notify('誤タップ防止中です。もう少々お待ちください。', 'error'); return; }
    if (item.phase === 'pre_bid') { notify('入札開始待機中です。もう少々お待ちください。', 'error'); return; }
    if (currentStatus === 'active') {
      updateLaneItem(lane.lane_id, i => ({ ...i, my_bid_status: 'inactive', active_bidders_count: Math.max(0, i.active_bidders_count - 1) }));
      notify('入札をオフにしました', 'info');
    } else {
      updateLaneItem(lane.lane_id, i => ({ ...i, my_bid_status: 'active', active_bidders_count: i.active_bidders_count + 1 }));
      startCountdown(lane.lane_id, 15);
      notify(`レーン${lane.lane_number}に入札しました！`, 'success');
      if (tourActive && tourStep === 10) {
        setTimeout(() => goToStepRef.current(11), 1200);  // bid step → opponent bid
      }
      if (tourActive && tourStep === 12) {
        setTimeout(() => simulateBattleCycle(lane.lane_id), 2000);  // battle step
      }
    }
  }, [lanes, notify, updateLaneItem, startCountdown, tourActive, tourStep, simulateBattleCycle]);

  // ─── Limit ───

  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItemData = limitModalLane?.current_item;

  const handleSetLimit = useCallback((price: number) => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: price, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定しました`, 'success');
    if (tourActive && tourStep === 14) setTimeout(() => goToStepRef.current(15), 800);
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

  // ─── Tour logic ───

  const handleAuctionReset = useCallback(() => {
    stopAllTimers();
    setLanes(JSON.parse(JSON.stringify(GUIDED_INITIAL_LANES)));
    setUpcoming(GUIDED_UPCOMING.map(u => ({ ...u })));
    setWonItems([]);
    setCelebration(null);
    setLimitModalLaneId(null);
    setTourActive(false);
    setTourStep(0);
    setIsAutoPlaying(false);
  }, [stopAllTimers]);

  const handleStartTour = useCallback(() => {
    handleAuctionReset();
    setTimeout(() => { setTourActive(true); setTourStep(0); }, 100);
  }, [handleAuctionReset]);

  // Auto-start tour when entering auction phase (from waiting room)
  const handleAuctionStart = useCallback(() => {
    setPhase('auction');
    // Tour continues: jump to auction steps (step 8)
    setTimeout(() => {
      setTourActive(true);
      setTourStep(8);
    }, 300);
  }, []);

  // Start the full-flow tour from home phase
  useEffect(() => {
    // Auto-start tour on mount (guided demo always starts with tour)
    const t = setTimeout(() => {
      setTourActive(true);
      setTourStep(0);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  // ─── Tour steps (full flow: Home → Items → Favorites → Auction → Post-Auction) ───
  // Steps 0-1: Home phase
  // Steps 2-4: Items phase (overview, add favorite, set bid limit)
  // Steps 5-7: Favorites phase (navigate to favorites, overview, proceed to waiting)
  // Steps 8-17: Auction phase (10 steps: welcome, lane card, bid, opponent bid, battle, freeze, limit set, limit trigger, win, complete)
  // Steps 18-22: Post-Auction phase

  const tourSteps: TourStep[] = [
    // ── HOME phase (steps 0-1) ──
    { targetRef: homeBannerRef as React.RefObject<HTMLElement | null>, title: 'ガイド付きデモへようこそ！', description: 'ホーム画面です。次回開催予定のオークションの情報が表示されます。', placement: 'bottom' },
    { targetRef: itemsButtonRef as React.RefObject<HTMLElement | null>, title: '出品一覧を確認しよう', description: '「出品一覧」ボタンを押して出品されている商品を確認しましょう。', placement: 'bottom', waitForAction: '「出品一覧」をタップ' },

    // ── ITEMS phase (steps 2-4) ──
    { targetRef: itemsHeaderRef as React.RefObject<HTMLElement | null>, title: '出品一覧', description: '出品一覧です。レーンごとに商品を確認できます。各商品に指値（上限価格）やお気に入りを設定できます。', placement: 'bottom' },
    { targetRef: firstItemFavoriteRef as React.RefObject<HTMLElement | null>, title: 'お気に入りに追加しよう', description: '気になる商品のハートアイコンをタップして、お気に入りに追加してみましょう。', placement: 'right', waitForAction: 'ハートアイコンをタップ' },
    { targetRef: firstItemLimitRef as React.RefObject<HTMLElement | null>, title: '指値（上限価格）を設定しよう', description: '「上限設定」をタップして指値を設定してみましょう。設定した金額に達すると自動で入札がオフになる便利な機能です。', placement: 'bottom', waitForAction: '「上限設定」をタップ' },

    // ── FAVORITES phase (steps 5-7) ──
    { targetRef: favoritesNavRef as React.RefObject<HTMLElement | null>, title: 'お気に入り一覧へ', description: 'ヘッダーの「お気に入り」をタップして、お気に入り一覧ページを確認しましょう。', placement: 'bottom', waitForAction: '「お気に入り」をタップ' },
    { targetRef: favoritesHeaderRef as React.RefObject<HTMLElement | null>, title: 'お気に入り一覧', description: 'お気に入り一覧です。ここからも指値の設定やお気に入りの解除ができます。自由に操作してみてください。', placement: 'bottom' },
    {
      targetRef: favoritesHeaderRef as React.RefObject<HTMLElement | null>,
      title: '待機室へ進もう',
      description: 'お気に入りの確認ができました。次はオークション会場へ進みましょう。',
      placement: 'bottom',
      autoAction: () => {
        setPhase('waiting');
        setTourActive(false);
      },
      autoActionDelay: 500,
      autoActionLabel: '待機室へ進む',
    },

    // ── AUCTION phase (steps 8-17, Lane 1 only) ──
    { targetRef: demoHeaderRef, title: 'オークション体験デモへようこそ！', description: 'このデモでは、実際のオークション画面を操作しながら、入札の流れを体験できます。吹き出しの指示に従って進めてください。', placement: 'bottom' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: 'レーンカードの見方', description: '各レーンには品種名、現在価格、カウントダウンが表示されています。最大3つのレーンが同時に進行するのがこのオークションの特徴です。', placement: 'bottom' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '入札してみよう！', description: 'レーン1の「入札する」ボタンをタップしてみてください！', placement: 'bottom', waitForAction: 'レーン1の「入札する」をタップ' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '他の参加者が入札してきた！', description: 'フリーズ（誤タップ防止）が入った後、価格が上がりカウントダウンがリセットされる様子を確認してください。', placement: 'bottom', autoAction: () => { simulateOpponentBid(1); }, autoActionDelay: 4500, autoActionLabel: '相手の入札を見る' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '入札合戦！', description: '相手が入札してきました！フリーズ後に入札が解除されます。再度入札ボタンを押すと、相手も入札し返してきます。', placement: 'bottom', autoAction: () => { simulateBattleCycle(1); }, autoActionDelay: 4500, autoActionLabel: '入札合戦を開始' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: 'フリーズ（誤タップ防止）', description: '価格上昇直後、数秒間入札ボタンが無効になる「フリーズ」状態です。誤タップを防ぐ安全機能です。', placement: 'bottom', autoAction: () => { simulateFreezeHold(1); }, autoActionDelay: 500, autoActionLabel: 'フリーズを体験' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '指値（上限価格）を設定しよう', description: '指値を設定すると、価格が金額に達したとき自動で入札がオフになります。レーン1の「上限設定」を押してください。', placement: 'bottom', waitForAction: 'レーン1の「上限設定」をタップ' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '指値が発動！自動入札オフ', description: '相手が連続入札して指値に到達します。自動で入札がオフになる様子を確認してください。', placement: 'bottom', autoAction: () => { simulateLimitTrigger(); }, autoActionDelay: 6000, autoActionLabel: '指値発動を見る' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '落札の瞬間！', description: 'レーン1を落札します。紙吹雪の落札演出をお楽しみください！', placement: 'bottom', autoAction: () => { updateLaneItem(1, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 })); setTimeout(() => handleWin(1), 500); }, autoActionDelay: 4500, autoActionLabel: '落札する' },
    { targetRef: wonTableRef, title: 'オークション完了！', description: '落札結果が表示されました。次は落札者管理画面を確認しましょう。「次へ」で進みます。', placement: 'top' },

    // ── POST-AUCTION phase (steps 18-22) ──
    { targetRef: wonItemsHeaderRef as React.RefObject<HTMLElement | null>, title: '落札管理画面', description: '落札管理画面です。落札した商品の支払い・配送状況を確認できます。', placement: 'bottom' },
    { targetRef: firstWonItemRef as React.RefObject<HTMLElement | null>, title: '落札商品の詳細', description: '各商品の支払い状況、配送追跡、配送先の変更ができます。', placement: 'bottom' },
    { targetRef: settingsTabRef as React.RefObject<HTMLElement | null>, title: '設定タブ', description: '「設定」タブでプロフィールや通知設定を管理できます。', placement: 'bottom',
      autoAction: () => { setPostAuctionTab('settings'); },
      autoActionDelay: 500,
    },
    { targetRef: notificationSectionRef as React.RefObject<HTMLElement | null>, title: '通知設定', description: 'メール通知のオン/オフを切り替えられます。テスト送信も可能です。', placement: 'bottom' },
    { targetRef: settingsTabRef as React.RefObject<HTMLElement | null>, title: 'デモ完了！', description: 'ガイド付きデモが完了しました！実際のオークションでも同じ画面で操作できます。お疲れ様でした。', placement: 'bottom' },
  ];

  // Helper: determine which phase a step belongs to
  const getPhaseForStep = (step: number): GuidedPhase => {
    if (step <= 1) return 'home';
    if (step <= 4) return 'items';
    if (step <= 7) return 'favorites';
    if (step <= 17) return 'auction';
    return 'post-auction';
  };

  const goToStep = useCallback((targetStep: number) => {
    if (targetStep < 0 || targetStep >= tourSteps.length) {
      // Tour complete
      if (targetStep >= tourSteps.length) {
        setTourActive(false);
      }
      return;
    }
    // Handle phase transitions
    const targetPhase = getPhaseForStep(targetStep);
    if (targetPhase !== phase) {
      setPhase(targetPhase);
      // For waiting phase transition (items->waiting->auction), handled separately
    }

    // Cleanup from freeze step (auction step 13)
    if (tourStep === 13 && targetStep !== 13) {
      updateLaneItem(1, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
      startCountdown(1, 15);
    }
    setTourStep(targetStep);
  }, [tourStep, tourSteps, updateLaneItem, startCountdown, phase]);

  goToStepRef.current = goToStep;

  const handleExecuteAction = useCallback(() => {
    const step = tourSteps[tourStep];
    if (step?.autoAction) {
      setIsAutoPlaying(true);
      step.autoAction();
      // After action completes, auto-advance to next step
      setTimeout(() => {
        setIsAutoPlaying(false);
        goToStep(tourStep + 1);
      }, step.autoActionDelay || 1500);
    }
  }, [tourStep, tourSteps, goToStep]);

  const handleTourNext = useCallback(() => {
    if (tourStep === tourSteps.length - 1) {
      // Last step → tour complete
      setTourActive(false);
    } else {
      goToStep(tourStep + 1);
    }
  }, [tourStep, tourSteps.length, goToStep]);

  const handleTourPrev = useCallback(() => {
    if (tourStep > 0) goToStep(tourStep - 1);
  }, [tourStep, goToStep]);

  const handleTourClose = useCallback(() => {
    setTourActive(false);
    setTourStep(0);
  }, []);

  // ====================================================================
  // Render
  // ====================================================================

  // Navigation handler for DemoLayout
  const handleNavigate = (page: string) => {
    if (page === 'home') { setPhase('home'); }
    else if (page === 'items') { setPhase('items'); }
    else if (page === 'favorites') { handleNavigateFavorites(); }
    else if (page === 'post-auction') { setPhase('post-auction'); setPostAuctionTab('won-items'); }
    else if (page === 'settings') { setPhase('post-auction'); setPostAuctionTab('settings'); }
    else if (page === 'demo-top') { onBackToTop(); }
  };

  // Tour-aware phase transition handlers
  const handleHomeGoToItems = useCallback(() => {
    setPhase('items');
    if (tourActive && tourStep === 1) {
      // After step 1 action (tap items button), advance to step 2
      setTimeout(() => goToStepRef.current(2), 300);
    }
  }, [tourActive, tourStep]);

  const handleItemsGoToWaitingRoom = useCallback(() => {
    setPhase('waiting');
    if (tourActive) {
      // Tour pauses during waiting room, resumes at auction via handleAuctionStart
      setTourActive(false);
    }
  }, [tourActive]);

  // Tour-aware: favorite added on items page → advance from step 3 to step 4
  const handleItemFavoriteAdded = useCallback(() => {
    if (tourActive && tourStep === 3) {
      setTimeout(() => goToStepRef.current(4), 500);
    }
  }, [tourActive, tourStep]);

  // Tour-aware: limit set on items page → advance from step 4 to step 5
  const handleItemLimitSet = useCallback(() => {
    if (tourActive && tourStep === 4) {
      setTimeout(() => goToStepRef.current(5), 500);
    }
  }, [tourActive, tourStep]);

  // Tour-aware: navigate to favorites page
  const handleNavigateFavorites = useCallback(() => {
    setPhase('favorites');
    if (tourActive && tourStep === 5) {
      setTimeout(() => goToStepRef.current(6), 300);
    }
  }, [tourActive, tourStep]);

  // Shared tour popover element (rendered in non-auction phases)
  const tourPopoverElement = tourActive && !isLimitModalOpen ? (
    <DemoTourPopover
      steps={tourSteps}
      activeStep={tourStep}
      onNext={handleTourNext}
      onPrev={handleTourPrev}
      onClose={handleTourClose}
      onReset={handleStartTour}
      isAutoPlaying={isAutoPlaying}
      onExecuteAction={handleExecuteAction}
    />
  ) : null;

  if (phase === 'home') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate}>
        <DemoHome onGoToItems={handleHomeGoToItems} onGoToWaitingRoom={() => setPhase('waiting')} />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  if (phase === 'items') {
    return (
      <DemoLayout currentPage="items" onNavigate={handleNavigate}>
        <DemoItemList onGoToWaitingRoom={handleItemsGoToWaitingRoom} onFavoriteAdded={handleItemFavoriteAdded} onLimitSet={handleItemLimitSet} onLimitModalChange={setIsLimitModalOpen} />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  if (phase === 'favorites') {
    return (
      <DemoLayout currentPage="favorites" onNavigate={handleNavigate}>
        <DemoFavorites onNavigateToAuctions={() => setPhase('items')} />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  if (phase === 'waiting') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate}>
        <DemoWaitingRoom
          auctionTitle={MOCK_AUCTIONS[0].title}
          onAuctionStart={handleAuctionStart}
        />
      </DemoLayout>
    );
  }

  if (phase === 'post-auction') {
    return (
      <DemoLayout currentPage={postAuctionTab === 'settings' ? 'settings' : 'post-auction'} onNavigate={handleNavigate}>
        <PostAuctionGuide
          wonItems={wonItems}
          isGuided={!tourActive}
          onBackToTop={onBackToTop}
          controlledTab={tourActive ? postAuctionTab : undefined}
          onTabChange={setPostAuctionTab}
        />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  // phase === 'auction'
  return (
    <DemoLayout currentPage="items" onNavigate={handleNavigate}>
      <Box sx={{ bgcolor: 'grey.100', minHeight: '60vh', position: 'relative' }}>
        {celebration && <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />}

        {/* Auction header — matches real AuctionHeader */}
        <Container maxWidth="xl" sx={{ pt: 2 }}>
          <Paper ref={demoHeaderRef} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  {MOCK_AUCTIONS[0].title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  3/3レーン進行中
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip icon={<WifiIcon />} label="リアルタイム接続中" color="success" size="small" />
                <Chip icon={<PlayArrowIcon />} label="開催中" color="success" size="small" />
                <Button size="small" variant="outlined" startIcon={<ViewListIcon />}
                  onClick={() => setPhase('items')}>
                  出品一覧
                </Button>
                <IconButton size="small" onClick={() => {}}>
                  <RefreshIcon />
                </IconButton>
              </Box>
            </Box>
            {tourActive && (
              <Chip label={`ガイド進行中 (${tourStep + 1}/${tourSteps.length})`}
                color="primary" size="small" sx={{ mt: 1, fontWeight: 700, fontSize: '0.85rem' }} />
            )}
          </Paper>
        </Container>

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
        </Container>

        {/* Tour popover — 指値モーダルが開いている間は非表示 */}
        {tourActive && !limitModalLaneId && (
          <DemoTourPopover
            steps={tourSteps}
            activeStep={tourStep}
            onNext={handleTourNext}
            onPrev={handleTourPrev}
            onClose={handleTourClose}
            onReset={handleStartTour}
            isAutoPlaying={isAutoPlaying}
            onExecuteAction={handleExecuteAction}
          />
        )}

        {/* BidLimitModal */}
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

        <Snackbar open={snackbar.open} autoHideDuration={3000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DemoLayout>
  );
}
