/**
 * ガイドなしデモ
 * 2レーン x 各3匹 = 6匹のリアルなオークション体験
 * 10人のCPU参加者がフロントエンドのみで入札ロジックを実行
 *
 * 本番のオークションロジック:
 * - ユーザーが入札 → BidParticipant(active) 登録
 * - 2人以上active → サーバーが即座にprice increment + freeze
 * - freeze解除後 → bidding再開(countdown 15s)
 * - countdown=0 で active=1人 → その人が落札(sold)
 * - countdown=0 で active=0人 → 不成立(unsold)
 * - 価格上昇時、前の入札者は自動deactivate(指値がない場合)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid, IconButton,
  Chip, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Pets as PetsIcon,
  Wifi as WifiIcon,
  PlayArrow as PlayArrowIcon,
  ViewList as ViewListIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem, UpcomingItem } from '@/types';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { DemoLayout } from './DemoLayout';
import { DemoHome } from './DemoHome';
import { DemoItemList } from './DemoItemList';
import { DemoFavorites } from './DemoFavorites';
import { DemoWaitingRoom } from './DemoWaitingRoom';
import { PostAuctionGuide } from './PostAuctionGuide';
import {
  makeLane,
  FREE_LANE1_ITEMS, FREE_LANE2_ITEMS,
  CPU_CHARACTERS,
  MOCK_AUCTIONS,
  LANE_ITEM_ID_TO_ITEM_ID,
  type WonEntry,
} from './mockData';
import { initCpuState, calculatePriceIncrement, type CpuBidState } from './cpuBidder';

type FreeDemoPhase = 'home' | 'items' | 'favorites' | 'waiting' | 'auction' | 'post-auction';

interface FreeDemoProps {
  onBackToTop: () => void;
}

// 各レーンのアイテムキュー
const LANE_QUEUES: LaneItem[][] = [
  FREE_LANE1_ITEMS.map(i => ({ ...i })),
  FREE_LANE2_ITEMS.map(i => ({ ...i })),
];

export function FreeDemo({ onBackToTop }: FreeDemoProps) {
  const [phase, setPhase] = useState<FreeDemoPhase>('home');

  // 初回マウント時にページ最上部へスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ─── Shared state (出品一覧 ↔ お気に入り ↔ オークション で共有) ───
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [limitSettings, setLimitSettings] = useState<Record<number, { limit_price: number | null; is_triggered: boolean }>>({});

  const handleFavoriteToggle = useCallback((itemId: number) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleItemLimitSet = useCallback((itemId: number, price: number) => {
    setLimitSettings(prev => ({ ...prev, [itemId]: { limit_price: price, is_triggered: false } }));
  }, []);

  const handleItemLimitRemove = useCallback((itemId: number) => {
    setLimitSettings(prev => { const next = { ...prev }; delete next[itemId]; return next; });
  }, []);

  // ─── Auction state ───
  const [lanes, setLanes] = useState<LiveLane[]>(() => {
    return [
      makeLane(1, 1, 'レーン 1', { ...LANE_QUEUES[0][0] }),
      makeLane(2, 2, 'レーン 2', { ...LANE_QUEUES[1][0] }),
    ];
  });
  // lanesの最新値をrefで追跡（タイマーコールバック内で使用）
  const lanesRef = useRef(lanes);
  useEffect(() => { lanesRef.current = lanes; }, [lanes]);

  // Track which item index each lane is on
  const laneItemIndexRef = useRef<number[]>([0, 0]);
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const countdownTimersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const freezeTimersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const cpuTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [completedLanes, setCompletedLanes] = useState<Set<number>>(new Set());

  // Track resolved items to prevent duplicate resolution
  const resolvedRef = useRef<Set<string>>(new Set());
  // Track items currently transitioning to prevent double advance
  const transitioningRef = useRef<Set<number>>(new Set());

  // CPU state
  const cpuStatesRef = useRef<CpuBidState[]>([]);

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

  // ─── Timer management（レーンごとに管理） ───

  const stopCountdown = useCallback((laneId: number) => {
    const t = countdownTimersRef.current.get(laneId);
    if (t) { clearInterval(t); countdownTimersRef.current.delete(laneId); }
  }, []);

  const stopFreeze = useCallback((laneId: number) => {
    const t = freezeTimersRef.current.get(laneId);
    if (t) { clearInterval(t); freezeTimersRef.current.delete(laneId); }
  }, []);

  const stopCpuTimer = useCallback((laneId: number) => {
    const t = cpuTimersRef.current.get(laneId);
    if (t) { clearTimeout(t); cpuTimersRef.current.delete(laneId); }
  }, []);

  const stopAllTimers = useCallback(() => {
    countdownTimersRef.current.forEach(t => clearInterval(t));
    countdownTimersRef.current.clear();
    freezeTimersRef.current.forEach(t => clearInterval(t));
    freezeTimersRef.current.clear();
    cpuTimersRef.current.forEach(t => clearTimeout(t));
    cpuTimersRef.current.clear();
  }, []);

  // Cleanup
  useEffect(() => () => stopAllTimers(), [stopAllTimers]);

  // ─── Initialize CPU states ───
  useEffect(() => {
    const allItems = [...FREE_LANE1_ITEMS, ...FREE_LANE2_ITEMS];
    const priceMap = new Map<number, number>();
    allItems.forEach(item => priceMap.set(item.id, item.current_price));
    cpuStatesRef.current = CPU_CHARACTERS.map(cpu => initCpuState(cpu, priceMap));
  }, []);

  // ─── Freeze: 価格上昇後の誤タップ防止期間 ───

  const startFreeze = useCallback((laneId: number, onComplete: () => void) => {
    stopFreeze(laneId); // 既存のフリーズタイマーをクリア
    let remaining = 3;
    updateLaneItem(laneId, item => ({
      ...item,
      phase: 'freeze' as const,
      freeze_remaining_seconds: 3,
      freeze_countdown_seconds: 3,
    }));
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        freezeTimersRef.current.delete(laneId);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
        onComplete();
      } else {
        updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
      }
    }, 1000);
    freezeTimersRef.current.set(laneId, timer);
  }, [stopFreeze, updateLaneItem]);

  // ─── Countdown: 入札カウントダウン ───

  const startCountdown = useCallback((laneId: number, seconds: number = 15) => {
    stopCountdown(laneId);
    updateLaneItem(laneId, item => ({ ...item, countdown_seconds: seconds }));
    const timer = setInterval(() => {
      setLanes(prev => {
        const lane = prev.find(l => l.lane_id === laneId);
        const cd = lane?.current_item?.countdown_seconds ?? 0;
        if (cd <= 1) { stopCountdown(laneId); }
        return prev.map(l =>
          l.lane_id === laneId && l.current_item
            ? { ...l, current_item: { ...l.current_item, countdown_seconds: Math.max(0, l.current_item.countdown_seconds - 1) } }
            : l
        );
      });
    }, 1000);
    countdownTimersRef.current.set(laneId, timer);
  }, [stopCountdown, updateLaneItem]);

  // ─── CPU入札をスケジュール ───

  const scheduleCpuBid = useCallback((laneId: number) => {
    stopCpuTimer(laneId);
    const delay = 800 + Math.random() * 1200;
    const timer = setTimeout(() => {
      cpuTimersRef.current.delete(laneId);
      // lanesRefから最新の状態を読む（setLanes updater内での副作用を回避）
      const currentLanes = lanesRef.current;
      const lane = currentLanes.find(l => l.lane_id === laneId);
      if (!lane?.current_item) return;

      // フリーズ中/pre_bid中はリトライ
      if (lane.current_item.phase !== 'bidding') {
        scheduleCpuBid(laneId);
        return;
      }

      // CPUの中から入札意欲のあるものを選ぶ
      const eligibleCpus = CPU_CHARACTERS.filter(cpu => {
        if (cpu.preferredLanes && !cpu.preferredLanes.includes(lane.lane_number)) return false;
        const state = cpuStatesRef.current[cpu.id - 1];
        if (!state) return false;
        const maxPrice = state.maxPrices.get(lane.current_item!.id) ?? 0;
        if (lane.current_item!.current_price >= maxPrice) return false;
        return Math.random() < cpu.bidProbability;
      });

      if (eligibleCpus.length === 0) {
        // 誰も入札しない → 少し長めに待ってリトライ
        const retryDelay = 2000 + Math.random() * 3000;
        const retryTimer = setTimeout(() => {
          cpuTimersRef.current.delete(laneId);
          scheduleCpuBid(laneId);
        }, retryDelay);
        cpuTimersRef.current.set(laneId, retryTimer);
        return;
      }

      // CPU入札実行: 価格上昇 + フリーズ
      const item = lane.current_item;
      const increment = calculatePriceIncrement(item.current_price);
      const newPrice = item.current_price + increment;

      stopCountdown(laneId);

      // 相手が入札 → 指値が設定されていれば入札中を維持（指値到達時のみ自動オフ）
      // 指値未設定の場合は相手入札で自分はinactiveになる（本番準拠）
      const limitTriggered = !!(item.my_limit_price && newPrice >= item.my_limit_price);
      updateLaneItem(laneId, i => ({
        ...i,
        current_price: newPrice,
        active_bidders_count: Math.max(2, i.active_bidders_count),
        my_limit_triggered: limitTriggered ? true : i.my_limit_triggered,
        my_limit_price: limitTriggered ? null : i.my_limit_price, // 指値到達 → 指値解除（本番準拠）
        my_bid_status: limitTriggered
          ? 'inactive' as const  // 指値到達 → 自動オフ
          : i.my_limit_price
            ? i.my_bid_status     // 指値設定済み → 入札中を維持
            : i.my_bid_status === 'active' ? 'inactive' as const : i.my_bid_status, // 指値なし → 相手入札で解除
      }));
      // 指値到達時: 共有 limitSettings にも反映
      if (limitTriggered) {
        const itemListId = LANE_ITEM_ID_TO_ITEM_ID[item.id];
        if (itemListId) setLimitSettings(prev => { const next = { ...prev }; delete next[itemListId]; return next; });
      }

      // フリーズ開始 → 完了後にカウントダウン再開 + 次のCPU入札をスケジュール
      startFreeze(laneId, () => {
        startCountdown(laneId, 8);
        scheduleCpuBid(laneId);
      });
    }, delay);
    cpuTimersRef.current.set(laneId, timer);
  }, [stopCpuTimer, stopCountdown, updateLaneItem, startFreeze, startCountdown]);

  // ─── Next item transition ───

  const advanceToNextItem = useCallback((laneId: number) => {
    // 二重遷移防止
    if (transitioningRef.current.has(laneId)) return;
    transitioningRef.current.add(laneId);

    const laneIndex = laneId - 1;
    const currentIdx = laneItemIndexRef.current[laneIndex];
    const queue = LANE_QUEUES[laneIndex];
    const nextIdx = currentIdx + 1;

    if (nextIdx >= queue.length) {
      // Lane is finished
      setCompletedLanes(prev => new Set([...prev, laneId]));
      setLanes(prev => prev.map(l =>
        l.lane_id === laneId ? { ...l, status: 'completed', current_item: null } : l
      ));
      transitioningRef.current.delete(laneId);
      return;
    }

    // Load next item with pre_bid phase, inheriting limit from limitSettings if set
    laneItemIndexRef.current[laneIndex] = nextIdx;
    const nextItem = { ...queue[nextIdx] };
    const nextItemListId = LANE_ITEM_ID_TO_ITEM_ID[nextItem.id];
    const inheritedLimit = nextItemListId ? limitSettings[nextItemListId] : undefined;
    const hasValidLimit = inheritedLimit?.limit_price && !inheritedLimit.is_triggered;
    setLanes(prev => prev.map(l =>
      l.lane_id === laneId ? {
        ...l,
        current_item: {
          ...nextItem,
          phase: 'pre_bid' as const,
          pre_bid_remaining_seconds: 3,
          countdown_seconds: 8,
          my_bid_status: hasValidLimit ? 'active' : null,
          active_bidders_count: hasValidLimit ? 1 : 0,
          my_limit_price: hasValidLimit ? inheritedLimit!.limit_price : null,
          my_limit_triggered: false,
        }
      } : l
    ));

    // Pre-bid countdown
    let remaining = 3;
    const preBidTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(preBidTimer);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', pre_bid_remaining_seconds: 0 }));
        startCountdown(laneId, 8);
        // pre_bid完了後にCPU入札を開始
        scheduleCpuBid(laneId);
        transitioningRef.current.delete(laneId);
      } else {
        updateLaneItem(laneId, item => ({ ...item, pre_bid_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [updateLaneItem, startCountdown, scheduleCpuBid]);

  // ─── Determine winner when countdown reaches 0 ───

  const resolveItem = useCallback((laneId: number, item: LaneItem) => {
    const key = `${laneId}-${item.id}`;
    if (resolvedRef.current.has(key)) return;
    resolvedRef.current.add(key);

    // ユーザーが最高入札者(active)なら落札
    if (item.my_bid_status === 'active' && item.active_bidders_count >= 1) {
      const price = item.current_price;
      const qty = item.quantity;
      const lane = lanesRef.current.find(l => l.lane_id === laneId);
      setWonItems(w => [...w, {
        species_name: item.species_name,
        winning_price: price,
        quantity: qty,
        total_amount: Math.floor(price * qty * 1.1),
        thumbnail_path: item.thumbnail_path,
        item_number: item.item_number,
        lane_number: lane?.lane_number,
      }]);
      setCelebration({ species_name: item.species_name, winning_price: price });
      setTimeout(() => setCelebration(null), 3000);
    }

    // Move to next item after a brief delay
    setTimeout(() => advanceToNextItem(laneId), 1500);
  }, [advanceToNextItem]);

  // ─── Monitor countdowns reaching 0 ───
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // lanesRefを使って最新状態を読む（setLanes内で副作用を起こさない）
      const currentLanes = lanesRef.current;
      currentLanes.forEach(lane => {
        if (!lane.current_item) return;
        if (lane.current_item.phase === 'bidding' && lane.current_item.countdown_seconds <= 0) {
          // タイマーが既に停止している場合のみ（自然にカウントダウンが0になった場合）
          if (!countdownTimersRef.current.has(lane.lane_id)) {
            resolveItem(lane.lane_id, lane.current_item);
          }
        }
      });
    }, 500);
    return () => clearInterval(checkInterval);
  }, [resolveItem]);

  // ─── Start initial countdowns + CPU bidding ───
  useEffect(() => {
    if (phase !== 'auction') return;
    // 出品一覧で設定された指値をオークション初期アイテムに引き継ぐ
    setLanes(prev => prev.map(lane => {
      if (!lane.current_item) return lane;
      const itemListId = LANE_ITEM_ID_TO_ITEM_ID[lane.current_item.id];
      const limit = itemListId ? limitSettings[itemListId] : undefined;
      if (limit?.limit_price && !limit.is_triggered) {
        return {
          ...lane,
          current_item: {
            ...lane.current_item,
            my_limit_price: limit.limit_price,
            my_limit_triggered: false,
            my_bid_status: 'active',
            active_bidders_count: Math.max(1, lane.current_item.active_bidders_count),
          },
        };
      }
      return lane;
    }));
    [1, 2].forEach(laneId => {
      startCountdown(laneId, 8);
      // 各レーンのCPU入札を開始（初回は1〜3秒後にランダム開始）
      const initialDelay = 1000 + Math.random() * 2000;
      const t = setTimeout(() => {
        cpuTimersRef.current.delete(laneId);
        scheduleCpuBid(laneId);
      }, initialDelay);
      cpuTimersRef.current.set(laneId, t);
    });
    return () => stopAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── Check if auction is complete ───
  useEffect(() => {
    if (completedLanes.size >= 2 && phase === 'auction') {
      const timer = setTimeout(() => {
        stopAllTimers();
        setPhase('post-auction');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [completedLanes, phase, stopAllTimers]);

  // ─── Bid toggle ───
  // 本番の動作:
  // - ユーザーが入札 → active になる
  // - 2人以上active → 即座にprice increment + freeze
  // - freeze解除後 → bidding(countdown 15s)
  // デモでは「CPUが既に入札中」と仮定し、ユーザーの入札で即座にprice increment + freeze

  const handleBidToggle = useCallback((itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    const lane = lanesRef.current.find(l => l.current_item?.id === itemId);
    if (!lane?.current_item) return;
    const item = lane.current_item;
    if (item.phase === 'freeze') { notify('誤タップ防止中です。もう少々お待ちください。', 'error'); return; }
    if (item.phase === 'pre_bid') { notify('入札開始待機中です。もう少々お待ちください。', 'error'); return; }
    if (currentStatus === 'active') {
      // 入札中の手動解除は不可（相手の入札によってのみ解除される）
      return;
    } else {
      // ユーザーが入札 = 価格上昇 + フリーズ（本番で2人以上activeの時と同じ挙動）
      const increment = calculatePriceIncrement(item.current_price);
      const newPrice = item.current_price + increment;
      stopCountdown(lane.lane_id);
      stopCpuTimer(lane.lane_id); // CPU入札スケジュールも一旦停止

      // 自分の入札で自分の指値を超えるケースをチェック
      const selfLimitTriggered = !!(item.my_limit_price && newPrice >= item.my_limit_price);
      updateLaneItem(lane.lane_id, i => ({
        ...i,
        my_bid_status: 'active',
        active_bidders_count: Math.max(2, i.active_bidders_count + 1),
        current_price: newPrice,
        my_limit_triggered: selfLimitTriggered ? true : i.my_limit_triggered,
      }));
      notify(`レーン${lane.lane_number}に入札しました！ ¥${newPrice.toLocaleString()}`, 'success');

      // フリーズ開始 → 完了後にカウントダウン再開 + CPU入札再開
      startFreeze(lane.lane_id, () => {
        startCountdown(lane.lane_id, 8);
        scheduleCpuBid(lane.lane_id);
      });
    }
  }, [notify, updateLaneItem, startCountdown, stopCountdown, stopCpuTimer, startFreeze, scheduleCpuBid]);

  // ─── Limit ───

  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItemData = limitModalLane?.current_item;

  const handleSetLimit = useCallback((price: number) => {
    if (!limitModalLaneId) return;
    const lane = lanesRef.current.find(l => l.lane_id === limitModalLaneId);
    const item = lane?.current_item;
    if (item && item.current_price >= price) {
      notify('現在価格が既に上限を超えています', 'error');
      setLimitModalLaneId(null);
      return;
    }
    // 指値設定 + 自動active化（本番準拠: SetBidLimitAction → JoinBidAction）
    updateLaneItem(limitModalLaneId, i => ({
      ...i,
      my_limit_price: price,
      my_limit_triggered: false,
      my_bid_status: 'active',
      active_bidders_count: Math.max(2, i.active_bidders_count),
    }));
    // 共有 limitSettings にも同期
    if (item) {
      const itemListId = LANE_ITEM_ID_TO_ITEM_ID[item.id];
      if (itemListId) setLimitSettings(prev => ({ ...prev, [itemListId]: { limit_price: price, is_triggered: false } }));
    }
    setLimitModalLaneId(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定し、入札に参加しました`, 'success');
  }, [limitModalLaneId, updateLaneItem, notify]);

  const handleRemoveLimit = useCallback(() => {
    if (!limitModalLaneId) return;
    const lane = lanesRef.current.find(l => l.lane_id === limitModalLaneId);
    const item = lane?.current_item;
    updateLaneItem(limitModalLaneId, i => ({ ...i, my_limit_price: null, my_limit_triggered: false }));
    // 共有 limitSettings にも同期
    if (item) {
      const itemListId = LANE_ITEM_ID_TO_ITEM_ID[item.id];
      if (itemListId) setLimitSettings(prev => { const next = { ...prev }; delete next[itemListId]; return next; });
    }
    setLimitModalLaneId(null);
    notify('上限設定を解除しました', 'info');
  }, [limitModalLaneId, updateLaneItem, notify]);

  const wonTotal = wonItems.reduce((sum, w) => sum + w.total_amount, 0);

  // ─── Upcoming items for each lane ───
  const getUpcomingForLane = (laneId: number): UpcomingItem[] => {
    const laneIndex = laneId - 1;
    const currentIdx = laneItemIndexRef.current[laneIndex];
    const queue = LANE_QUEUES[laneIndex];
    return queue.slice(currentIdx + 1, currentIdx + 4).map(item => ({
      id: item.id,
      item_number: item.item_number,
      species_name: item.species_name,
      quantity: item.quantity,
      start_price: item.current_price,
      thumbnail_path: item.thumbnail_path,
      is_premium: item.is_premium,
    }));
  };

  // ====================================================================
  // Render
  // ====================================================================

  // Navigation handler for DemoLayout
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const handleNavigate = (page: string) => {
    if (page === 'home') { setPhase('home'); setSettingsTab(undefined); }
    else if (page === 'items') { setPhase('items'); setSettingsTab(undefined); }
    else if (page === 'favorites') { setPhase('favorites'); setSettingsTab(undefined); }
    else if (page === 'post-auction') { setPhase('post-auction'); setSettingsTab(undefined); }
    else if (page === 'settings') { setPhase('post-auction'); setSettingsTab('settings'); }
    else if (page === 'demo-top') { onBackToTop(); }
  };

  if (phase === 'home') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate}>
        <DemoHome onGoToItems={() => setPhase('items')} onGoToWaitingRoom={() => setPhase('waiting')} />
      </DemoLayout>
    );
  }

  if (phase === 'items') {
    return (
      <DemoLayout currentPage="items" onNavigate={handleNavigate}>
        <DemoItemList
          onGoToWaitingRoom={() => setPhase('waiting')}
          favoriteIds={favoriteIds}
          onFavoriteToggle={handleFavoriteToggle}
          limitSettings={limitSettings}
          onLimitSet={handleItemLimitSet}
          onLimitRemove={handleItemLimitRemove}
        />
      </DemoLayout>
    );
  }

  if (phase === 'favorites') {
    return (
      <DemoLayout currentPage="favorites" onNavigate={handleNavigate}>
        <DemoFavorites
          onNavigateToAuctions={() => setPhase('items')}
          favoriteIds={favoriteIds}
          onFavoriteToggle={handleFavoriteToggle}
          limitSettings={limitSettings}
          onLimitSet={handleItemLimitSet}
          onLimitRemove={handleItemLimitRemove}
        />
      </DemoLayout>
    );
  }

  if (phase === 'waiting') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate}>
        <DemoWaitingRoom
          auctionTitle={MOCK_AUCTIONS[0].title}
          onAuctionStart={() => setPhase('auction')}
        />
      </DemoLayout>
    );
  }

  if (phase === 'post-auction') {
    return (
      <DemoLayout currentPage={settingsTab === 'settings' ? 'settings' : 'post-auction'} onNavigate={handleNavigate}>
        <PostAuctionGuide
          wonItems={wonItems}
          onBackToTop={onBackToTop}
          initialTab={settingsTab}
        />
      </DemoLayout>
    );
  }

  return (
    <DemoLayout currentPage="items" onNavigate={handleNavigate}>
      <Box sx={{ bgcolor: 'grey.100', minHeight: '60vh', position: 'relative' }}>
        {celebration && <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />}

        {/* Header — matches real AuctionHeader */}
        <Container maxWidth="xl" sx={{ pt: 2 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  {MOCK_AUCTIONS[0].title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {2 - completedLanes.size}/{2}レーン進行中
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
          </Paper>
        </Container>

        <Container maxWidth="xl" sx={{ py: 2 }}>
          {/* Lane grid */}
          <Grid container spacing={2}>
            {lanes.map(lane => (
              <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                {lane.current_item ? (
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
                        const itemListId = LANE_ITEM_ID_TO_ITEM_ID[itemId];
                        if (itemListId) setLimitSettings(prev => { const next = { ...prev }; delete next[itemListId]; return next; });
                        notify('上限設定を解除しました', 'info');
                      }
                    }}
                  />
                ) : (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <TrophyIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight="bold">レーン{lane.lane_number} 完了</Typography>
                    <Typography variant="body2" color="text.secondary">全商品の入札が終了しました</Typography>
                  </Paper>
                )}
              </Grid>
            ))}
          </Grid>

          {/* Upcoming items per lane */}
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>次の商品</Typography>
            <Grid container spacing={2}>
              {[1, 2].map(laneId => {
                const upcomingItems = getUpcomingForLane(laneId);
                if (upcomingItems.length === 0) return null;
                return (
                  <Grid item xs={12} md={6} key={laneId}>
                    <Typography variant="caption" fontWeight="bold" color="primary.main" sx={{ mb: 1, display: 'block' }}>
                      レーン{laneId}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
                      {upcomingItems.map(item => (
                        <Box key={item.id} sx={{
                          flexShrink: 0, width: 120, borderRadius: 1, border: '1px solid', borderColor: 'divider',
                          overflow: 'hidden', bgcolor: 'background.paper',
                        }}>
                          <Box sx={{ width: '100%', aspectRatio: '3/2', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PetsIcon sx={{ color: 'grey.400', fontSize: 20 }} />
                          </Box>
                          <Box sx={{ p: 0.75 }}>
                            <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, fontSize: '0.65rem' }}>{item.species_name}</Typography>
                            <Typography variant="caption" color="primary.main" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>¥{item.start_price.toLocaleString()}〜</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>

          {/* Won items */}
          {wonItems.length > 0 && (
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrophyIcon color="warning" /> あなたの落札結果 ({wonItems.length}点)
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
        </Container>

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
