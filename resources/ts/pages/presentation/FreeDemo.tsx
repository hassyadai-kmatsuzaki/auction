/**
 * ガイドなしデモ
 * 3レーン x 各10匹 = 30匹のリアルなオークション体験
 * 10人のCPU参加者がフロントエンドのみで入札ロジックを実行
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid,
  Chip, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  EmojiEvents as TrophyIcon,
  Pets as PetsIcon,
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
  FREE_LANE1_ITEMS, FREE_LANE2_ITEMS, FREE_LANE3_ITEMS,
  CPU_CHARACTERS,
  type WonEntry,
} from './mockData';
import { initCpuState, decideCpuAction, calculatePriceIncrement, type CpuBidState } from './cpuBidder';

type FreeDemoPhase = 'home' | 'items' | 'favorites' | 'waiting' | 'auction' | 'post-auction';

interface FreeDemoProps {
  onBackToTop: () => void;
}

// 各レーンのアイテムキュー
const LANE_QUEUES: LaneItem[][] = [
  FREE_LANE1_ITEMS.map(i => ({ ...i })),
  FREE_LANE2_ITEMS.map(i => ({ ...i })),
  FREE_LANE3_ITEMS.map(i => ({ ...i })),
];

export function FreeDemo({ onBackToTop }: FreeDemoProps) {
  const [phase, setPhase] = useState<FreeDemoPhase>('home');

  // ─── Auction state ───
  const [lanes, setLanes] = useState<LiveLane[]>(() => {
    return [
      makeLane(1, 1, 'レーン 1', { ...LANE_QUEUES[0][0] }),
      makeLane(2, 2, 'レーン 2', { ...LANE_QUEUES[1][0] }),
      makeLane(3, 3, 'レーン 3', { ...LANE_QUEUES[2][0] }),
    ];
  });
  // Track which item index each lane is on
  const laneItemIndexRef = useRef<number[]>([0, 0, 0]);
  const [wonItems, setWonItems] = useState<WonEntry[]>([]);
  const [celebration, setCelebration] = useState<{ species_name: string; winning_price: number } | null>(null);
  const [limitModalLaneId, setLimitModalLaneId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'warning' | 'error' });
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const cpuTimersRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const [completedLanes, setCompletedLanes] = useState<Set<number>>(new Set());
  const [totalItemsCompleted, setTotalItemsCompleted] = useState(0);

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

  const stopTimer = useCallback((laneId: number) => {
    const t = timersRef.current.get(laneId);
    if (t) { clearInterval(t); timersRef.current.delete(laneId); }
  }, []);

  const stopAllTimers = useCallback(() => {
    timersRef.current.forEach(t => clearInterval(t));
    timersRef.current.clear();
    cpuTimersRef.current.forEach(t => clearInterval(t));
    cpuTimersRef.current = [];
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

  // Cleanup
  useEffect(() => () => stopAllTimers(), [stopAllTimers]);

  // ─── Initialize CPU states ───
  useEffect(() => {
    const allItems = [...FREE_LANE1_ITEMS, ...FREE_LANE2_ITEMS, ...FREE_LANE3_ITEMS];
    const priceMap = new Map<number, number>();
    allItems.forEach(item => priceMap.set(item.id, item.current_price));
    cpuStatesRef.current = CPU_CHARACTERS.map(cpu => initCpuState(cpu, priceMap));
  }, []);

  // ─── Handle item completion (countdown reached 0 without new bids) ───

  const advanceToNextItem = useCallback((laneId: number) => {
    const laneIndex = laneId - 1;
    const currentIdx = laneItemIndexRef.current[laneIndex];
    const queue = LANE_QUEUES[laneIndex];
    const nextIdx = currentIdx + 1;

    setTotalItemsCompleted(prev => prev + 1);

    if (nextIdx >= queue.length) {
      // Lane is finished
      setCompletedLanes(prev => new Set([...prev, laneId]));
      setLanes(prev => prev.map(l =>
        l.lane_id === laneId ? { ...l, status: 'completed', current_item: null } : l
      ));
      return;
    }

    // Load next item with pre_bid phase
    laneItemIndexRef.current[laneIndex] = nextIdx;
    const nextItem = { ...queue[nextIdx] };
    setLanes(prev => prev.map(l =>
      l.lane_id === laneId ? {
        ...l,
        current_item: { ...nextItem, phase: 'pre_bid' as const, pre_bid_remaining_seconds: 3, countdown_seconds: 15, my_bid_status: null, active_bidders_count: 0 }
      } : l
    ));

    // Pre-bid countdown
    let remaining = 3;
    const preBidTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(preBidTimer);
        updateLaneItem(laneId, item => ({ ...item, phase: 'bidding', pre_bid_remaining_seconds: 0 }));
        startCountdown(laneId, 15);
      } else {
        updateLaneItem(laneId, item => ({ ...item, pre_bid_remaining_seconds: remaining }));
      }
    }, 1000);
  }, [updateLaneItem, startCountdown]);

  // ─── Determine winner when countdown reaches 0 ───

  const resolveItem = useCallback((laneId: number) => {
    setLanes(prev => {
      const lane = prev.find(l => l.lane_id === laneId);
      if (!lane?.current_item) return prev;
      const item = lane.current_item;

      if (item.my_bid_status === 'active' && item.active_bidders_count >= 1) {
        // User wins!
        const price = item.current_price;
        const qty = item.quantity;
        setWonItems(w => [...w, {
          species_name: item.species_name,
          winning_price: price,
          quantity: qty,
          total_amount: Math.floor(price * qty * 1.1),
        }]);
        setCelebration({ species_name: item.species_name, winning_price: price });
        setTimeout(() => setCelebration(null), 3000);
      }

      return prev;
    });

    // Move to next item after a brief delay
    setTimeout(() => advanceToNextItem(laneId), 1500);
  }, [advanceToNextItem]);

  // ─── Monitor countdowns reaching 0 ───
  useEffect(() => {
    const checkInterval = setInterval(() => {
      setLanes(prev => {
        prev.forEach(lane => {
          if (!lane.current_item) return;
          if (lane.current_item.phase === 'bidding' && lane.current_item.countdown_seconds <= 0) {
            // Item finished
            if (!timersRef.current.has(lane.lane_id)) {
              // Only resolve if timer already stopped (countdown naturally reached 0)
              resolveItem(lane.lane_id);
            }
          }
        });
        return prev;
      });
    }, 500);
    return () => clearInterval(checkInterval);
  }, [resolveItem]);

  // ─── CPU bidding loop ───
  useEffect(() => {
    if (phase !== 'auction') return;
    const cpuLoop = setInterval(() => {
      // Each CPU independently decides whether to bid
      CPU_CHARACTERS.forEach((cpu, cpuIdx) => {
        if (Math.random() > 0.3) return; // Rate limit: only 30% of CPUs act each tick

        setLanes(currentLanes => {
          const state = cpuStatesRef.current[cpuIdx];
          if (!state) return currentLanes;

          const decision = decideCpuAction(cpu, state, currentLanes);
          if (!decision) return currentLanes;

          const { laneId } = decision;
          const lane = currentLanes.find(l => l.lane_id === laneId);
          if (!lane?.current_item) return currentLanes;
          if (lane.current_item.phase !== 'bidding') return currentLanes;

          const item = lane.current_item;
          const increment = calculatePriceIncrement(item.current_price);
          const newPrice = item.current_price + increment;

          // Apply freeze and price increase
          stopTimer(laneId);

          const updatedLanes = currentLanes.map(l => {
            if (l.lane_id !== laneId || !l.current_item) return l;
            return {
              ...l,
              current_item: {
                ...l.current_item,
                current_price: newPrice,
                phase: 'freeze' as const,
                freeze_remaining_seconds: 3,
                freeze_countdown_seconds: 3,
                active_bidders_count: Math.max(2, l.current_item.active_bidders_count),
                // If user had a limit price and it's now exceeded, trigger it
                my_limit_triggered: (l.current_item.my_limit_price && newPrice >= l.current_item.my_limit_price) ? true : l.current_item.my_limit_triggered,
                my_bid_status: (l.current_item.my_limit_price && newPrice >= l.current_item.my_limit_price) ? 'inactive' : l.current_item.my_bid_status,
              },
            };
          });

          // Schedule freeze release
          let remaining = 3;
          const freezeTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              clearInterval(freezeTimer);
              updateLaneItem(laneId, i => ({ ...i, phase: 'bidding', freeze_remaining_seconds: 0 }));
              startCountdown(laneId, 15);
            } else {
              updateLaneItem(laneId, i => ({ ...i, freeze_remaining_seconds: remaining }));
            }
          }, 1000);

          return updatedLanes;
        });
      });
    }, 2000); // Check every 2 seconds

    cpuTimersRef.current.push(cpuLoop);
    return () => clearInterval(cpuLoop);
  }, [phase, stopTimer, updateLaneItem, startCountdown]);

  // ─── Start initial countdowns ───
  useEffect(() => {
    if (phase !== 'auction') return;
    [1, 2, 3].forEach(laneId => startCountdown(laneId, 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── Check if auction is complete ───
  useEffect(() => {
    if (completedLanes.size >= 3 && phase === 'auction') {
      // All lanes complete, wait a moment then transition
      const timer = setTimeout(() => {
        stopAllTimers();
        setPhase('post-auction');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [completedLanes, phase, stopAllTimers]);

  // ─── Bid toggle ───

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
      // User bidding = price increase + freeze
      const increment = calculatePriceIncrement(item.current_price);
      const newPrice = item.current_price + increment;
      stopTimer(lane.lane_id);
      updateLaneItem(lane.lane_id, i => ({
        ...i,
        my_bid_status: 'active',
        active_bidders_count: i.active_bidders_count + 1,
        current_price: newPrice,
        phase: 'freeze' as const,
        freeze_remaining_seconds: 3,
        freeze_countdown_seconds: 3,
      }));
      notify(`レーン${lane.lane_number}に入札しました！ ¥${newPrice.toLocaleString()}`, 'success');

      // Freeze release
      let remaining = 3;
      const freezeTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(freezeTimer);
          updateLaneItem(lane.lane_id, i => ({ ...i, phase: 'bidding', freeze_remaining_seconds: 0 }));
          startCountdown(lane.lane_id, 15);
        } else {
          updateLaneItem(lane.lane_id, i => ({ ...i, freeze_remaining_seconds: remaining }));
        }
      }, 1000);
    }
  }, [lanes, notify, updateLaneItem, startCountdown, stopTimer]);

  // ─── Limit ───

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

  const wonTotal = wonItems.reduce((sum, w) => sum + w.total_amount, 0);
  const totalItems = 30;
  const progressPercent = (totalItemsCompleted / totalItems) * 100;

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
        <DemoItemList onGoToWaitingRoom={() => setPhase('waiting')} />
      </DemoLayout>
    );
  }

  if (phase === 'favorites') {
    return (
      <DemoLayout currentPage="favorites" onNavigate={handleNavigate}>
        <DemoFavorites onNavigateToAuctions={() => setPhase('items')} />
      </DemoLayout>
    );
  }

  if (phase === 'waiting') {
    return (
      <DemoLayout currentPage="home" onNavigate={handleNavigate}>
        <DemoWaitingRoom
          auctionTitle="ガイドなしデモ — フリーオークション"
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
          isGuided={false}
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

        {/* Header */}
        <Box sx={{ background: 'linear-gradient(135deg, #424242 0%, #212121 100%)', color: 'white', py: 2, px: 2 }}>
          <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <GavelIcon sx={{ fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', md: '1.3rem' } }}>
                    ガイドなしデモ — フリーオークション
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    3レーン x 各10匹 | CPU参加者10人
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={`進行: ${totalItemsCompleted}/${totalItems}`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700 }} />
                <Chip label="リアルタイム" color="success" size="small" />
                <Button size="small" variant="outlined"
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                  onClick={onBackToTop}>
                  終了
                </Button>
              </Box>
            </Box>
            {/* Progress bar */}
            <LinearProgress variant="determinate" value={progressPercent}
              sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.15)',
                '& .MuiLinearProgress-bar': { borderRadius: 3 } }} />
          </Container>
        </Box>

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
              {[1, 2, 3].map(laneId => {
                const upcomingItems = getUpcomingForLane(laneId);
                if (upcomingItems.length === 0) return null;
                return (
                  <Grid item xs={12} md={4} key={laneId}>
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
