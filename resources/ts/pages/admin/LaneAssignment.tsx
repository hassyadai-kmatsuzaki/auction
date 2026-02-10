import { useState, useEffect, useCallback } from 'react';
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
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  DragIndicator as DragIndicatorIcon,
  Delete as DeleteIcon,
  Pets as PetsIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Close as CloseIcon,
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
  lane_name: string | null;
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

interface DragSource {
  type: 'lane' | 'unassigned';
  laneId?: number;
  index?: number;
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

  // ドラッグ状態
  const [draggedItem, setDraggedItem] = useState<LaneItem | null>(null);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);

  // ドロップ先のインジケーター
  const [dropTarget, setDropTarget] = useState<{ laneId: number; position: number } | null>(null);

  // 自動割り当てダイアログ
  const [autoAssignDialogOpen, setAutoAssignDialogOpen] = useState(false);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);

  // 一括解除
  const [bulkUnassignLoading, setBulkUnassignLoading] = useState(false);

  // レーン管理
  const [addingLane, setAddingLane] = useState(false);
  const [editingLaneName, setEditingLaneName] = useState<{ id: number; name: string } | null>(null);

  // 操作中フラグ（二重送信防止）
  const [operating, setOperating] = useState(false);

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

  // =============================================
  // ドラッグ&ドロップ
  // =============================================

  const handleDragStart = (e: React.DragEvent, item: LaneItem, source: DragSource) => {
    if (operating) return;
    setDraggedItem(item);
    setDragSource(source);
    e.dataTransfer.effectAllowed = 'move';
    // Firefoxのために空データを設定
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragSource(null);
    setDropTarget(null);
  };

  // アイテム間のドロップ位置を計算
  const handleDragOverItem = (e: React.DragEvent, laneId: number, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? index + 1 : index + 2; // 1-indexed for API

    setDropTarget({ laneId, position });
  };

  // レーン空エリアへのドラッグオーバー
  const handleDragOverLane = (e: React.DragEvent, laneId: number, itemCount: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    // 空のレーンまたはリストの最後にドロップ
    setDropTarget({ laneId, position: itemCount + 1 });
  };

  // レーンにドロップ
  const handleDropOnLane = async (laneId: number) => {
    if (!draggedItem || operating) return;

    const position = dropTarget?.laneId === laneId ? dropTarget.position : undefined;

    // 同一レーン内で同じ位置ならスキップ
    if (dragSource?.type === 'lane' && dragSource.laneId === laneId && dragSource.index !== undefined) {
      const currentPos = dragSource.index + 1; // 1-indexed
      if (position === currentPos || position === currentPos + 1) {
        handleDragEnd();
        return;
      }
    }

    const item = { ...draggedItem };
    const source = dragSource ? { ...dragSource } : null;

    // 楽観的更新
    // 1) ソースから削除
    if (source?.type === 'lane' && source.laneId) {
      setLanes(prev => prev.map(lane =>
        lane.id === source.laneId
          ? { ...lane, items: lane.items.filter(i => i.id !== item.id) }
          : lane
      ));
    } else if (source?.type === 'unassigned') {
      setUnassignedItems(prev => prev.filter(i => i.id !== item.id));
      setStatistics(prev => prev ? {
        ...prev,
        assigned_items: prev.assigned_items + 1,
        unassigned_items: prev.unassigned_items - 1,
      } : prev);
    }

    // 2) ターゲットレーンに追加
    setLanes(prev => prev.map(lane => {
      if (lane.id !== laneId) return lane;
      const newItems = [...lane.items];
      const insertAt = position ? position - 1 : newItems.length; // 0-indexed
      newItems.splice(insertAt, 0, item);
      return { ...lane, items: newItems };
    }));

    handleDragEnd();

    try {
      await axios.post(`/api/admin/auctions/${auctionId}/lanes/${laneId}/items`, {
        item_id: item.id,
        position: position,
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '操作に失敗しました', severity: 'error' });
      fetchData(); // 失敗時だけリロード
    }
  };

  // レーンからアイテムをローカルで移動するヘルパー
  const moveItemToUnassigned = (laneId: number, item: LaneItem) => {
    setLanes(prev => prev.map(lane =>
      lane.id === laneId
        ? { ...lane, items: lane.items.filter(i => i.id !== item.id) }
        : lane
    ));
    setUnassignedItems(prev => [...prev, item].sort((a, b) => a.item_number - b.item_number));
    setStatistics(prev => prev ? {
      ...prev,
      assigned_items: prev.assigned_items - 1,
      unassigned_items: prev.unassigned_items + 1,
    } : prev);
  };

  // 未割り当てエリアにドロップ（レーンから削除）
  const handleDropOnUnassigned = async () => {
    if (!draggedItem || !dragSource || dragSource.type !== 'lane' || !dragSource.laneId || operating) return;

    const sourceLaneId = dragSource.laneId;
    const item = { ...draggedItem };

    // 楽観的更新
    moveItemToUnassigned(sourceLaneId, item);
    handleDragEnd();

    try {
      await axios.delete(`/api/admin/auctions/${auctionId}/lanes/${sourceLaneId}/items/${item.id}`);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '削除に失敗しました', severity: 'error' });
      fetchData(); // 失敗時だけリロード
    }
  };

  // レーンから削除（ボタン）
  const handleRemoveFromLane = async (laneId: number, itemId: number) => {
    if (operating) return;

    // 対象アイテムを見つける
    const lane = lanes.find(l => l.id === laneId);
    const item = lane?.items.find(i => i.id === itemId);
    if (!item) return;

    // 楽観的更新
    moveItemToUnassigned(laneId, item);
    setSnackbar({ open: true, message: 'レーンから削除しました', severity: 'success' });

    try {
      await axios.delete(`/api/admin/auctions/${auctionId}/lanes/${laneId}/items/${itemId}`);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '削除に失敗しました', severity: 'error' });
      fetchData(); // 失敗時だけリロード
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

  // 一括割り当て解除
  const handleBulkUnassign = async () => {
    if (!confirm('全レーンの割り当てを解除しますか？すべての生体が未割当に戻ります。')) return;
    try {
      setBulkUnassignLoading(true);
      const response = await axios.post(`/api/admin/auctions/${auctionId}/lanes/bulk-unassign`);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '一括解除に失敗しました', severity: 'error' });
    } finally {
      setBulkUnassignLoading(false);
    }
  };

  // レーン追加
  const handleAddLane = async () => {
    try {
      setAddingLane(true);
      const response = await axios.post(`/api/admin/auctions/${auctionId}/lanes/create`);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'レーン追加に失敗しました', severity: 'error' });
    } finally {
      setAddingLane(false);
    }
  };

  // レーン削除
  const handleDeleteLane = async (laneId: number, laneNumber: number, itemCount: number) => {
    const msg = itemCount > 0
      ? `レーン${laneNumber}には${itemCount}件の割り当てがあります。削除すると未割当に戻ります。削除しますか？`
      : `レーン${laneNumber}を削除しますか？`;
    if (!confirm(msg)) return;

    try {
      setOperating(true);
      const response = await axios.delete(`/api/admin/auctions/${auctionId}/lanes/${laneId}`);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'レーン削除に失敗しました', severity: 'error' });
    } finally {
      setOperating(false);
    }
  };

  // レーン名変更
  const handleSaveLaneName = async () => {
    if (!editingLaneName) return;
    try {
      setOperating(true);
      await axios.put(`/api/admin/auctions/${auctionId}/lanes/${editingLaneName.id}`, {
        lane_name: editingLaneName.name || null,
      });
      setSnackbar({ open: true, message: 'レーン名を更新しました。', severity: 'success' });
      setEditingLaneName(null);
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'レーン名の更新に失敗しました', severity: 'error' });
    } finally {
      setOperating(false);
    }
  };

  // =============================================
  // ドロップインジケーター
  // =============================================

  const DropIndicator = ({ visible }: { visible: boolean }) => (
    <Box
      sx={{
        height: visible ? 3 : 0,
        bgcolor: visible ? 'primary.main' : 'transparent',
        borderRadius: 2,
        mx: 1,
        transition: 'height 0.15s ease',
        position: 'relative',
        '&::before': visible ? {
          content: '""',
          position: 'absolute',
          left: -4,
          top: -3,
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: 'primary.main',
        } : {},
        '&::after': visible ? {
          content: '""',
          position: 'absolute',
          right: -4,
          top: -3,
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: 'primary.main',
        } : {},
      }}
    />
  );

  // =============================================
  // レンダリング
  // =============================================

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
              レーン割当
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {auction?.title}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            variant="outlined"
            size="small"
          >
            更新
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddLane}
            variant="outlined"
            color="success"
            size="small"
            disabled={auction?.status === 'live' || addingLane || lanes.length >= 10}
          >
            {addingLane ? <CircularProgress size={18} /> : 'レーン追加'}
          </Button>
          {statistics && statistics.assigned_items > 0 && (
            <Button
              startIcon={<DeleteIcon />}
              onClick={handleBulkUnassign}
              variant="outlined"
              color="error"
              size="small"
              disabled={auction?.status === 'live' || bulkUnassignLoading}
            >
              {bulkUnassignLoading ? <CircularProgress size={18} /> : '一括解除'}
            </Button>
          )}
          <Button
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setAutoAssignDialogOpen(true)}
            variant="contained"
            color="primary"
            size="small"
            disabled={auction?.status === 'live'}
          >
            自動割当
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
                <Typography variant="body2" color="text.secondary">割当済み</Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {statistics.unassigned_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">未割当</Typography>
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
              transition: 'all 0.2s',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnUnassigned}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PetsIcon />
              未割当 ({unassignedItems.length})
            </Typography>

            {unassignedItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                すべての生体が割当済みです
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {unassignedItems.map((item) => (
                  <Card
                    key={item.id}
                    draggable={!operating}
                    onDragStart={(e) => handleDragStart(e, item, { type: 'unassigned' })}
                    onDragEnd={handleDragEnd}
                    sx={{
                      cursor: operating ? 'default' : 'grab',
                      opacity: draggedItem?.id === item.id ? 0.4 : 1,
                      '&:hover': { boxShadow: 3 },
                      transition: 'all 0.2s',
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                        <Avatar
                          src={item.thumbnail_path || undefined}
                          sx={{ width: 32, height: 32, bgcolor: 'grey.200', flexShrink: 0 }}
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
                          <StarIcon sx={{ color: '#F59E0B', fontSize: 18, flexShrink: 0 }} />
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
                    bgcolor: draggedItem && !(dragSource?.type === 'lane' && dragSource.laneId === lane.id && lane.items.length === 1)
                      ? 'grey.50' : 'background.paper',
                    border: draggedItem && dropTarget?.laneId === lane.id ? '2px solid' : draggedItem ? '2px dashed' : 'none',
                    borderColor: dropTarget?.laneId === lane.id ? 'primary.main' : 'grey.300',
                    transition: 'border-color 0.15s ease',
                  }}
                  onDragOver={(e) => handleDragOverLane(e, lane.id, lane.items.length)}
                  onDrop={() => handleDropOnLane(lane.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, flexShrink: 0 }}>
                        レーン {lane.lane_number}
                      </Typography>
                      {lane.lane_name && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          ({lane.lane_name})
                        </Typography>
                      )}
                      {auction?.status !== 'live' && (
                        <Tooltip title="レーン名を編集">
                          <IconButton
                            size="small"
                            onClick={() => setEditingLaneName({ id: lane.id, name: lane.lane_name || '' })}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={`${lane.items.length}件`}
                        size="small"
                        color={lane.items.length > 0 ? 'success' : 'default'}
                      />
                      {auction?.status !== 'live' && lanes.length > 1 && (
                        <Tooltip title="このレーンを削除">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteLane(lane.id, lane.lane_number, lane.items.length)}
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {lane.items.length === 0 ? (
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed',
                        borderColor: draggedItem ? 'primary.main' : 'grey.300',
                        borderRadius: 2,
                        bgcolor: draggedItem ? 'primary.50' : 'grey.50',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        ここにドラッグ&ドロップ
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {lane.items.map((item, index) => (
                        <Box key={item.id}>
                          {/* ドロップインジケーター（アイテムの上） */}
                          <DropIndicator
                            visible={
                              !!draggedItem &&
                              dropTarget?.laneId === lane.id &&
                              dropTarget?.position === index + 1 &&
                              draggedItem.id !== item.id
                            }
                          />

                          <Card
                            draggable={!operating}
                            onDragStart={(e) => handleDragStart(e, item, { type: 'lane', laneId: lane.id, index })}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOverItem(e, lane.id, index)}
                            sx={{
                              cursor: operating ? 'default' : 'grab',
                              opacity: draggedItem?.id === item.id ? 0.4 : 1,
                              '&:hover': { boxShadow: 3 },
                              transition: 'opacity 0.2s',
                              my: 0.5,
                            }}
                          >
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1 }}>
                                    {index + 1}
                                  </Typography>
                                  <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                </Box>
                                <Avatar
                                  src={item.thumbnail_path || undefined}
                                  sx={{ width: 32, height: 32, bgcolor: 'grey.200', flexShrink: 0 }}
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
                                  <StarIcon sx={{ color: '#F59E0B', fontSize: 18, flexShrink: 0 }} />
                                )}
                                <Tooltip title="レーンから削除">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveFromLane(lane.id, item.id)}
                                    disabled={operating}
                                    sx={{ flexShrink: 0 }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </CardContent>
                          </Card>

                          {/* 最後のアイテムの下にもドロップインジケーター */}
                          {index === lane.items.length - 1 && (
                            <DropIndicator
                              visible={
                                !!draggedItem &&
                                dropTarget?.laneId === lane.id &&
                                dropTarget?.position === index + 2 &&
                                draggedItem.id !== item.id
                              }
                            />
                          )}
                        </Box>
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
        <DialogTitle>自動割当</DialogTitle>
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
            {autoAssignLoading ? <CircularProgress size={20} /> : '追加割当'}
          </Button>
          <Button
            onClick={() => handleAutoAssign(true)}
            disabled={autoAssignLoading}
            variant="contained"
            color="primary"
          >
            {autoAssignLoading ? <CircularProgress size={20} /> : 'クリアして再割当'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* レーン名編集ダイアログ */}
      <Dialog open={!!editingLaneName} onClose={() => setEditingLaneName(null)} maxWidth="xs" fullWidth>
        <DialogTitle>レーン名を編集</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="レーン名（任意）"
            value={editingLaneName?.name || ''}
            onChange={(e) => setEditingLaneName(prev => prev ? { ...prev, name: e.target.value } : null)}
            placeholder="例: 熱帯魚、爬虫類"
            sx={{ mt: 1 }}
            helperText="空欄にするとレーン番号のみ表示されます"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingLaneName(null)}>キャンセル</Button>
          <Button onClick={handleSaveLaneName} variant="contained" disabled={operating}>
            {operating ? <CircularProgress size={20} /> : '保存'}
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
