import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid,
  Alert, Snackbar, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  EmojiEvents as TrophyIcon,
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import type { LiveLane, LaneItem, UpcomingItem } from '@/types';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { BidLimitModal } from '../../features/bid-limit/components/BidLimitModal';
import { BidLimitBadge } from '../../features/bid-limit/components/BidLimitBadge';
import { DemoTourPopover, TourStep } from '../../components/DemoTourPopover';

// ─── Demo data builders ───

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
  makeLaneItem({ id: 1, species_name: '紅白ラメ ペア', current_price: 300, quantity: 2, seller_name: 'デモ出品者A', thumbnail_path: '/img/medaka/紅白ラメ.jpg' }),
  makeLaneItem({ id: 2, species_name: '幹之フルボディ', current_price: 500, quantity: 5, is_premium: true, seller_name: 'デモ出品者B', thumbnail_path: '/img/medaka/幹之フルボディ.jpg' }),
  makeLaneItem({ id: 3, species_name: '楊貴妃ダルマ', current_price: 200, quantity: 1, seller_name: 'デモ出品者C', thumbnail_path: '/img/medaka/楊貴妃ダルマ.jpeg' }),
];

const INITIAL_LANES: LiveLane[] = [
  makeLane(1, 1, 'レーン 1', INITIAL_ITEMS[0]),
  makeLane(2, 2, 'レーン 2', INITIAL_ITEMS[1]),
  makeLane(3, 3, 'レーン 3', INITIAL_ITEMS[2]),
];

const INITIAL_UPCOMING: (UpcomingItem & { laneNumber: number })[] = [
  { id: 10, item_number: 4, species_name: '三色ラメ', start_price: 400, thumbnail_path: '/img/medaka/三色ラメ.jpeg', is_premium: false, is_favorited: false, quantity: 3, laneNumber: 1 },
  { id: 11, item_number: 5, species_name: 'オロチ ペア', start_price: 600, thumbnail_path: '/img/medaka/オロチ.jpg', is_premium: true, is_favorited: true, quantity: 2, laneNumber: 2 },
  { id: 12, item_number: 6, species_name: '夜桜ゴールド', start_price: 350, thumbnail_path: '/img/medaka/夜桜ゴールド.jpg', is_premium: false, is_favorited: false, quantity: 1, laneNumber: 3 },
];

interface WonEntry {
  species_name: string;
  winning_price: number;
  quantity: number;
  total_amount: number;
}

// ─── Component ───

export default function Demo() {
  const [tourActive, setTourActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [lanes, setLanes] = useState<LiveLane[]>(JSON.parse(JSON.stringify(INITIAL_LANES)));
  const [upcoming, setUpcoming] = useState(INITIAL_UPCOMING.map(u => ({ ...u })));
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [, setDetailLane] = useState<LiveLane | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // Refs for tour targets
  const laneCardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const lane1Ref = useRef<HTMLDivElement | null>(null);
  const lane2Ref = useRef<HTMLDivElement | null>(null);
  const lane3Ref = useRef<HTMLDivElement | null>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const wonTableRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const allLanesRef = useRef<HTMLDivElement>(null);

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

  // ─── Simulation helpers (handleBidToggle より前に定義が必要) ───

  /** STEP5用: 相手が入札 → フリーズ3秒 → 入札解除 のサイクル */
  const simulateBattleCycle = useCallback((laneId: number): Promise<void> => {
    return new Promise(resolve => {
      stopTimer(laneId);
      updateLaneItem(laneId, item => {
        const increment = Math.max(100, Math.round(item.current_price * 0.1));
        return {
          ...item,
          phase: 'freeze',
          freeze_remaining_seconds: 3,
          freeze_countdown_seconds: 3,
          current_price: item.current_price + increment,
          active_bidders_count: Math.max(2, item.active_bidders_count),
        };
      });
      notify('他の参加者が入札！フリーズ中...', 'warning');

      let remaining = 3;
      const freezeTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(freezeTimer);
          updateLaneItem(laneId, item => ({
            ...item,
            phase: 'bidding',
            freeze_remaining_seconds: 0,
            my_bid_status: 'inactive',
            active_bidders_count: Math.max(1, item.active_bidders_count),
          }));
          startCountdown(laneId, 15);
          notify('入札が解除されました。再度入札してください！', 'info');
          resolve();
        } else {
          updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
        }
      }, 1000);
    });
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  /** STEP6用: フリーズ状態にして解除しない（説明用） */
  const simulateFreezeHold = useCallback((laneId: number) => {
    stopTimer(laneId);
    updateLaneItem(laneId, item => {
      const increment = Math.max(100, Math.round(item.current_price * 0.1));
      return {
        ...item,
        phase: 'freeze',
        freeze_remaining_seconds: 3,
        freeze_countdown_seconds: 3,
        current_price: item.current_price + increment,
        active_bidders_count: Math.max(2, item.active_bidders_count),
      };
    });
    notify('フリーズ中！この状態では入札ボタンが無効です', 'warning');
  }, [stopTimer, updateLaneItem, notify]);

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

      if (tourActive && activeStep === 2) {
        setTimeout(() => setActiveStep(3), 1200);
      }

      // STEP5: 入札合戦 — ユーザーが入札したら相手も入札し返す
      if (tourActive && activeStep === 4) {
        setTimeout(() => simulateBattleCycle(lane.lane_id), 2000);
      }
    }
  }, [lanes, notify, updateLaneItem, startCountdown, tourActive, activeStep, simulateBattleCycle]);

  // ─── Simulation helpers ───

  const simulateOpponentBid = useCallback((laneId: number): Promise<void> => {
    return new Promise(resolve => {
      stopTimer(laneId);
      updateLaneItem(laneId, item => {
        const increment = Math.max(100, Math.round(item.current_price * 0.1));
        notify(`他の参加者が入札！ +¥${increment.toLocaleString()}`, 'warning');
        return {
          ...item,
          phase: 'freeze',
          freeze_remaining_seconds: 3,
          freeze_countdown_seconds: 3,
          current_price: item.current_price + increment,
          active_bidders_count: Math.max(2, item.active_bidders_count),
        };
      });
      let remaining = 3;
      const freezeTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(freezeTimer);
          updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
          startCountdown(laneId, 15);
          resolve();
        } else {
          updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
        }
      }, 1000);
    });
  }, [stopTimer, notify, updateLaneItem, startCountdown]);

  const simulateMultipleOpponentBids = useCallback(async (laneId: number, count: number) => {
    notify('他の参加者が入札！価格が上昇しています...', 'warning');
    for (let i = 0; i < count; i++) {
      await new Promise<void>(resolve => {
        stopTimer(laneId);
        updateLaneItem(laneId, item => {
          const increment = Math.max(100, Math.round(item.current_price * 0.1));
          return {
            ...item,
            phase: 'freeze',
            freeze_remaining_seconds: 1,
            freeze_countdown_seconds: 1,
            current_price: item.current_price + increment,
            active_bidders_count: Math.max(2, item.active_bidders_count),
          };
        });
        setTimeout(() => {
          updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
          startCountdown(laneId, 15);
          resolve();
        }, 1000);
      });
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulateFreeze = useCallback((laneId: number): Promise<void> => {
    return new Promise(resolve => {
      stopTimer(laneId);
      updateLaneItem(laneId, item => {
        const increment = Math.max(100, Math.round(item.current_price * 0.1));
        return {
          ...item,
          phase: 'freeze',
          freeze_remaining_seconds: 3,
          freeze_countdown_seconds: 3,
          current_price: item.current_price + increment,
          active_bidders_count: Math.max(2, item.active_bidders_count),
        };
      });
      notify('フリーズ中！入札ボタンが一時的に無効になります', 'warning');

      let remaining = 3;
      const freezeTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(freezeTimer);
          updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
          startCountdown(laneId, 15);
          notify('フリーズ解除！入札可能になりました', 'success');
          resolve();
        } else {
          updateLaneItem(laneId, item => ({ ...item, freeze_remaining_seconds: remaining }));
        }
      }, 1000);
    });
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulatePreBid = useCallback((laneId: number): Promise<void> => {
    return new Promise(resolve => {
      stopTimer(laneId);
      updateLaneItem(laneId, () => makeLaneItem({
        id: 7,
        species_name: '三色ラメ 新着',
        current_price: 450,
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
          resolve();
        } else {
          updateLaneItem(laneId, item => ({ ...item, pre_bid_remaining_seconds: remaining }));
        }
      }, 1000);
    });
  }, [stopTimer, updateLaneItem, startCountdown, notify]);

  const simulateLimitTrigger = useCallback((): Promise<void> => {
    return new Promise(resolve => {
      const lane1 = lanes.find(l => l.lane_id === 1);
      const limitPrice = lane1?.current_item?.my_limit_price;
      if (!limitPrice) {
        notify('先にレーン1で指値を設定してください', 'error');
        resolve();
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
          resolve();
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
    });
  }, [lanes, updateLaneItem, notify]);

  const handleWin = useCallback((): Promise<void> => {
    return new Promise(resolve => {
      const lane2 = lanes.find(l => l.lane_id === 2);
      if (!lane2?.current_item) { resolve(); return; }
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
      setTimeout(() => { setCelebration(null); resolve(); }, 4000);
    });
  }, [lanes, stopTimer, updateLaneItem]);

  // ─── Limit modal handlers ───

  const limitModalLane = lanes.find(l => l.lane_id === limitModalLaneId);
  const limitModalItem = limitModalLane?.current_item;

  const handleSetLimit = useCallback((price: number) => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: price, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify(`上限価格を ¥${price.toLocaleString()} に設定しました`, 'success');
    if (tourActive && activeStep === 7) {
      setTimeout(() => setActiveStep(8), 800);
    }
  }, [limitModalLaneId, updateLaneItem, notify, tourActive, activeStep]);

  const handleRemoveLimit = useCallback(() => {
    if (!limitModalLaneId) return;
    updateLaneItem(limitModalLaneId, item => ({ ...item, my_limit_price: null, my_limit_triggered: false }));
    setLimitModalLaneId(null);
    notify('上限設定を解除しました', 'info');
  }, [limitModalLaneId, updateLaneItem, notify]);

  // Sync individual lane refs from the array ref
  useEffect(() => {
    lane1Ref.current = laneCardRefs.current[0];
    lane2Ref.current = laneCardRefs.current[1];
    lane3Ref.current = laneCardRefs.current[2];
  });

  // ─── Tour step definitions ───

  const tourSteps: TourStep[] = [
    // STEP1: ようこそ
    {
      targetRef: headerRef,
      title: 'オークション体験デモへようこそ！',
      description: 'このデモでは、実際のオークション画面を操作しながら、入札の流れを体験できます。吹き出しの指示に従って進めてください。',
      placement: 'bottom',
    },
    // STEP2: レーンカードの見方
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: 'レーンカードの見方',
      description: '各レーンには品種名、現在価格、カウントダウンが表示されています。最大3つのレーンが同時に進行するのがこのオークションの特徴です。',
      placement: 'bottom',
    },
    // STEP3: 入札してみよう
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: '入札してみよう！',
      description: 'レーン1の「入札する」ボタンをタップしてみてください！カードが金色に光り「最高入札者」バッジが表示されます。',
      placement: 'bottom',
      waitForAction: 'レーン1の「入札する」をタップ',
    },
    // STEP4: 他の参加者が入札
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: '他の参加者が入札してきた！',
      description: '他の参加者がレーン1に入札してきます。フリーズ（誤タップ防止）が入った後、価格が上がりカウントダウンがリセットされる様子を確認してください。',
      placement: 'bottom',
      autoAction: () => { simulateOpponentBid(1); },
      autoActionDelay: 4500,
    },
    // STEP5: 入札合戦（インタラクティブ）
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: '入札合戦！',
      description: '相手が入札してきました！フリーズ後に入札が解除されます。再度「入札する」ボタンを押すと、相手も入札し返してきます。何度でも繰り返せます。準備ができたら「次へ」で先に進みましょう。',
      placement: 'bottom',
      autoAction: () => { simulateBattleCycle(1); },
      autoActionDelay: 4500,
    },
    // STEP6: フリーズ説明（フリーズ状態で固定）
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: 'フリーズ（誤タップ防止）',
      description: '価格上昇直後、数秒間入札ボタンが無効になる「フリーズ」状態です。誤タップを防ぐ安全機能で、フリーズ中は入札できません。',
      placement: 'bottom',
      autoAction: () => { simulateFreezeHold(1); },
      autoActionDelay: 500,
    },
    // STEP7: 待機時間
    {
      targetRef: lane3Ref as React.RefObject<HTMLDivElement | null>,
      title: '新商品の入札開始待機',
      description: 'レーン3に新しい商品が来ました。入札開始まで数秒間の待機時間があります。',
      placement: 'left',
      autoAction: () => { simulatePreBid(3); },
      autoActionDelay: 6000,
    },
    // STEP8: 指値設定
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: '指値（上限価格）を設定しよう',
      description: '指値を設定すると、価格がその金額に達したとき自動で入札がオフになります。レーン1の「上限設定」ボタンを押してみてください。',
      placement: 'bottom',
      waitForAction: 'レーン1の「上限設定」をタップ',
    },
    // STEP9: 指値発動
    {
      targetRef: lane1Ref as React.RefObject<HTMLDivElement | null>,
      title: '指値が発動！自動入札オフ',
      description: '相手が連続入札して指値に到達します。自動で入札がオフになる様子を確認してください。',
      placement: 'bottom',
      autoAction: () => { simulateLimitTrigger(); },
      autoActionDelay: 6000,
    },
    // STEP10: 次の商品確認 + 指値・お気に入り説明
    {
      targetRef: upcomingRef,
      title: '次の商品を確認',
      description: '下にスクロールすると「次の商品」を確認できます。気になる商品にお気に入り登録ができ、指値（上限価格）も商品がレーンに来た際にすぐ設定できます。まずはお気に入り登録を体験しましょう。',
      placement: 'top',
    },
    // STEP11: お気に入り登録
    {
      targetRef: upcomingRef,
      title: 'お気に入りを登録してみよう',
      description: '次の商品一覧からハートアイコンをタップして、お気に入りに登録してみてください。お気に入りの商品がレーンに登場した際に通知を受け取れます。',
      placement: 'top',
      waitForAction: 'ハートアイコンをタップ',
    },
    // STEP12: 落札
    {
      targetRef: lane2Ref as React.RefObject<HTMLDivElement | null>,
      title: '落札の瞬間！',
      description: 'レーン2を落札します。紙吹雪の落札演出と結果テーブルが表示されます。おめでとうございます！',
      placement: 'left',
      autoAction: () => {
        updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 }));
        setTimeout(() => handleWin(), 500);
      },
      autoActionDelay: 4500,
    },
    // STEP13: 完了
    {
      targetRef: wonTableRef,
      title: 'デモ完了！お疲れさまでした',
      description: '落札結果がここに表示されます。実際のオークションでも同様の流れで進みます。「最初から」ボタンで何度でも練習できます。',
      placement: 'top',
    },
  ];

  // ─── Tour navigation ───

  const handleTourNext = useCallback(() => {
    const nextStep = activeStep + 1;
    if (nextStep >= tourSteps.length) return;

    // STEP6（フリーズ保持）から離れる際にフリーズ解除
    if (activeStep === 5) {
      updateLaneItem(1, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
      startCountdown(1, 15);
    }

    const step = tourSteps[nextStep];
    if (step.autoAction) {
      setIsAutoPlaying(true);
      setActiveStep(nextStep);
      step.autoAction();
      setTimeout(() => {
        setIsAutoPlaying(false);
      }, step.autoActionDelay || 1500);
    } else {
      setActiveStep(nextStep);
    }
  }, [activeStep, tourSteps, updateLaneItem, startCountdown]);

  const handleTourPrev = useCallback(() => {
    if (activeStep > 0) {
      // STEP6（フリーズ保持）から離れる際にフリーズ解除
      if (activeStep === 5) {
        updateLaneItem(1, item => ({ ...item, phase: 'bidding', freeze_remaining_seconds: 0 }));
        startCountdown(1, 15);
      }
      setActiveStep(activeStep - 1);
    }
  }, [activeStep, updateLaneItem, startCountdown]);

  const handleTourClose = useCallback(() => {
    setTourActive(false);
    setActiveStep(0);
  }, []);

  const handleReset = useCallback(() => {
    stopAllTimers();
    setActiveStep(0);
    setLanes(JSON.parse(JSON.stringify(INITIAL_LANES)));
    setUpcoming(INITIAL_UPCOMING.map(u => ({ ...u })));
    setWonItems([]);
    setCelebration(null);
    setLimitModalLaneId(null);
    setDetailLane(null);
    setIsAutoPlaying(false);
    setTourActive(false);
  }, [stopAllTimers]);

  const handleStartTour = useCallback(() => {
    handleReset();
    setTimeout(() => {
      setTourActive(true);
      setActiveStep(0);
    }, 100);
  }, [handleReset]);

  const toggleFavorite = (itemId: number) => {
    setUpcoming(prev => prev.map(u => u.id === itemId ? { ...u, is_favorited: !u.is_favorited } : u));
    // STEP11: お気に入り登録ステップ
    if (tourActive && activeStep === 10) {
      setTimeout(() => setActiveStep(11), 800);
    }
  };

  const wonTotal = wonItems.reduce((sum, w) => sum + w.total_amount, 0);

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* 落札演出 */}
      {celebration && (
        <CelebrationOverlay speciesName={celebration.species_name} winningPrice={celebration.winning_price} />
      )}

      {/* ヘッダー */}
      <Box
        ref={headerRef}
        sx={{
          background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
          color: 'white',
          py: 3,
          px: 2,
        }}
      >
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
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartTour}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              ガイド付きデモを開始
            </Button>
          )}
          {tourActive && (
            <Chip
              label={`ガイド進行中 (${activeStep + 1}/${tourSteps.length})`}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            />
          )}
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* レーングリッド */}
        <Box ref={allLanesRef}>
          <Grid container spacing={2}>
            {lanes.map((lane, idx) => (
              <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                <Box ref={(el: HTMLDivElement | null) => { laneCardRefs.current[idx] = el; }}>
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
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* 次の商品 */}
        <Paper ref={upcomingRef} sx={{ mt: 3, p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>次の商品</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
            {upcoming.map(item => (
              <Box key={item.id} sx={{
                flexShrink: 0, width: 150, borderRadius: 1.5,
                border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper',
              }}>
                <Box
                  component="img"
                  src={item.thumbnail_path}
                  alt={item.species_name}
                  sx={{
                    width: '100%', aspectRatio: '3/2', objectFit: 'cover', bgcolor: 'grey.100',
                  }}
                />
                <Box sx={{ p: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <Chip label={`L${item.laneNumber}`} size="small"
                      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} color="primary" variant="outlined" />
                    {item.is_premium && <Chip label="P" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />}
                  </Box>
                  <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>{item.species_name}</Typography>
                  <Typography variant="caption" color="primary.main" fontWeight="bold">¥{item.start_price.toLocaleString()}〜</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                    <IconButton size="small" sx={{ p: 0.25 }} onClick={() => notify(`${item.species_name} の詳細（デモ）`, 'info')}>
                      <InfoIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    </IconButton>
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
        </Box>

        {/* フリーモード操作パネル（ツアー非アクティブ時） */}
        {!tourActive && (
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
              フリーモード — 自由に操作できます
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ガイドなしで自由に操作できます。「ガイド付きデモを開始」ボタンでチュートリアルを再開できます。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(1)}>
                レーン1に他者入札
              </Button>
              <Button size="small" variant="outlined" onClick={() => simulateOpponentBid(2)}>
                レーン2に他者入札
              </Button>
              <Button size="small" variant="outlined" onClick={() => simulateFreeze(1)}>
                フリーズ体験
              </Button>
              <Button size="small" variant="outlined" onClick={() => simulatePreBid(3)}>
                新商品登場
              </Button>
              <Button size="small" variant="outlined" onClick={() => {
                updateLaneItem(2, item => ({ ...item, my_bid_status: 'active', active_bidders_count: 2 }));
                setTimeout(() => handleWin(), 500);
              }}>
                落札体験
              </Button>
              <Button size="small" variant="outlined" color="secondary" onClick={handleReset}>
                リセット
              </Button>
            </Box>
          </Paper>
        )}
      </Container>

      {/* 指値モーダル */}
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

      {/* ツアーポップオーバー */}
      {tourActive && (
        <DemoTourPopover
          steps={tourSteps}
          activeStep={activeStep}
          onNext={handleTourNext}
          onPrev={handleTourPrev}
          onClose={handleTourClose}
          onReset={handleStartTour}
          isAutoPlaying={isAutoPlaying}
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
