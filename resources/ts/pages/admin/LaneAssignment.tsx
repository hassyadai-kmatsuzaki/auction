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
  Chip,
  IconButton,
  Avatar,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  DragIndicator as DragIndicatorIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Add as AddIcon,
  Pets as PetsIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface LaneItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  is_premium: boolean;
  status: string;
  thumbnail_path: string | null;
  sequence_order?: number;
}

interface Lane {
  id: number;
  lane_number: number;
  status: string;
  items: LaneItem[];
}

interface AuctionData {
  id: number;
  title: string;
  status: string;
  lane_count: number;
}

interface Statistics {
  total_items: number;
  assigned_items: number;
  unassigned_items: number;
}

export default function LaneAssignment() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [unassignedItems, setUnassignedItems] = useState<LaneItem[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // ドラッグ中のアイテム
  const [draggedItem, setDraggedItem] = useState<LaneItem | null>(null);
  const [dragSource, setDragSource] = useState<{ type: 'lane' | 'unassigned'; laneId?: number } | null>(null);
  
  // 自動割り当てダイアログ
  const [autoAssignDialogOpen, setAutoAssignDialogOpen] = useState(false);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/auctions/${auctionId}/lanes`);
      if (response.data.success) {
        setAuction(response.data.data.auction);
        setLanes(response.data.data.lanes);
        setUnassignedItems(response.data.data.unassigned_items);
        setStatistics(response.data.data.statistics);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ドラッグ開始
  const handleDragStart = (item: LaneItem, source: { type: 'lane' | 'unassigned'; laneId?: number }) => {
    setDraggedItem(item);
    setDragSource(source);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragSource(null);
  };

  // レーンにドロップ
  const handleDropOnLane = async (laneId: number, position?: number) => {
    if (!draggedItem) return;

    try {
      await axios.post(`/api/admin/auctions/${auctionId}/lanes/${laneId}/items`, {
        item_id: draggedItem.id,
        position: position,
      });
      setSnackbar({ open: true, message: '生体をレーンに割り当てました', severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '割り当てに失敗しました', severity: 'error' });
    }
    
    handleDragEnd();
  };

  // レーンから削除
  const handleRemoveFromLane = async (laneId: number, itemId: number) => {
    try {
      await axios.delete(`/api/admin/auctions/${auctionId}/lanes/${laneId}/items/${itemId}`);
      setSnackbar({ open: true, message: 'レーンから削除しました', severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '削除に失敗しました', severity: 'error' });
    }
  };

  // 順序を上に移動
  const handleMoveUp = async (lane: Lane, item: LaneItem, currentIndex: number) => {
    if (currentIndex === 0) return;
    
    const newOrder = lane.items.map(i => i.id);
    [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];
    
    try {
      await axios.put(`/api/admin/auctions/${auctionId}/lanes/${lane.id}/items/reorder`, {
        item_ids: newOrder,
      });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: '順序変更に失敗しました', severity: 'error' });
    }
  };

  // 順序を下に移動
  const handleMoveDown = async (lane: Lane, item: LaneItem, currentIndex: number) => {
    if (currentIndex === lane.items.length - 1) return;
    
    const newOrder = lane.items.map(i => i.id);
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
    
    try {
      await axios.put(`/api/admin/auctions/${auctionId}/lanes/${lane.id}/items/reorder`, {
        item_ids: newOrder,
      });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: '順序変更に失敗しました', severity: 'error' });
    }
  };

  // 自動割り当て
  const handleAutoAssign = async (clearExisting: boolean) => {
    try {
      setAutoAssignLoading(true);
      const response = await axios.post(`/api/admin/auctions/${auctionId}/lanes/auto-assign`, {
        clear_existing: clearExisting,
      });
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      setAutoAssignDialogOpen(false);
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '自動割り当てに失敗しました', severity: 'error' });
    } finally {
      setAutoAssignLoading(false);
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
      <Box>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}>
            戻る
          </Button>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              レーン割り当て
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {auction?.title}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            variant="outlined"
          >
            更新
          </Button>
          <Button
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setAutoAssignDialogOpen(true)}
            variant="contained"
            color="primary"
            disabled={auction?.status === 'live'}
          >
            自動割り当て
          </Button>
        </Box>
      </Box>

      {/* 統計情報 */}
      {statistics && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {statistics.total_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">登録済み生体</Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {statistics.assigned_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">割り当て済み</Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {statistics.unassigned_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">未割り当て</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Grid container spacing={2}>
        {/* 未割り当て生体 */}
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              height: 'calc(100vh - 300px)',
              overflow: 'auto',
              bgcolor: draggedItem && dragSource?.type === 'lane' ? 'action.hover' : 'background.paper',
              border: draggedItem && dragSource?.type === 'lane' ? '2px dashed' : 'none',
              borderColor: 'primary.main',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedItem && dragSource?.type === 'lane' && dragSource.laneId) {
                handleRemoveFromLane(dragSource.laneId, draggedItem.id);
              }
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PetsIcon />
              未割り当て ({unassignedItems.length})
            </Typography>
            
            {unassignedItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                すべての生体が割り当て済みです
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {unassignedItems.map((item) => (
                  <Card
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item, { type: 'unassigned' })}
                    onDragEnd={handleDragEnd}
                    sx={{
                      cursor: 'grab',
                      opacity: draggedItem?.id === item.id ? 0.5 : 1,
                      '&:hover': { boxShadow: 3 },
                      transition: 'all 0.2s',
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        <Avatar
                          src={item.thumbnail_path || undefined}
                          sx={{ width: 32, height: 32, bgcolor: 'grey.200' }}
                        >
                          <PetsIcon sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            #{item.item_number} {item.species_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ¥{item.start_price.toLocaleString()} / {item.quantity}匹
                          </Typography>
                        </Box>
                        {item.is_premium && (
                          <StarIcon sx={{ color: '#F59E0B', fontSize: 18 }} />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* レーン */}
        <Grid item xs={12} md={9}>
          <Grid container spacing={2}>
            {lanes.map((lane) => (
              <Grid item xs={12} md={6} lg={4} key={lane.id}>
                <Paper
                  sx={{
                    p: 2,
                    height: 'calc(100vh - 300px)',
                    overflow: 'auto',
                    bgcolor: draggedItem && dragSource?.laneId !== lane.id ? 'action.hover' : 'background.paper',
                    border: draggedItem && dragSource?.laneId !== lane.id ? '2px dashed' : 'none',
                    borderColor: 'success.main',
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnLane(lane.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      レーン {lane.lane_number}
                    </Typography>
                    <Chip
                      label={`${lane.items.length}件`}
                      size="small"
                      color={lane.items.length > 0 ? 'success' : 'default'}
                    />
                  </Box>

                  {lane.items.length === 0 ? (
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed',
                        borderColor: 'grey.300',
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        生体をドラッグ&ドロップ
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {lane.items.map((item, index) => (
                        <Card
                          key={item.id}
                          draggable
                          onDragStart={() => handleDragStart(item, { type: 'lane', laneId: lane.id })}
                          onDragEnd={handleDragEnd}
                          sx={{
                            cursor: 'grab',
                            opacity: draggedItem?.id === item.id ? 0.5 : 1,
                            '&:hover': { boxShadow: 3 },
                            transition: 'all 0.2s',
                            position: 'relative',
                          }}
                        >
                          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {index + 1}
                                </Typography>
                                <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </Box>
                              <Avatar
                                src={item.thumbnail_path || undefined}
                                sx={{ width: 32, height: 32, bgcolor: 'grey.200' }}
                              >
                                <PetsIcon sx={{ fontSize: 16 }} />
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  #{item.item_number} {item.species_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ¥{item.start_price.toLocaleString()} / {item.quantity}匹
                                </Typography>
                              </Box>
                              {item.is_premium && (
                                <StarIcon sx={{ color: '#F59E0B', fontSize: 18 }} />
                              )}
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveUp(lane, item, index)}
                                  disabled={index === 0}
                                  sx={{ p: 0.25 }}
                                >
                                  <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveDown(lane, item, index)}
                                  disabled={index === lane.items.length - 1}
                                  sx={{ p: 0.25 }}
                                >
                                  <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Box>
                              <Tooltip title="レーンから削除">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveFromLane(lane.id, item.id)}
                                >
                                  <DeleteIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {/* 自動割り当てダイアログ */}
      <Dialog open={autoAssignDialogOpen} onClose={() => setAutoAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>自動割り当て</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            登録済みの生体をレーンに自動で割り当てます。
            プレミアム生体は優先的に上位に配置されます。
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            既存の割り当てをクリアするか、追加で割り当てるかを選択してください。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAssignDialogOpen(false)} disabled={autoAssignLoading}>
            キャンセル
          </Button>
          <Button
            onClick={() => handleAutoAssign(false)}
            disabled={autoAssignLoading}
            variant="outlined"
          >
            {autoAssignLoading ? <CircularProgress size={20} /> : '追加割り当て'}
          </Button>
          <Button
            onClick={() => handleAutoAssign(true)}
            disabled={autoAssignLoading}
            variant="contained"
            color="primary"
          >
            {autoAssignLoading ? <CircularProgress size={20} /> : 'クリアして再割り当て'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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
