/**
 * ガイド付きデモ
 * フロー: ホーム画面 → 出品一覧 → 待機室 → オークション（既存のツアー） → 落札者管理ガイド
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Paper, Grid, Button,
  Chip, IconButton, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useMediaQuery, useTheme,
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
import { ItemDetailDialog } from '../../features/auction-live/components/ItemDetailDialog';
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
import { calculatePriceIncrement } from './cpuBidder';

type GuidedPhase = 'home' | 'items' | 'favorites' | 'waiting' | 'auction' | 'post-auction';

interface GuidedDemoProps {
  onBackToTop: () => void;
}

// ====================================================================
// デモ用 固定価格テーブル（ステップごとに確定した金額）
// ====================================================================
const DEMO_PRICES = {
  INITIAL: 300,           // STEP 10-11: 初期価格
  AFTER_USER_BID_1: 400,  // STEP 12: ユーザー初回入札後
  AFTER_CPU_BID_1: 500,   // STEP 13: 相手入札後
  AFTER_USER_BID_2: 600,  // STEP 14 入札合戦①: ユーザー入札
  AFTER_CPU_BID_2: 700,   // STEP 14 入札合戦①: 相手反撃
  AFTER_USER_BID_3: 800,  // STEP 14 入札合戦②: ユーザー入札（合戦完了）
  LIMIT_PRICE: 1200,      // STEP 15: 指値 = ¥800 × 1.5
  LIMIT_STEPS: [900, 1000, 1100, 1200], // STEP 16: 指値発動の価格推移
  AFTER_WIN_BID: 1300,    // STEP 17: 落札入札後
};

// ====================================================================
// メインコンポーネント
// ====================================================================

export function GuidedDemo({ onBackToTop }: GuidedDemoProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [phase, setPhase] = useState<GuidedPhase>('home');

  // ─── Auction state ───
  const [lanes, setLanes] = useState<LiveLane[]>(() => {
    const initial: LiveLane[] = JSON.parse(JSON.stringify(GUIDED_INITIAL_LANES));
    // ガイドデモではカウントダウン8秒表示（タイマーは入札時まで開始しない）
    initial.forEach(l => { if (l.current_item) l.current_item.countdown_seconds = 8; });
    return initial;
  });
  const [upcoming, setUpcoming] = useState(GUIDED_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [detailLane, setDetailLane] = useState<LiveLane | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [hideMobileFooter, setHideMobileFooter] = useState(false);
  const [itemListResetKey, setItemListResetKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  // 入札合戦のラウンド数（step 13で使用）
  const battleRoundRef = useRef(0);

  // Post-auction controlled tab
  const [postAuctionTab, setPostAuctionTab] = useState<string>('won-items');
  const [settingsSubTab, setSettingsSubTab] = useState<number | undefined>(undefined);

  // Tour refs - auction phase (static)
  const demoHeaderRef = useRef<HTMLDivElement>(null);
  const laneCardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null, null]);
  const lane1Ref = useRef<HTMLDivElement | null>(null);
  const lane2Ref = useRef<HTMLDivElement | null>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const wonTableRef = useRef<HTMLDivElement>(null);
  const goToStepRef = useRef<(step: number) => void>(() => {});

  // Tour refs - dynamic (resolved via data-tour-target attributes)
  const homeBannerRef = useRef<HTMLElement | null>(null);
  const itemsButtonRef = useRef<HTMLElement | null>(null);
  const itemsHeaderRef = useRef<HTMLElement | null>(null);
  const itemsFilterAreaRef = useRef<HTMLElement | null>(null);
  const firstItemCardRef = useRef<HTMLElement | null>(null);
  const firstItemFavoriteRef = useRef<HTMLElement | null>(null);
  const firstItemLimitRef = useRef<HTMLElement | null>(null);
  const waitingRoomButtonRef = useRef<HTMLElement | null>(null);
  const hamburgerMenuRef = useRef<HTMLElement | null>(null);
  const favoritesNavRef = useRef<HTMLElement | null>(null);
  const favoritesHeaderRef = useRef<HTMLElement | null>(null);
  const bannerWaitingRoomRef = useRef<HTMLElement | null>(null);
  const postAuctionNavRef = useRef<HTMLElement | null>(null);
  const wonItemsHeaderRef = useRef<HTMLElement | null>(null);
  const firstWonItemRef = useRef<HTMLElement | null>(null);
  const settingsNavRef = useRef<HTMLElement | null>(null);
  const notificationSubTabRef = useRef<HTMLElement | null>(null);
  const notificationSectionRef = useRef<HTMLElement | null>(null);

  // Resolve dynamic refs after phase/tab changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    // 可視な要素を優先して取得（Drawer内の非表示要素を回避）
    const findVisible = (selector: string): HTMLElement | null => {
      const all = document.querySelectorAll<HTMLElement>(selector);
      for (const el of all) {
        if (el.offsetParent !== null || el.getClientRects().length > 0) return el;
      }
      return all[0] ?? null;
    };
    const resolve = () => {
      homeBannerRef.current = findVisible('[data-tour-target="home-banner"]');
      itemsButtonRef.current = findVisible('[data-tour-target="home-items-button"]');
      itemsHeaderRef.current = findVisible('[data-tour-target="items-header"]');
      itemsFilterAreaRef.current = findVisible('[data-tour-target="items-filter-area"]');
      firstItemCardRef.current = findVisible('[data-tour-target="items-first-card"]');
      firstItemFavoriteRef.current = findVisible('[data-tour-target="items-first-favorite"]');
      firstItemLimitRef.current = findVisible('[data-tour-target="items-first-limit"]');
      waitingRoomButtonRef.current = findVisible('[data-tour-target="items-waiting-button"]');
      hamburgerMenuRef.current = findVisible('[data-tour-target="hamburger-menu"]');
      favoritesNavRef.current = findVisible('[data-tour-target="favorites-nav"]');
      favoritesHeaderRef.current = findVisible('[data-tour-target="favorites-header"]');
      bannerWaitingRoomRef.current = findVisible('[data-tour-target="banner-waiting-room"]');
      postAuctionNavRef.current = findVisible('[data-tour-target="post-auction-nav"]');
      wonItemsHeaderRef.current = findVisible('[data-tour-target="won-items-header"]');
      firstWonItemRef.current = findVisible('[data-tour-target="won-first-item"]');
      settingsNavRef.current = findVisible('[data-tour-target="settings-nav"]');
      notificationSubTabRef.current = findVisible('[data-tour-target="notification-sub-tab"]');
      notificationSectionRef.current = findVisible('[data-tour-target="notification-section"]');
    };
    // Resolve immediately and after a short delay (for DOM to settle)
    resolve();
    const t = setTimeout(() => { resolve(); forceUpdate(n => n + 1); }, 100);
    return () => clearTimeout(t);
  }, [phase, postAuctionTab, tourStep, drawerOpen]);

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
  });

  // ─── Simulation helpers ───

  // 共通: フリーズ演出（指定秒後にonCompleteを呼ぶ）
  const runFreeze = useCallback((laneId: number, seconds: number, onComplete: () => void) => {
    let remaining = seconds;
    const ft = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(ft);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
        onComplete();
      } else {
        updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [updateLaneItem]);

  // 相手が1回入札（1秒待機後にフリーズ→カウントダウン再開）
  const simulateOpponentBid = useCallback((laneId: number) => {
    setTimeout(() => {
      stopTimer(laneId);
      updateLaneItem(laneId, item => ({
        ...item,
        phase: 'freeze' as const,
        freeze_remaining_seconds: 3,
        freeze_countdown_seconds: 3,
        current_price: DEMO_PRICES.AFTER_CPU_BID_1,
        active_bidders_count: Math.max(2, item.active_bidders_count),
        my_bid_status: item.my_bid_status === 'active' ? 'inactive' as const : item.my_bid_status,
      }));
      notify('他の参加者が入札！価格が上昇しました', 'warning');
      runFreeze(laneId, 3, () => {
        startCountdown(laneId, 8);
      });
    }, 1000);
  }, [stopTimer, updateLaneItem, startCountdown, notify, runFreeze]);

  // 入札合戦(step 13): CPUが入札を返してくる（ユーザーの入札後に自動発動）
  const simulateBattleResponse = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, item => ({
      ...item,
      phase: 'freeze' as const,
      freeze_remaining_seconds: 3,
      freeze_countdown_seconds: 3,
      current_price: DEMO_PRICES.AFTER_CPU_BID_2,
      active_bidders_count: Math.max(2, item.active_bidders_count),
      my_bid_status: 'inactive' as const,
    }));
    notify('他の参加者が入札！フリーズ中...', 'warning');
    runFreeze(laneId, 3, () => {
      startCountdown(laneId, 8);
      notify('フリーズ解除！再度入札してください', 'info');
      setHideMobileFooter(false);
    });
  }, [stopTimer, updateLaneItem, startCountdown, notify, runFreeze]);

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
    const steps = DEMO_PRICES.LIMIT_STEPS;
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
      return;
    } else {
      // 入札時に固定価格を設定
      const fixedPrice = tourActive && tourStep === 11 ? DEMO_PRICES.AFTER_USER_BID_1
        : tourActive && tourStep === 13 && battleRoundRef.current === 0 ? DEMO_PRICES.AFTER_USER_BID_2
        : tourActive && tourStep === 13 && battleRoundRef.current >= 1 ? DEMO_PRICES.AFTER_USER_BID_3
        : tourActive && tourStep === 16 ? DEMO_PRICES.AFTER_WIN_BID
        : null;
      updateLaneItem(lane.lane_id, i => ({
        ...i,
        my_bid_status: 'active',
        active_bidders_count: i.active_bidders_count + 1,
        current_price: fixedPrice ?? i.current_price + calculatePriceIncrement(i.current_price),
      }));
      startCountdown(lane.lane_id, 8);
      notify(`レーン${lane.lane_number}に入札しました！`, 'success');
      if (tourActive && tourStep === 11) {
        // step 11: 初回入札 → 次のステップへ
        setHideMobileFooter(true);
        setTimeout(() => { setHideMobileFooter(false); goToStepRef.current(12); }, 1200);
      }
      if (tourActive && tourStep === 13) {
        // step 13: 入札合戦 — ユーザーが入札したらCPUが反撃
        setHideMobileFooter(true);
        battleRoundRef.current += 1;
        if (battleRoundRef.current >= 2) {
          // 2ラウンド完了 → 次のステップへ
          notify('入札合戦完了！次のステップに進みます', 'success');
          setTimeout(() => { setHideMobileFooter(false); goToStepRef.current(14); }, 1500);
        } else {
          // CPUが反撃（1.5秒後に入札を返す）
          setTimeout(() => simulateBattleResponse(lane.lane_id), 1500);
        }
      }
      if (tourActive && tourStep === 16) {
        // step 16: 落札 — 入札後に8秒カウントダウンで落札
        setHideMobileFooter(true);
        stopTimer(lane.lane_id);
        startCountdown(lane.lane_id, 8);
        setTimeout(() => {
          handleWin(lane.lane_id);
          setHideMobileFooter(false);
          setTimeout(() => goToStepRef.current(17), 2000);
        }, 8500);
      }
    }
  }, [lanes, notify, updateLaneItem, startCountdown, stopTimer, tourActive, tourStep, simulateBattleResponse, handleWin]);

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

  // Auto-start tour when entering auction phase (from waiting room)
  const handleAuctionStart = useCallback(() => {
    setPhase('auction');
    // Tour continues: jump to auction steps (step 9)
    // DOMレンダリング + ref解決を待ってからツアーを再開
    setTimeout(() => {
      // lane refs の解決を確実にする
      lane1Ref.current = laneCardRefs.current[0];
      lane2Ref.current = laneCardRefs.current[1];
      setTourStep(9);
      setTourActive(true);
      // ref解決後にもう一度forceUpdateして位置計算を確実にする
      setTimeout(() => forceUpdate(n => n + 1), 100);
    }, 600);
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
  // Steps 2-5: Items phase (overview, item detail, add favorite, set bid limit)
  // Steps 6-8: Favorites phase (navigate to favorites, overview, waiting room via banner)
  // Steps 9-17: Auction phase (9 steps: welcome, lane card, bid, opponent bid, battle+freeze, limit set, limit trigger, win, complete)
  // Step 18: Navigate to post-auction (header tap)
  // Steps 19-23: Post-Auction phase

  const tourSteps: TourStep[] = [
    // ── HOME phase (steps 0-1) ──
    { targetRef: homeBannerRef as React.RefObject<HTMLElement | null>, title: 'ガイド付きデモへようこそ！', description: 'ホーム画面です。次回開催予定のオークションの情報が表示されます。', placement: 'bottom' },
    { targetRef: itemsButtonRef as React.RefObject<HTMLElement | null>, title: '出品一覧を確認しよう', description: '「出品一覧」ボタンを押して出品されている商品を確認しましょう。', placement: 'bottom', waitForAction: '「出品一覧」をタップ' },

    // ── ITEMS phase (steps 2-5) ──
    { targetRef: itemsFilterAreaRef as React.RefObject<HTMLElement | null>, title: '出品一覧', description: '出品一覧です。レーンごとに商品を確認できます。各商品に指値（上限価格）やお気に入りを設定できます。', placement: 'bottom' },
    { targetRef: firstItemCardRef as React.RefObject<HTMLElement | null>, title: '商品の詳細を見てみよう', description: '商品カードの「詳細」ボタンをタップすると、写真や検査情報などの詳細を確認できます。', placement: 'bottom', waitForAction: '「詳細」ボタンをタップ', tapTargetSelector: '[data-tour-target="item-detail-chip"]' },
    { targetRef: firstItemFavoriteRef as React.RefObject<HTMLElement | null>, title: 'お気に入りに追加しよう', description: '気になる商品のハートアイコンをタップして、お気に入りに追加してみましょう。', placement: 'right', waitForAction: 'ハートアイコンをタップ' },
    { targetRef: firstItemLimitRef as React.RefObject<HTMLElement | null>, title: '指値（上限価格）について', description: '指値を設定すると、設定した金額に達した際に自動で入札がオフになります。この後の実際のオークションデモの際に詳しくご説明します。', placement: 'bottom' },

    // ── FAVORITES phase (steps 6-8) ──
    { targetRef: (isMobile ? (drawerOpen ? favoritesNavRef : hamburgerMenuRef) : favoritesNavRef) as React.RefObject<HTMLElement | null>, title: 'お気に入り一覧へ', description: isMobile ? (drawerOpen ? '「お気に入り」をタップしましょう。' : 'メニューを開いて「お気に入り」をタップしましょう。') : 'ヘッダーの「お気に入り」をタップして、お気に入り一覧ページを確認しましょう。', placement: isMobile && drawerOpen ? 'right' : 'bottom', waitForAction: isMobile ? (drawerOpen ? '「お気に入り」をタップ' : 'メニューをタップ') : '「お気に入り」をタップ' },
    { targetRef: favoritesHeaderRef as React.RefObject<HTMLElement | null>, title: 'お気に入り一覧', description: 'お気に入り一覧です。ここからも指値の設定やお気に入りの解除ができます。', placement: 'bottom' },
    { targetRef: bannerWaitingRoomRef as React.RefObject<HTMLElement | null>, title: '待機室へ進もう', description: 'バナーの「待機室へ入室」をタップして、オークション会場へ進みましょう。', placement: 'bottom', waitForAction: '「待機室へ入室」をタップ' },

    // ── AUCTION phase (steps 8-17, Lane 1 only) ──
    { targetRef: demoHeaderRef, title: 'オークション体験デモへようこそ！', description: 'このデモでは、実際のオークション画面を操作しながら、入札の流れを体験できます。吹き出しの指示に従って進めてください。', placement: 'bottom' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: 'レーンカードの見方', description: '各レーンには品種名、現在価格、カウントダウンが表示されています。複数のレーンが同時に進行するのがこのオークションの特徴です。', placement: 'bottom' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '入札してみよう！', description: 'レーン1の「入札する」ボタンをタップしてみてください！', placement: 'bottom', waitForAction: 'レーン1の「入札する」をタップ', tapTargetSelector: '.MuiCardActions-root button:first-child' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '他の参加者が入札してきます！', description: 'フリーズ（誤タップ防止）が入った後、価格が上がりカウントダウンがリセットされる様子を確認してください。', placement: 'bottom', autoAction: () => { simulateOpponentBid(1); }, autoActionDelay: 5500, autoActionLabel: '相手の入札を見る' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '入札合戦！再度入札しよう', description: 'フリーズ解除後に「入札する」ボタンをタップしてください。相手が入札を返してくるので、2回入札してみましょう。', placement: 'bottom', waitForAction: 'レーン1の「入札する」をタップ', tapTargetSelector: '.MuiCardActions-root button:first-child' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '指値（上限価格）を設定しよう', description: '指値を設定すると、価格が金額に達したとき自動で入札がオフになります。レーン1の「上限設定」を押してください。', placement: 'bottom', waitForAction: 'レーン1の「上限設定」をタップ', tapTargetSelector: '[data-tour-target="bid-limit-chip"]' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '指値が発動！自動入札オフ', description: '相手が連続入札して指値に到達します。自動で入札がオフになる様子を確認してください。', placement: 'bottom', autoAction: () => { simulateLimitTrigger(); }, autoActionDelay: 6000, autoActionLabel: '指値発動を見る' },
    { targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>, title: '落札してみよう！', description: '「入札する」ボタンをタップしてください。カウントダウンが0秒になると落札です！', placement: 'bottom', waitForAction: 'レーン1の「入札する」をタップ', tapTargetSelector: '.MuiCardActions-root button:first-child' },
    { targetRef: wonTableRef, title: 'オークション完了！', description: '落札結果が表示されました。次は落札者管理画面を確認しましょう。「次へ」で進みます。', placement: 'top' },

    // ── POST-AUCTION phase (steps 18-23) ──
    { targetRef: (isMobile ? (drawerOpen ? postAuctionNavRef : hamburgerMenuRef) : postAuctionNavRef) as React.RefObject<HTMLElement | null>, title: '落札管理画面へ', description: isMobile ? (drawerOpen ? '「落札管理」をタップしましょう。' : 'メニューを開いて「落札管理」をタップしましょう。') : 'ヘッダーの「落札管理」をタップして、落札管理画面に移動しましょう。', placement: isMobile && drawerOpen ? 'right' : 'bottom', waitForAction: isMobile ? (drawerOpen ? '「落札管理」をタップ' : 'メニューをタップ') : '「落札管理」をタップ', tapTargetSelector: isMobile ? (drawerOpen ? '[data-tour-target="post-auction-nav"]' : '[data-tour-target="hamburger-menu"]') : '[data-tour-target="post-auction-nav"]' },
    { targetRef: wonItemsHeaderRef as React.RefObject<HTMLElement | null>, title: '落札管理画面', description: '落札管理画面です。落札した商品の支払い・配送状況を確認できます。', placement: 'bottom' },
    { targetRef: firstWonItemRef as React.RefObject<HTMLElement | null>, title: '落札商品の詳細', description: '各商品の支払い状況、配送追跡ができます。', placement: 'bottom' },
    { targetRef: (isMobile ? (drawerOpen ? settingsNavRef : hamburgerMenuRef) : settingsNavRef) as React.RefObject<HTMLElement | null>, title: '設定ページへ', description: isMobile ? (drawerOpen ? '「設定」をタップしましょう。' : 'メニューを開いて「設定」をタップしましょう。') : 'ヘッダーの「設定」をタップして、設定ページに移動しましょう。', placement: isMobile && drawerOpen ? 'right' : 'bottom', waitForAction: isMobile ? (drawerOpen ? '「設定」をタップ' : 'メニューをタップ') : '「設定」をタップ', tapTargetSelector: isMobile ? (drawerOpen ? '[data-tour-target="settings-nav"]' : '[data-tour-target="hamburger-menu"]') : '[data-tour-target="settings-nav"]' },
    { targetRef: notificationSubTabRef as React.RefObject<HTMLElement | null>, title: '通知設定', description: '「通知設定」タブをタップして、メール通知の設定を確認しましょう。', placement: 'bottom', waitForAction: '「通知設定」タブをタップ' },
    { targetRef: notificationSectionRef as React.RefObject<HTMLElement | null>, title: '通知設定', description: 'メール通知のオン/オフを切り替えられます。落札通知や入金確認など、取引に関する通知とオークション開催通知を個別に設定できます。', placement: 'bottom' },
    { targetRef: { current: null } as React.RefObject<HTMLElement | null>, title: 'デモ完了！', description: 'ガイド付きデモが完了しました！\n実際のオークションでも同じ画面で操作できます。\nお疲れ様でした。', placement: 'bottom' },
  ];

  // Helper: determine which phase a step belongs to
  const getPhaseForStep = (step: number): GuidedPhase => {
    if (step <= 1) return 'home';
    if (step <= 5) return 'items';
    if (step <= 8) return 'favorites';
    if (step <= 17) return 'auction';
    // step 18 = post-auction-navだが、オークション画面にヘッダーナビがあるのでauction phaseに留める
    if (step === 18) return 'auction';
    return 'post-auction';
  };

  const goToStep = useCallback((targetStep: number) => {
    if (targetStep < 0 || targetStep >= tourSteps.length) {
      if (targetStep >= tourSteps.length) {
        setTourActive(false);
      }
      return;
    }
    const targetPhase = getPhaseForStep(targetStep);
    const targetStepDef = tourSteps[targetStep];
    const isForward = targetStep > tourStep;
    if (targetPhase !== phase && !(isForward && targetStepDef?.waitForAction)) {
      setPhase(targetPhase);
    }

    // ── 後退時: オークションステップの状態をリセット ──
    if (!isForward && targetStep <= 14) {
      // step 9-14 に戻る場合: レーン1の価格・入札状態・指値を固定初期値に戻す
      stopTimer(1);
      setLanes(prev => prev.map(l =>
        l.lane_id === 1 ? {
          ...l,
          current_item: l.current_item ? {
            ...l.current_item,
            current_price: DEMO_PRICES.INITIAL,
            my_bid_status: null,
            active_bidders_count: 0,
            my_limit_price: null,
            my_limit_triggered: false,
            phase: 'bidding' as const,
            freeze_remaining_seconds: 0,
            countdown_seconds: 8,
          } : l.current_item,
        } : l
      ));
      // 入札合戦ラウンドもリセット
      battleRoundRef.current = 0;
      // 落札結果もリセット
      setWonItems([]);
      setCelebration(null);
    }

    // ITEMS phase の後退: お気に入り・指値をリセット
    if (!isForward && targetStep <= 4) {
      setItemListResetKey(k => k + 1);
    }

    // step 13 の cleanup
    if (tourStep === 13 && targetStep !== 13) {
      updateLaneItem(1, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
      if (targetStep > 13) {
        startCountdown(1, 8);
      }
    }

    // step 13 に入るときはラウンドリセット
    if (targetStep === 13 && tourStep !== 13) {
      battleRoundRef.current = 0;
    }

    setTourStep(targetStep);
  }, [tourStep, tourSteps, updateLaneItem, startCountdown, stopTimer, phase]);

  goToStepRef.current = goToStep;

  const handleExecuteAction = useCallback(() => {
    const step = tourSteps[tourStep];
    if (step?.autoAction) {
      setIsAutoPlaying(true);
      setHideMobileFooter(true);
      step.autoAction();
      const delay = step.autoActionDelay;
      // delay === 0 はアクション内で完結する（待機室遷移など）ため自動advanceしない
      if (delay !== 0) {
        setTimeout(() => {
          setIsAutoPlaying(false);
          setHideMobileFooter(false);
          goToStep(tourStep + 1);
        }, delay || 1500);
      }
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


  // ====================================================================
  // Render
  // ====================================================================

  // Navigation handler for DemoLayout
  const handleNavigate = (page: string) => {
    // ガイド中はステップに対応するナビゲーションのみ許可
    if (tourActive) {
      if (page === 'favorites' && tourStep === 6) { handleNavigateFavorites(); return; }
      if (page === 'post-auction' && tourStep === 18) {
        setTourStep(19);
        setPhase('post-auction');
        setPostAuctionTab('won-items');
        return;
      }
      if (page === 'settings' && tourStep === 21) {
        setTourStep(22);
        setPhase('post-auction');
        setPostAuctionTab('settings');
        return;
      }
      // それ以外はブロック
      return;
    }
    if (page === 'home') { setPhase('home'); }
    else if (page === 'items') { setPhase('items'); }
    else if (page === 'favorites') { handleNavigateFavorites(); }
    else if (page === 'post-auction') { setPhase('post-auction'); setPostAuctionTab('won-items'); }
    else if (page === 'settings') { setPhase('post-auction'); setPostAuctionTab('settings'); }
    else if (page === 'demo-top') { onBackToTop(); }
  };

  // Tour-aware phase transition handlers
  const handleHomeGoToItems = useCallback(() => {
    if (tourActive && tourStep === 1) {
      // ステップを先に進めてからphaseを変更（フォールバック表示のちらつき防止）
      setTourStep(2);
      setPhase('items');
    } else {
      setPhase('items');
    }
  }, [tourActive, tourStep]);

  // 待機室へ遷移（バナー or 出品一覧のボタンから）
  const handleGoToWaitingRoom = useCallback(() => {
    setPhase('waiting');
    if (tourActive) {
      // Tour pauses during waiting room, resumes at auction via handleAuctionStart
      setTourActive(false);
    }
  }, [tourActive]);

  // Tour-aware: item detail opened on items page (no auto-advance, wait for close)
  const handleItemDetailOpened = useCallback(() => {
    // モーダルが開いたことを記録するのみ（閉じた時にステップを進める）
  }, []);

  // Tour-aware: item detail closed on items page → advance from step 3 to step 4
  const handleItemDetailClosed = useCallback(() => {
    if (tourActive && tourStep === 3) {
      setTimeout(() => goToStepRef.current(4), 500);
    }
  }, [tourActive, tourStep]);

  // Tour-aware: favorite added on items page → advance from step 4 to step 5
  const handleItemFavoriteAdded = useCallback(() => {
    if (tourActive && tourStep === 4) {
      setTimeout(() => goToStepRef.current(5), 500);
    }
  }, [tourActive, tourStep]);

  // Tour-aware: limit set on items page → advance from step 5 to step 6
  const handleItemLimitSet = useCallback(() => {
    if (tourActive && tourStep === 5) {
      setTimeout(() => goToStepRef.current(6), 500);
    }
  }, [tourActive, tourStep]);

  // Tour-aware: navigate to favorites page
  const handleNavigateFavorites = useCallback(() => {
    if (tourActive && tourStep === 6) {
      setTourStep(7);
      setPhase('favorites');
    } else {
      setPhase('favorites');
    }
  }, [tourActive, tourStep]);

  // Tour-aware: notification sub-tab clicked → advance from step 22 to step 23
  const handleSettingsSubTabChange = useCallback((subTab: number) => {
    setSettingsSubTab(subTab);
    if (tourActive && tourStep === 22 && subTab === 1) {
      setTimeout(() => goToStepRef.current(23), 300);
    }
  }, [tourActive, tourStep]);

  const handleSignup = useCallback(() => {
    window.location.href = '/register';
  }, []);

  // Shared tour popover element (rendered in non-auction phases)
  const tourPopoverElement = tourActive ? (
    <DemoTourPopover
      steps={tourSteps}
      activeStep={tourStep}
      onNext={handleTourNext}
      onPrev={handleTourPrev}
      onReset={onBackToTop}
      isAutoPlaying={isAutoPlaying}
      onExecuteAction={handleExecuteAction}
      onSignup={handleSignup}
      hideFooter={hideMobileFooter}
      drawerOpen={drawerOpen}
    />
  ) : null;

  if (phase === 'home') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate} tourActive={tourActive} onDrawerToggle={setDrawerOpen}>
        <DemoHome onGoToItems={handleHomeGoToItems} onGoToWaitingRoom={() => setPhase('waiting')} disableWaitingRoom={tourActive} />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  if (phase === 'items') {
    return (
      <DemoLayout currentPage="items" onNavigate={handleNavigate} showAuctionBanner onGoToWaitingRoom={handleGoToWaitingRoom} disableWaitingRoomBanner={tourActive && tourStep !== 8} tourActive={tourActive} onDrawerToggle={setDrawerOpen}>
        <DemoItemList key={itemListResetKey} onGoToWaitingRoom={handleGoToWaitingRoom} onFavoriteAdded={handleItemFavoriteAdded} onLimitSetCallback={handleItemLimitSet} onItemDetailOpened={handleItemDetailOpened} onItemDetailClosed={handleItemDetailClosed} activeOnly={tourActive && tourStep === 3 ? 'info' : tourActive && tourStep === 4 ? 'favorite' : undefined} />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  if (phase === 'favorites') {
    return (
      <DemoLayout currentPage="favorites" onNavigate={handleNavigate} showAuctionBanner onGoToWaitingRoom={handleGoToWaitingRoom} disableWaitingRoomBanner={tourActive && tourStep !== 8} tourActive={tourActive} onDrawerToggle={setDrawerOpen}>
        <DemoFavorites onNavigateToAuctions={() => setPhase('items')} blockNonLimitActions={tourActive} />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  if (phase === 'waiting') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate} tourActive={tourActive} onDrawerToggle={setDrawerOpen}>
        <DemoWaitingRoom
          auctionTitle={MOCK_AUCTIONS[0].title}
          onAuctionStart={handleAuctionStart}
        />
      </DemoLayout>
    );
  }

  if (phase === 'post-auction') {
    return (
      <DemoLayout currentPage={postAuctionTab === 'settings' ? 'settings' : 'post-auction'} onNavigate={handleNavigate} showAuctionBanner onGoToWaitingRoom={handleGoToWaitingRoom} disableWaitingRoomBanner={tourActive} tourActive={tourActive} onDrawerToggle={setDrawerOpen}>
        <PostAuctionGuide
          wonItems={wonItems}
          onBackToTop={onBackToTop}
          controlledTab={tourActive ? postAuctionTab : undefined}
          onTabChange={setPostAuctionTab}
          controlledSettingsSubTab={tourActive ? settingsSubTab : undefined}
          onSettingsSubTabChange={handleSettingsSubTabChange}
        />
        {tourPopoverElement}
      </DemoLayout>
    );
  }

  // phase === 'auction'
  return (
    <DemoLayout currentPage="items" onNavigate={handleNavigate} tourActive={tourActive} onDrawerToggle={setDrawerOpen}>
      <Box sx={{ bgcolor: 'grey.100', minHeight: '60vh', position: 'relative', overflow: 'hidden' }}>
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
                  6/6レーン進行中
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip icon={<WifiIcon />} label="リアルタイム接続中" color="success" size="small" />
                <Chip icon={<PlayArrowIcon />} label="開催中" color="success" size="small" />
                <Button size="small" variant="outlined" startIcon={<ViewListIcon />}
                  onClick={() => setPhase('items')}
                  sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
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

        <Container maxWidth="xl" sx={{ py: 3, pb: tourActive && isMobile ? '220px' : 3 }}>
          {/* Lane grid */}
          <Grid container spacing={2}>
            {lanes.map((lane, idx) => (
              <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                <Box ref={(el: HTMLDivElement | null) => { laneCardRefs.current[idx] = el; }}>
                  <LaneCard
                    lane={lane} isLoading={false}
                    onBidToggle={handleBidToggle}
                    onDetailOpen={(l) => setDetailLane(l)}
                    disableDetail={tourActive && (tourStep === 11 || tourStep === 13 || tourStep === 16)}
                    onLimitEdit={tourActive && (tourStep === 11 || tourStep === 13 || tourStep === 16) ? undefined : (itemId) => {
                      const targetLane = lanes.find(la => la.current_item?.id === itemId);
                      if (targetLane) setLimitModalLaneId(targetLane.lane_id);
                    }}
                    onLimitRemove={tourActive && (tourStep === 11 || tourStep === 13 || tourStep === 16) ? undefined : (itemId) => {
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

        {/* Tour popover */}
        {tourActive && (
          <DemoTourPopover
            steps={tourSteps}
            activeStep={tourStep}
            onNext={handleTourNext}
            onPrev={handleTourPrev}
            onReset={onBackToTop}
            isAutoPlaying={isAutoPlaying}
            onExecuteAction={handleExecuteAction}
            onSignup={handleSignup}
            hideFooter={hideMobileFooter}
            drawerOpen={drawerOpen}
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
            zIndex={1500}
            allowedPrice={tourActive && tourStep === 14 ? DEMO_PRICES.LIMIT_PRICE : undefined}
          />
        )}

        {/* ItemDetailDialog（本番と同じ詳細ダイアログ） */}
        <ItemDetailDialog
          open={!!detailLane}
          item={
            (detailLane
              ? lanes.find(l => l.lane_id === detailLane.lane_id)?.current_item
              : null) as LaneItem | null
          }
          onClose={() => setDetailLane(null)}
          onBidToggle={(itemId, status) => handleBidToggle(itemId, status)}
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
          zIndex={1500}
        />

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
