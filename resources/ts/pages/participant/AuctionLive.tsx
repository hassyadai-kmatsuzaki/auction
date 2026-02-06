import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';

interface LaneItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
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
}

interface Lane {
  lane_id: number;
  lane_number: number;
  status: string;
  current_item: LaneItem | null;
}

interface LiveState {
  auction_id: number;
  auction_title: string;
  status: string;
  countdown_seconds: number;
  lanes: Lane[];
}

export default function AuctionLive() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
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
  const [isPollingPaused, setIsPollingPaused] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);

  // ライブ状態を取得
  const fetchLiveState = useCallback(async () => {
    // ボタン操作中はポーリングをスキップ
    if (isPollingPaused || Object.values(bidLoading).some(Boolean)) {
      return;
    }
    
    try {
      const response = await axios.get(`/api/participant/auctions/${auctionId}/live`);
      if (response.data.success) {
        setLiveState(response.data.data);
        setError(null);
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
    
    // ポーリングは無効化（WebSocketのみで動作）
    // 必要な場合は以下のコメントを外す
    // const interval = setInterval(fetchLiveState, 30000);
    // return () => clearInterval(interval);
  }, [auctionId]);

  // WebSocket連携（lane_idでマッチング - 複数レーン対応）
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
      // レーン変更時は該当レーンのみ更新
      setLiveState((prev) => {
        if (!prev) return prev;
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
                    active_bidders_count: event.current_item.active_bidders_count || 0,
                    countdown_seconds: prev.countdown_seconds,
                    my_bid_status: null, // 新商品なので入札していない
                    estimated_price: event.current_item.estimated_price,
                    inspection_info: event.current_item.inspection_info,
                    individual_info: event.current_item.individual_info,
                    media: event.current_item.media,
                  } : null,
                }
              : lane
          ),
        };
      });
      setSocketConnected(true);
    },
    onItemSold: (event) => {
      setSnackbar({
        open: true,
        message: `商品が落札されました！`,
        severity: 'success',
      });
      setSocketConnected(true);
    },
    onAuctionStatus: (event) => {
      setSnackbar({
        open: true,
        message: event.message,
        severity: 'success',
      });
      fetchLiveState();
      setSocketConnected(true);
    },
    onCountdownTick: (event) => {
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
                    countdown_seconds: event.remaining_seconds,
                    active_bidders_count: event.active_bidders_count,
                    current_price: event.current_price,
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
        // 状態を即時更新
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

  // メディア一覧を構築
  const getMediaList = (item: LaneItem | null) => {
    if (!item) return [];
    const list: { type: 'image' | 'video'; url: string }[] = [];
    if (item.thumbnail_path) {
      list.push({ type: 'image', url: item.thumbnail_path });
    }
    if (item.media && item.media.length > 0) {
      item.media.forEach((m: any) => {
        const url = m.file_path || m.url;
        if (!url) return;
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

  // 自分の入札中アイテムを取得
  const myActiveBids = liveState.lanes
    .filter((lane) => lane.current_item?.my_bid_status === 'active')
    .map((lane) => lane);

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* 同意画面オーバーレイ */}
      {!agreed && (
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
          {/* ブラー背景 */}
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
          {/* 同意カード */}
          <Paper
            elevation={8}
            sx={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 480,
              width: '90%',
              p: 4,
              borderRadius: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
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

      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {liveState.auction_title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {liveState.lanes.length}レーン同時進行中
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
                    レーン {lane.lane_number}
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
                    {/* 生体番号・品種名 */}
                    <Typography variant="caption" color="text.secondary">
                      No.{lane.current_item.item_number}
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                      {lane.current_item.species_name}
                    </Typography>

                    {/* 現在価格 */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        現在単価
                      </Typography>
                      <Typography variant="h4" color="primary.main" fontWeight="bold">
                        ¥{Math.floor(lane.current_item.current_price).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        × {lane.current_item.quantity}匹 = ¥
                        {Math.floor(lane.current_item.current_price * lane.current_item.quantity).toLocaleString()}
                      </Typography>
                    </Box>

                    {/* 入札者数・カウントダウン */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Chip
                        label={`残り ${lane.current_item.countdown_seconds ?? 3}秒`}
                        size="small"
                        color={lane.current_item.countdown_seconds <= 1 ? 'error' : 'warning'}
                        sx={{ fontWeight: 'bold', minWidth: 80 }}
                      />
                      <BidderCountDisplay count={lane.current_item.active_bidders_count} />
                    </Box>
                  </CardContent>

                  <CardActions>
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
                      {lane.current_item.my_bid_status === 'active' ? '入札ON' : '入札OFF'}
                    </Button>
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
                      レーン {lane.lane_number}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      待機中
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
                  label={`レーン${lane.lane_number}: ${lane.current_item?.species_name}`}
                  color="success"
                  onDelete={() => lane.current_item && handleBidToggle(lane.current_item.id, 'active')}
                />
              ))
            )}
          </Box>
        </Paper>
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
                        <Box key={i} onClick={() => setSelectedMediaIndex(i)} sx={{
                          width: 64, height: 64, flexShrink: 0, borderRadius: 1, overflow: 'hidden',
                          border: i === selectedMediaIndex ? '2px solid' : '2px solid transparent',
                          borderColor: i === selectedMediaIndex ? 'primary.main' : 'transparent',
                          cursor: 'pointer', position: 'relative', bgcolor: 'grey.200',
                        }}>
                          {m.type === 'video' ? (
                            <Box sx={{ width: '100%', height: '100%', bgcolor: 'grey.800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 28 }} />
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

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
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
