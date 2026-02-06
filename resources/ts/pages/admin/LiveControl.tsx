import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  TextField,
  InputAdornment,
  Tooltip,
  Badge,
  Divider,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  Stop as StopIcon,
  People as PeopleIcon,
  LiveTv as LiveTvIcon,
  List as ListIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  FiberManualRecord as RecordIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';

interface LaneItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  estimated_price?: number;
  status: string;
  is_premium: boolean;
  thumbnail_path?: string;
  active_bidders_count: number;
  active_bidders?: Array<{
    user_id: number;
    user_name: string;
    activated_at: string;
  }>;
}

interface LaneItemDetail {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  status: string;
  is_premium: boolean;
  thumbnail_path?: string;
  sequence: number;
}

interface Lane {
  lane_id: number;
  lane_number: number;
  status: string;
  current_item: LaneItem | null;
  queued_items: Array<{
    id: number;
    item_number: number;
    species_name: string;
    status: string;
    sequence: number;
  }>;
  queued_count: number;
  all_items: LaneItemDetail[];
  all_items_count: number;
}

interface AuctionData {
  id: number;
  title: string;
  status: string;
  event_date: string;
  start_time: string | null;
  countdown_seconds: number;
  default_bid_increment: number;
}

interface ItemStats {
  total: number;
  registered: number;
  live: number;
  sold: number;
  unsold: number;
}

export default function LiveControl() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [itemStats, setItemStats] = useState<ItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; title: string; message: string }>({
    open: false,
    action: '',
    title: '',
    message: '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  // データ取得
  const fetchLiveState = useCallback(async () => {
    try {
      const response = await axios.get(`/api/admin/auctions/${auctionId}/live`);
      if (response.data.success) {
        setAuction(response.data.data.auction);
        setLanes(response.data.data.lanes);
        setItemStats(response.data.data.item_stats);
        setError(null);
      }
    } catch (err: any) {
      console.error('ライブ状態取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchLiveState();
    // ポーリング（5秒ごとに更新）
    const interval = setInterval(fetchLiveState, 5000);
    return () => clearInterval(interval);
  }, [fetchLiveState]);

  // WebSocket連携
  useAuctionSocket({
    auctionId: Number(auctionId),
    onPriceUpdated: (event) => {
      setLanes((prev) =>
        prev.map((lane) =>
          lane.lane_id === event.lane_id && lane.current_item?.id === event.item_id
            ? {
                ...lane,
                current_item: {
                  ...lane.current_item!,
                  current_price: event.new_price,
                  active_bidders_count: event.active_bidders_count,
                },
              }
            : lane
        )
      );
    },
    onBidderUpdated: (event) => {
      setLanes((prev) =>
        prev.map((lane) =>
          lane.lane_id === event.lane_id && lane.current_item?.id === event.item_id
            ? {
                ...lane,
                current_item: {
                  ...lane.current_item!,
                  active_bidders_count: event.active_bidders_count,
                },
              }
            : lane
        )
      );
    },
    onLaneChanged: (event) => {
      fetchLiveState();
    },
    onItemSold: (event) => {
      fetchLiveState();
    },
    onAuctionStatus: (event) => {
      fetchLiveState();
      setSnackbar({
        open: true,
        message: event.message,
        severity: 'success',
      });
    },
  });

  // オークション開始
  const handleStart = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/auctions/${auctionId}/live/start`);
      if (response.data.success) {
        setSnackbar({ open: true, message: 'オークションを開始しました', severity: 'success' });
        fetchLiveState();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '開始に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  // 一時停止
  const handlePause = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/auctions/${auctionId}/live/pause`);
      if (response.data.success) {
        setSnackbar({ open: true, message: '一時停止しました', severity: 'success' });
        fetchLiveState();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '一時停止に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 再開
  const handleResume = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/auctions/${auctionId}/live/resume`);
      if (response.data.success) {
        setSnackbar({ open: true, message: '再開しました', severity: 'success' });
        fetchLiveState();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '再開に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 終了
  const handleFinish = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/auctions/${auctionId}/live/finish`);
      if (response.data.success) {
        setSnackbar({ open: true, message: 'オークションを終了しました', severity: 'success' });
        fetchLiveState();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '終了に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  // 次の商品へ
  const handleNextItem = async (laneId: number) => {
    try {
      const response = await axios.post(`/api/admin/lanes/${laneId}/next-item`);
      if (response.data.success) {
        setSnackbar({ open: true, message: '次の商品に進みました', severity: 'success' });
        fetchLiveState();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '操作に失敗しました', severity: 'error' });
    }
  };

  // 確認ダイアログの処理
  const handleConfirmAction = () => {
    switch (confirmDialog.action) {
      case 'start':
        handleStart();
        break;
      case 'finish':
        handleFinish();
        break;
    }
  };

  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string; hasIcon?: boolean }> = {
      live: { label: '入札中', color: '#059669', bgcolor: '#ECFDF5', hasIcon: true },
      active: { label: 'アクティブ', color: '#059669', bgcolor: '#ECFDF5' },
      waiting: { label: '待機中', color: '#F59E0B', bgcolor: '#FEF3C7' },
      paused: { label: '一時停止', color: '#DC2626', bgcolor: '#FEF2F2' },
      registered: { label: '登録済み', color: '#64748B', bgcolor: '#F1F5F9' },
      sold: { label: '落札済み', color: '#3B82F6', bgcolor: '#DBEAFE' },
      unsold: { label: '不成立', color: '#DC2626', bgcolor: '#FEF2F2' },
      finished: { label: '終了', color: '#64748B', bgcolor: '#F1F5F9' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return (
      <Chip
        size="small"
        label={c.label}
        icon={c.hasIcon ? <RecordIcon sx={{ fontSize: 10, animation: 'pulse 1s infinite' }} /> : undefined}
        sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600, fontSize: '0.7rem' }}
      />
    );
  };

  const isPaused = lanes.some((lane) => lane.status === 'paused');
  const isLive = auction?.status === 'live';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={() => navigate('/admin/auctions')}>オークション一覧に戻る</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/auctions')}>
            戻る
          </Button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              ライブオークション管理
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {auction?.title}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={fetchLiveState} title="更新">
            <RefreshIcon />
          </IconButton>
          {isLive ? (
          <Chip
            label="LIVE 開催中"
            color="error"
            icon={<RecordIcon sx={{ fontSize: 12 }} />}
            sx={{ fontWeight: 600, animation: 'pulse 2s infinite' }}
          />
          ) : (
            <Chip
              label={auction?.status === 'finished' ? '終了' : '準備中'}
              color={auction?.status === 'finished' ? 'default' : 'warning'}
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>
      </Box>

      {/* タブ切り替え */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<LiveTvIcon />} iconPosition="start" label="ライブコントロール" />
          <Tab
            icon={<Badge badgeContent={itemStats?.total || 0} color="primary" max={99}><ListIcon /></Badge>}
            iconPosition="start"
            label="商品統計"
          />
        </Tabs>
      </Paper>

      {/* ライブコントロールタブ */}
      {tabValue === 0 && (
        <>
          {/* コントロールパネル */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {!isLive && auction?.status !== 'finished' && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => setConfirmDialog({
                        open: true,
                        action: 'start',
                        title: 'オークション開始',
                        message: 'オークションを開始しますか？',
                      })}
                      disabled={actionLoading}
                    >
                      開始
                    </Button>
                  )}
                  {isLive && (
                    <>
                  <Button
                    variant={isPaused ? 'contained' : 'outlined'}
                    color={isPaused ? 'success' : 'warning'}
                    startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                        onClick={isPaused ? handleResume : handlePause}
                        disabled={actionLoading}
                  >
                    {isPaused ? '再開' : '一時停止'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                        onClick={() => setConfirmDialog({
                          open: true,
                          action: 'finish',
                          title: 'オークション終了',
                          message: 'オークションを終了しますか？残りの商品は不成立となります。',
                        })}
                        disabled={actionLoading}
                      >
                        終了
                  </Button>
                    </>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>入札中</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>{itemStats?.live || 0}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>落札済み</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#3B82F6' }}>{itemStats?.sold || 0}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>残り</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{itemStats?.registered || 0}</Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* 6レーン表示 */}
          <Grid container spacing={2}>
            {lanes.map((lane) => (
              <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                <Card sx={{ position: 'relative', overflow: 'visible' }}>
                  {lane.current_item?.status === 'live' && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: '#DC2626',
                        color: 'white',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 1s infinite',
                      }}
                    >
                      <RecordIcon sx={{ fontSize: 12 }} />
                    </Box>
                  )}
                  <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5 }}>
                    <Typography variant="subtitle1" align="center" sx={{ fontWeight: 600 }}>
                      レーン {lane.lane_number}
                    </Typography>
                  </Box>
                  
                  {lane.current_item ? (
                    <>
                  <CardMedia
                        component="img"
                        height={120}
                        image={lane.current_item.thumbnail_path || '/img/noimage.png'}
                        alt={lane.current_item.species_name}
                        sx={{ objectFit: 'cover' }}
                      />

                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            No.{lane.current_item.item_number}
                      </Typography>
                          {getStatusChip(lane.current_item.status)}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
                          {lane.current_item.species_name}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h4" sx={{ color: '#059669', fontWeight: 700 }}>
                            ¥{Number(lane.current_item.current_price).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            開始 ¥{Number(lane.current_item.start_price).toLocaleString()} × {lane.current_item.quantity}匹
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                            label="入札中"
                            color={lane.current_item.active_bidders_count > 0 ? 'primary' : 'default'}
                        size="small"
                        sx={{ fontSize: '0.7rem' }}
                      />
                          {isLive && (
                            <Tooltip title="次の商品へ">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleNextItem(lane.lane_id)}
                              >
                        <SkipNextIcon />
                      </IconButton>
                            </Tooltip>
                          )}
                        </Box>

                        {/* アクティブな入札者 */}
                        {lane.current_item.active_bidders && lane.current_item.active_bidders.length > 0 && (
                          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                              入札者:
                            </Typography>
                            {lane.current_item.active_bidders.slice(0, 3).map((bidder, index) => (
                              <Chip
                                key={bidder.user_id}
                                label={bidder.user_name}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5, fontSize: '0.65rem' }}
                              />
                            ))}
                            {lane.current_item.active_bidders.length > 3 && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                +{lane.current_item.active_bidders.length - 3}名
                              </Typography>
                            )}
                          </Box>
                        )}
                      </CardContent>
                    </>
                  ) : (
                    <CardContent sx={{ p: 2, textAlign: 'center', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {lane.status === 'finished' ? 'レーン終了' : '待機中'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          残り {lane.queued_count} 商品
                        </Typography>
                    </Box>
                  </CardContent>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* 商品統計タブ */}
      {tabValue === 1 && itemStats && (
        <>
          {/* 統計カード */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 4 }}>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>総商品数</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{itemStats.total}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>登録済み</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{itemStats.registered}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>入札中</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>{itemStats.live}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>落札済み</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#3B82F6' }}>{itemStats.sold}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>不成立</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#DC2626' }}>{itemStats.unsold}点</Typography>
              </CardContent>
            </Card>
          </Box>

          {/* レーン別商品一覧 */}
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            レーン別商品一覧
          </Typography>
          <Grid container spacing={3}>
            {lanes.map((lane) => (
              <Grid item xs={12} md={6} key={lane.lane_id}>
                <Card>
                  <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      レーン {lane.lane_number}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${lane.all_items_count}件`}
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                    />
                  </Box>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 50 }}>順</TableCell>
                          <TableCell>商品名</TableCell>
                          <TableCell align="right">開始価格</TableCell>
                          <TableCell align="right">現在価格</TableCell>
                          <TableCell align="center">状態</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lane.all_items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              商品が割り当てられていません
                            </TableCell>
                          </TableRow>
                        ) : (
                          lane.all_items.map((item) => (
                            <TableRow
                              key={item.id}
                              sx={{
                                bgcolor: item.status === 'live' ? 'success.50' : item.status === 'sold' ? 'primary.50' : 'inherit',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {item.sequence}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar
                                    src={item.thumbnail_path || '/img/noimage.png'}
                                    variant="rounded"
                                    sx={{ width: 32, height: 32 }}
                                  />
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                                      {item.species_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      No.{item.item_number} × {item.quantity}匹
                                    </Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  ¥{Number(item.start_price).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: item.status === 'sold' ? 700 : 400,
                                    color: item.status === 'sold' ? 'primary.main' : 'inherit',
                                  }}
                                >
                                  ¥{Number(item.current_price).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {getStatusChip(item.status)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* 確認ダイアログ */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} disabled={actionLoading}>
            キャンセル
          </Button>
          <Button onClick={handleConfirmAction} variant="contained" color="primary" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : '確認'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* アニメーション用スタイル */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Box>
  );
}
