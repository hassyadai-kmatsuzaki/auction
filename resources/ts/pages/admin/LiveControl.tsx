import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Grid, Card, CardContent, CardMedia,
  Chip, IconButton, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Avatar, Tooltip, Badge,
  CircularProgress, Alert, Snackbar, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon, SkipNext as SkipNextIcon, Stop as StopIcon,
  People as PeopleIcon, LiveTv as LiveTvIcon, List as ListIcon,
  FiberManualRecord as RecordIcon, Refresh as RefreshIcon,
  MeetingRoom as MeetingRoomIcon, NoMeetingRoom as NoMeetingRoomIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuctionSocket } from '../../hooks/useAuctionSocket';
import { useLiveControl, ADMIN_LIVE_QUERY_KEY } from '../../features/live-control/hooks/useLiveControl';
import { LaneControlCard } from '../../features/live-control/components/LaneControlCard';
import { useNotificationStore } from '../../stores/notificationStore';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgcolor: string }> = {
  live:       { label: '入札中',   color: '#059669', bgcolor: '#ECFDF5' },
  active:     { label: 'アクティブ', color: '#059669', bgcolor: '#ECFDF5' },
  waiting:    { label: '待機中',   color: '#F59E0B', bgcolor: '#FEF3C7' },
  paused:     { label: '一時停止', color: '#DC2626', bgcolor: '#FEF2F2' },
  registered: { label: '登録済み', color: '#64748B', bgcolor: '#F1F5F9' },
  sold:       { label: '落札済み', color: '#3B82F6', bgcolor: '#DBEAFE' },
  unsold:     { label: '不成立',   color: '#DC2626', bgcolor: '#FEF2F2' },
  finished:   { label: '終了',     color: '#64748B', bgcolor: '#F1F5F9' },
};

const StatusChip = ({ status }: { status: string }) => {
  const c = STATUS_CONFIG[status] ?? { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
  return (
    <Chip size="small" label={c.label}
      sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600, fontSize: '0.7rem' }} />
  );
};

export default function LiveControl() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  const id = Number(auctionId);
  const queryClient = useQueryClient();
  const { showSnackbar } = useNotificationStore();

  const [tabValue, setTabValue]       = useState(0);
  const [snackbar, setSnackbar]       = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: '', title: '', message: '' });

  const {
    liveState, isLoading, refetch,
    pause, resume, finish, nextItem,
    isPausing, isResuming, isFinishing, isNextItem,
    entranceOpened, isEntranceLoading, openEntrance, closeEntrance,
  } = useLiveControl(id);

  const auction    = liveState?.auction;
  const lanes      = liveState?.lanes ?? [];
  const itemStats  = liveState?.item_stats;
  const isLive     = auction?.status === 'live';
  const isPaused   = lanes.some((l: any) => l.status === 'paused');

  const notify = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  // WebSocketでキャッシュを直接更新
  useAuctionSocket({
    auctionId: id,
    onPriceUpdated:  () => queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(id) }),
    onBidderUpdated: () => queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(id) }),
    onLaneChanged:   () => queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(id) }),
    onItemSold:      () => queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(id) }),
    onAuctionStatus: (e) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(id) });
      notify(e.message);
    },
  });

  const handleConfirm = async () => {
    try {
      if (confirmDialog.action === 'start') {
        await axios.post(`/api/admin/auctions/${id}/live/start`);
        notify('オークションを開始しました');
      } else if (confirmDialog.action === 'finish') {
        finish();
        notify('オークションを終了しました');
      }
      queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(id) });
    } catch (err: any) {
      notify(err?.response?.data?.message || '操作に失敗しました', 'error');
    } finally {
      setConfirmDialog((p) => ({ ...p, open: false }));
    }
  };

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  if (!liveState) return (
    <Box>
      <Alert severity="error" sx={{ mb: 2 }}>データの取得に失敗しました。</Alert>
      <Button onClick={() => navigate('/admin/auctions')}>オークション一覧に戻る</Button>
    </Box>
  );

  return (
    <Box>
      {/* アクション */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
        <IconButton onClick={refetch} title="更新"><RefreshIcon /></IconButton>
        {isLive ? (
          <Chip label="LIVE 開催中" color="error" icon={<RecordIcon sx={{ fontSize: 12 }} />}
            sx={{ fontWeight: 600, animation: 'pulse 2s infinite' }} />
        ) : (
          <Chip label={auction?.status === 'finished' ? '終了' : '準備中'}
            color={auction?.status === 'finished' ? 'default' : 'warning'} sx={{ fontWeight: 600 }} />
        )}
      </Box>

      {/* タブ */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<LiveTvIcon />} iconPosition="start" label="ライブコントロール" />
          <Tab icon={<Badge badgeContent={itemStats?.total || 0} color="primary" max={99}><ListIcon /></Badge>}
            iconPosition="start" label="商品統計" />
        </Tabs>
      </Paper>

      {/* ライブコントロールタブ */}
      {tabValue === 0 && (
        <>
          {/* 待機室手動公開パネル（scheduled のときのみ表示） */}
          {auction?.status === 'scheduled' && (
            <Card sx={{ mb: 3, border: '1px solid', borderColor: entranceOpened ? 'success.300' : 'warning.300' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {entranceOpened
                      ? <MeetingRoomIcon sx={{ color: 'success.main', fontSize: 28 }} />
                      : <NoMeetingRoomIcon sx={{ color: 'warning.main', fontSize: 28 }} />}
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        待機室の公開状態
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {entranceOpened
                          ? '現在：手動公開中（参加者が入室できます）'
                          : '現在：閉鎖中（時間設定に従い自動公開されます）'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      variant={entranceOpened ? 'outlined' : 'contained'}
                      color="success"
                      startIcon={<MeetingRoomIcon />}
                      onClick={openEntrance}
                      disabled={entranceOpened || isEntranceLoading}
                    >
                      今すぐ公開
                    </Button>
                    <Button
                      variant={entranceOpened ? 'contained' : 'outlined'}
                      color="warning"
                      startIcon={<NoMeetingRoomIcon />}
                      onClick={closeEntrance}
                      disabled={!entranceOpened || isEntranceLoading}
                    >
                      閉鎖に戻す
                    </Button>
                  </Box>
                </Box>
                <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }} icon={false}>
                  <Typography variant="caption">
                    「今すぐ公開」を押すと、時間設定に関わらず参加者がすぐに待機室へ入室できます。「閉鎖に戻す」を押すと時間設定に戻ります。
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* コントロールパネル */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {!isLive && auction?.status !== 'finished' && (
                    <Button variant="contained" color="success" startIcon={<PlayArrowIcon />}
                      onClick={() => setConfirmDialog({ open: true, action: 'start', title: 'オークション開始', message: 'オークションを開始しますか？' })}>
                      開始
                    </Button>
                  )}
                  {isLive && (
                    <>
                      <Button variant={isPaused ? 'contained' : 'outlined'} color={isPaused ? 'success' : 'warning'}
                        startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                        onClick={() => { isPaused ? resume() : pause(); }}
                        disabled={isPausing || isResuming}>
                        {isPausing || isResuming ? <CircularProgress size={20} /> : isPaused ? '再開' : '一時停止'}
                      </Button>
                      <Button variant="outlined" color="error" startIcon={<StopIcon />}
                        onClick={() => setConfirmDialog({ open: true, action: 'finish', title: 'オークション終了', message: 'オークションを終了しますか？残りの商品は不成立となります。' })}
                        disabled={isFinishing}>
                        終了
                      </Button>
                    </>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  {[{ label: '入札中', value: itemStats?.live, color: '#059669' },
                    { label: '落札済み', value: itemStats?.sold, color: '#3B82F6' },
                    { label: '残り', value: itemStats?.registered, color: 'inherit' }].map(({ label, value, color }) => (
                    <Box key={label} sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value || 0}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* レーングリッド */}
          <Grid container spacing={2}>
            {lanes.map((lane: any) => (
              <Grid item xs={12} sm={6} md={4} key={lane.lane_id}>
                <LaneControlCard lane={lane} onNextItem={nextItem} isLoading={isNextItem} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* 商品統計タブ */}
      {tabValue === 1 && itemStats && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 4 }}>
            {[
              { label: '総商品数', value: itemStats.total, color: 'inherit' },
              { label: '登録済み', value: itemStats.registered, color: 'inherit' },
              { label: '入札中',   value: itemStats.live,       color: '#059669' },
              { label: '落札済み', value: itemStats.sold,       color: '#3B82F6' },
              { label: '不成立',   value: itemStats.unsold,     color: '#DC2626' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color }}>{value}点</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>レーン別商品一覧</Typography>
          <Grid container spacing={3}>
            {lanes.map((lane: any) => (
              <Grid item xs={12} md={6} key={lane.lane_id}>
                <Card>
                  <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>レーン {lane.lane_number}</Typography>
                    <Chip size="small" label={`${lane.all_items_count}件`}
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
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
                        {lane.all_items?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              商品が割り当てられていません
                            </TableCell>
                          </TableRow>
                        ) : (
                          lane.all_items?.map((item: any) => (
                            <TableRow key={item.id}
                              sx={{ bgcolor: item.status === 'live' ? 'success.50' : item.status === 'sold' ? 'primary.50' : 'inherit' }}>
                              <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{item.sequence}</Typography></TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar src={item.thumbnail_path || '/img/noimage.png'} variant="rounded" sx={{ width: 32, height: 32 }} />
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.species_name}</Typography>
                                    <Typography variant="caption" color="text.secondary">No.{item.item_number} × {item.quantity}匹</Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell align="right"><Typography variant="body2">¥{formatYen(item.start_price)}</Typography></TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: item.status === 'sold' ? 700 : 400, color: item.status === 'sold' ? 'primary.main' : 'inherit' }}>
                                  ¥{formatYen(item.current_price)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center"><StatusChip status={item.status} /></TableCell>
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
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog((p) => ({ ...p, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent><Typography>{confirmDialog.message}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog((p) => ({ ...p, open: false }))}>キャンセル</Button>
          <Button onClick={handleConfirm} variant="contained" color="primary">確認</Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </Box>
  );
}
