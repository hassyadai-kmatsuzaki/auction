import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Pets as PetsIcon,
  ViewKanban as ViewKanbanIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface AuctionStatistics {
  total_items: number;
  pending_items: number;
  registered_items: number;
  assigned_items: number;
  unassigned_items: number;
}

interface Auction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  status: string;
  lane_count: number;
  statistics: AuctionStatistics;
}

export default function ItemManagementAuctions() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // レーン数編集ダイアログ
  const [laneDialogOpen, setLaneDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [newLaneCount, setNewLaneCount] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/auctions-item-management');
      if (response.data.success) {
        setAuctions(response.data.data.auctions);
      }
    } catch (err: any) {
      console.error('オークション一覧取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLaneDialog = (auction: Auction) => {
    setSelectedAuction(auction);
    setNewLaneCount(auction.lane_count);
    setLaneDialogOpen(true);
  };

  const handleCloseLaneDialog = () => {
    setLaneDialogOpen(false);
    setSelectedAuction(null);
  };

  const handleUpdateLaneCount = async () => {
    if (!selectedAuction) return;

    setSaving(true);
    try {
      const response = await axios.patch(`/api/admin/auctions/${selectedAuction.id}/lane-count`, {
        lane_count: newLaneCount,
      });
      if (response.data.success) {
        setSnackbar({ open: true, message: 'レーン数を更新しました。', severity: 'success' });
        fetchAuctions();
        handleCloseLaneDialog();
      }
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'レーン数の更新に失敗しました。',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'preparing':
        return <Chip label="準備中" size="small" icon={<SettingsIcon />} sx={{ bgcolor: '#F3E8FF', color: '#9333EA' }} />;
      case 'scheduled':
        return <Chip label="出品受付中" size="small" icon={<ScheduleIcon />} sx={{ bgcolor: '#DBEAFE', color: '#2563EB' }} />;
      case 'live':
        return <Chip label="開催中" size="small" icon={<PlayArrowIcon />} sx={{ bgcolor: '#FEE2E2', color: '#DC2626' }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          生体管理
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          オークションを選択して生体の登録・レーン割当を行います
        </Typography>
      </Box>

      {auctions.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <PetsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              管理対象のオークションがありません
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              オークションを作成してください
            </Typography>
            <Button variant="contained" onClick={() => navigate('/admin/auctions')}>
              オークション一覧へ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {auctions.map((auction) => {
            const stats = auction.statistics;
            const assignmentProgress = stats.registered_items > 0
              ? (stats.assigned_items / stats.registered_items) * 100
              : 0;

            return (
              <Grid item xs={12} md={6} lg={4} key={auction.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    {/* ヘッダー */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {auction.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {new Date(auction.event_date).toLocaleDateString('ja-JP')} {auction.start_time}
                        </Typography>
                        {getStatusChip(auction.status)}
                      </Box>
                    </Box>

                    {/* 統計 */}
                    <Box sx={{ mb: 3 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ p: 1.5, bgcolor: '#FEF3C7', borderRadius: 1, textAlign: 'center' }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#D97706' }}>
                              {stats.pending_items}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#92400E' }}>
                              審査中
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ p: 1.5, bgcolor: '#ECFDF5', borderRadius: 1, textAlign: 'center' }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>
                              {stats.registered_items}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#065F46' }}>
                              承認済み
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* レーン情報 */}
                    <Box sx={{ mb: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          レーン数: {auction.lane_count}
                        </Typography>
                        <Tooltip title="レーン数を変更">
                          <IconButton size="small" onClick={() => handleOpenLaneDialog(auction)}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={assignmentProgress}
                          sx={{
                            flex: 1,
                            height: 8,
                            borderRadius: 4,
                            bgcolor: '#E2E8F0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: '#059669',
                            },
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 60 }}>
                          {stats.assigned_items}/{stats.registered_items}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        レーン割当済み
                      </Typography>
                    </Box>

                    {/* アクションボタン */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<PetsIcon />}
                        onClick={() => navigate(`/admin/auctions/${auction.id}/items`)}
                        sx={{ flex: 1 }}
                      >
                        生体管理
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<ViewKanbanIcon />}
                        onClick={() => navigate(`/admin/auctions/${auction.id}/lanes`)}
                        sx={{ flex: 1 }}
                      >
                        レーン割当
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* レーン数編集ダイアログ */}
      <Dialog open={laneDialogOpen} onClose={handleCloseLaneDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            レーン数を変更
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedAuction && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {selectedAuction.title}
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="レーン数"
                value={newLaneCount}
                onChange={(e) => setNewLaneCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                inputProps={{ min: 1, max: 10 }}
                helperText={`1〜10の範囲で指定してください（現在: ${selectedAuction.lane_count}レーン）`}
              />
              {selectedAuction.statistics.assigned_items > 0 && newLaneCount < selectedAuction.lane_count && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  レーン{newLaneCount + 1}以降に割り当てられている生体は自動的に未割当に戻ります。
                  事前にレーン割当画面で確認するか、一括解除してからレーン数を変更してください。
                </Alert>
              )}
              {selectedAuction.statistics.assigned_items > 0 && (
                <Alert severity="info" sx={{ mt: 2 }} icon={false}>
                  💡 すべての割り当てを解除したい場合は、レーン割当画面の「一括解除」ボタンをご利用ください。
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseLaneDialog}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleUpdateLaneCount}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
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
    </Box>
  );
}
