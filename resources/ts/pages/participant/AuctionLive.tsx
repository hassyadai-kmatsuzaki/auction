import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Grid, CircularProgress, Alert, Button,
  Paper, Typography, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { EmojiEvents as EmojiEventsIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';
import { useSocketReconnect } from '../../hooks/useSocketReconnect';
import { useAuctionLiveStore } from '../../stores/auctionLiveStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuctionLive } from '../../features/auction-live/hooks/useAuctionLive';
import { useBidToggle } from '../../features/auction-live/hooks/useBidToggle';
import { useWonItems } from '../../features/auction-live/hooks/useWonItems';
import { useEntranceControl } from '../../features/auction-live/hooks/useEntranceControl';
import { LaneCard } from '../../features/auction-live/components/LaneCard';
import { AuctionHeader } from '../../features/auction-live/components/AuctionHeader';
import { MyBidStatus } from '../../features/auction-live/components/MyBidStatus';
import { WonItemsPanel } from '../../features/auction-live/components/WonItemsPanel';
import { ItemDetailDialog } from '../../features/auction-live/components/ItemDetailDialog';
import { CelebrationOverlay } from '../../features/auction-live/components/CelebrationOverlay';
import { ConsentOverlay } from '../../features/auction-live/components/ConsentOverlay';
import { WaitingRoom, EntranceBlocked, StartingCountdown } from '../../features/auction-live/components/WaitingRoom';
import type { LiveLane, LaneItem } from '../../types';

interface CelebrationItem {
  species_name: string;
  winning_price: number;
}

export default function AuctionLive() {
  const { auctionId: auctionIdStr } = useParams<{ auctionId: string }>();
  const auctionId = Number(auctionIdStr);
  const navigate = useNavigate();
  const { user } = useAuth();
  useQueryClient(); // TanStack Query context に依存するフックの初期化

  // グローバルストア
  const socketConnected = useAuctionLiveStore((s) => s.socketConnected);
  const { snackbar, hideSnackbar, showSnackbar } = useNotificationStore();

  // ローカルUIState（ダイアログ等）
  const [detailLane, setDetailLane] = useState<LiveLane | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [entranceAllowed, setEntranceAllowed] = useState(true);
  const [entranceAt, setEntranceAt] = useState<string | null>(null);
  const [startingCountdown, setStartingCountdown] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<CelebrationItem | null>(null);

  // WebSocket切断時の自動復旧
  useSocketReconnect(auctionId);

  // サーバー状態（TanStack Query）
  const {
    liveState,
    isLoading,
    error,
    refetch,
    applyCountdownTick,
    applyPriceUpdated,
    applyBidderUpdated,
    applyLaneChanged,
  } = useAuctionLive(auctionId);

  // 入札ロジック（楽観的更新 + 自動ロールバック）
  const { toggle: handleBidToggle, isLocked } = useBidToggle(auctionId);

  // 落札一覧
  const { items: wonItems, totalAmount: wonTotalAmount, refetch: refetchWon } = useWonItems(auctionId);

  // 入室カウントダウン
  const { entranceCountdown } = useEntranceControl(entranceAllowed, entranceAt, () => {
    setEntranceAllowed(true);
    refetch();
  });

  // WebSocketイベント購読
  useAuctionSocket({
    auctionId,
    onPriceUpdated: (e) => { applyPriceUpdated(e); },
    onBidderUpdated: (e) => { applyBidderUpdated(e); },
    onLaneChanged: (e) => { applyLaneChanged(e); },
    onCountdownTick: (e) => { applyCountdownTick(e); },
    onItemSold: (e) => {
      if (e.winner_id === user?.id) {
        setCelebration({ species_name: e.species_name || '商品', winning_price: e.winning_price });
        showSnackbar(`🎉 おめでとうございます！${e.species_name || '商品'}を落札しました！`, 'success');
        setTimeout(() => setCelebration(null), 4000);
        refetchWon();
      } else {
        showSnackbar('商品が落札されました', 'success');
      }
    },
    onAuctionStatus: (e) => {
      if (e.status === 'starting' && e.countdown_seconds) {
        setStartingCountdown(e.countdown_seconds);
      } else if (e.status === 'live') {
        setStartingCountdown(0);
        refetch();
      } else if (e.status === 'finished') {
        refetch();
        refetchWon();
        showSnackbar(e.message || 'オークションが終了しました', 'success');
      }
    },
  });

  // liveState から入室制御情報を同期
  if (liveState) {
    const ea = liveState.entrance_allowed;
    if (ea !== undefined && ea !== entranceAllowed) {
      setEntranceAllowed(ea);
      if (!ea && liveState.entrance_at && liveState.entrance_at !== entranceAt) {
        setEntranceAt(liveState.entrance_at);
      }
    }
    if (liveState.status === 'starting' && liveState.starting_countdown && startingCountdown === null) {
      setStartingCountdown(liveState.starting_countdown);
    }
  }

  // ========== ローディング / エラー ==========
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>データの取得に失敗しました。</Alert>
        <Button variant="contained" onClick={() => navigate('/participant')}>ホームに戻る</Button>
      </Container>
    );
  }

  if (!liveState) return null;

  // ========== 入室不可 ==========
  if (liveState.status === 'scheduled' && !entranceAllowed) {
    return (
      <EntranceBlocked
        title={liveState.auction_title}
        startAt={liveState.start_at}
        venueOpenMinutes={liveState.venue_open_minutes_before_start}
        message={liveState.message}
        entranceCountdown={entranceCountdown}
      />
    );
  }

  // ========== 待機室 ==========
  if (liveState.status === 'scheduled') {
    return <WaitingRoom title={liveState.auction_title} />;
  }

  // ========== 開始カウントダウン ==========
  if (liveState.status === 'starting' || (startingCountdown !== null && startingCountdown > 0)) {
    return <StartingCountdown title={liveState.auction_title} count={startingCountdown ?? 0} />;
  }

  // ========== オークション終了 ==========
  if (liveState.status === 'finished') {
    return (
      <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
            <EmojiEventsIcon sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
            <Typography variant="h4" fontWeight="bold" gutterBottom>オークション終了</Typography>
            <Typography variant="h6" color="text.secondary">{liveState.auction_title}</Typography>
          </Paper>

          {wonItems.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon color="warning" /> あなたの落札結果
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell><TableCell>品種</TableCell>
                      <TableCell align="right">単価</TableCell><TableCell align="right">数量</TableCell>
                      <TableCell align="right">合計(税込)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wonItems.map((item) => {
                      const unit = item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹';
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.item_number}</TableCell>
                          <TableCell>{item.species_name}</TableCell>
                          <TableCell align="right">¥{Math.floor(item.winning_price).toLocaleString()}/1{unit}</TableCell>
                          <TableCell align="right">{item.quantity}{unit}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{Math.floor(item.total_amount).toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>合計金額</TableCell>
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

  // ========== ライブ画面 ==========
  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* 同意画面 */}
      {liveState.show_consent_screen && !agreed && (
        <ConsentOverlay onAgree={() => setAgreed(true)} />
      )}

      {/* 落札おめでとう演出 */}
      {celebration && (
        <CelebrationOverlay
          speciesName={celebration.species_name}
          winningPrice={celebration.winning_price}
        />
      )}

      {/* ヘッダー */}
      <AuctionHeader
        title={liveState.auction_title}
        activeLaneCount={liveState.lanes.filter(l => l.status === 'active').length}
        totalLaneCount={liveState.lanes.length}
        socketConnected={socketConnected}
        onRefresh={refetch}
      />

      <Container maxWidth="xl" sx={{ py: 2 }}>
        {/* レーングリッド */}
        <Grid container spacing={2}>
          {liveState.lanes.map((lane) => (
            <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
              <LaneCard
                lane={lane}
                isLoading={lane.current_item ? isLocked(lane.current_item.id) : false}
                onBidToggle={(itemId, status) => {
                  const item = lane.current_item;
                  if (item?.phase === 'pre_bid') {
                    showSnackbar('入札開始待機中です。もう少々お待ちください。', 'error');
                    return;
                  }
                  handleBidToggle(itemId, status);
                }}
                onDetailOpen={(l) => setDetailLane(l)}
              />
            </Grid>
          ))}
        </Grid>

        {/* 自分の入札状況 */}
        <MyBidStatus
          lanes={liveState.lanes}
          onLeaveBid={(itemId) => handleBidToggle(itemId, 'active')}
        />

        {/* 落札一覧 */}
        <WonItemsPanel items={wonItems} totalAmount={wonTotalAmount} />
      </Container>

      {/* 詳細ダイアログ */}
      <ItemDetailDialog
        open={!!detailLane}
        item={detailLane?.current_item as LaneItem | null}
        onClose={() => setDetailLane(null)}
      />

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={hideSnackbar}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
