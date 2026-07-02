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
  Reorder as ReorderIcon,
  Store as StoreIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  ForwardToInbox as ForwardToInboxIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

interface LaneItem {
  id: number;
  item_number: number;
  /** 出品ID（表示専用）。レーン割当時に発行され以後固定。 */
  exhibit_code?: string | null;
  species_name: string;
  quantity: number;
  start_price: number;
  is_premium: boolean;
  is_anonymous?: boolean;
  status: string;
  thumbnail_path: string | null;
  sequence_order?: number;
  seller_profile_id?: number;
  seller_name?: string;
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

interface SellerGroup {
  seller_profile_id: number;
  seller_name: string;
  seller_code: string | null;
  display_order: number;
  items: LaneItem[];
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

  // 出品ID 一括発行
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);

  // 出品ID通知 再送
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // レーン管理
  const [addingLane, setAddingLane] = useState(false);
  const [editingLaneName, setEditingLaneName] = useState<{ id: number; name: string } | null>(null);

  // 操作中フラグ（二重送信防止）
  const [operating, setOperating] = useState(false);

  // 出品者グループ
  const [hasSellerOrders, setHasSellerOrders] = useState(false);
  const [sellerGroups, setSellerGroups] = useState<SellerGroup[]>([]);

  // 出品者グループのドラッグ
  const [draggedSellerGroup, setDraggedSellerGroup] = useState<SellerGroup | null>(null);
  const [dragOverSellerIdx, setDragOverSellerIdx] = useState<number | null>(null);

  // 未割当アイテムから出品者グループを構築（既存のsellerGroupsの順序を維持）
  const buildSellerGroups = (items: LaneItem[], existingGroups: SellerGroup[]): SellerGroup[] => {
    const groupMap = new Map<number, SellerGroup>();

    // 既存の順序を維持しつつグループを初期化
    existingGroups.forEach(g => {
      groupMap.set(g.seller_profile_id, { ...g, items: [] });
    });

    // 新アイテムを各グループに振り分け（または新グループ作成）
    items.forEach(item => {
      const sid = item.seller_profile_id ?? 0;
      if (!groupMap.has(sid)) {
        groupMap.set(sid, {
          seller_profile_id: sid,
          seller_name: item.seller_name ?? 'その他',
          seller_code: null,
          display_order: groupMap.size + 1,
          items: [],
        });
      }
      groupMap.get(sid)!.items.push(item);
    });

    // 既存の順序でグループを返す（新グループは末尾）
    const existingOrder = existingGroups.map(g => g.seller_profile_id);
    const newSids = [...groupMap.keys()].filter(sid => !existingOrder.includes(sid));
    return [...existingOrder, ...newSids]
      .map(sid => groupMap.get(sid)!)
      .filter(Boolean);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [lanesResponse, sellerOrderResponse] = await Promise.all([
        axios.get(`/api/admin/auctions/${auctionId}/lanes`),
        axios.get(`/api/admin/auctions/${auctionId}/seller-order`).catch(() => null),
      ]);

      if (!lanesResponse.data.success) {
        setError('データの取得に失敗しました');
        return;
      }

      const lanesData = lanesResponse.data.data;
      setAuction(lanesData.auction);
      setLanes(lanesData.lanes);
      const unassigned: LaneItem[] = lanesData.unassigned_items;
      setUnassignedItems(unassigned);
      setStatistics(lanesData.statistics);

      // seller_profile_id が含まれていれば出品者グループ化
      const hasSellers = unassigned.some(item => item.seller_profile_id != null);
      if (hasSellers) {
        // seller-order API の保存済み順序をシードとして使用（リロード後も順序を維持）
        const apiSellerOrders: Array<{ seller_profile_id: number; seller_name: string; seller_code: string | null; display_order: number }> =
          sellerOrderResponse?.data?.data?.seller_orders ?? [];
        const seededGroups: SellerGroup[] = apiSellerOrders.map(so => ({
          seller_profile_id: so.seller_profile_id,
          seller_name: so.seller_name,
          seller_code: so.seller_code,
          display_order: so.display_order,
          items: [],
        }));
        setSellerGroups(buildSellerGroups(unassigned, seededGroups));
        setHasSellerOrders(true);
      } else {
        setHasSellerOrders(false);
        setSellerGroups([]);
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
    setDraggedSellerGroup(null);
    setDragOverSellerIdx(null);
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
      if (hasSellerOrders) {
        setSellerGroups(prev => prev.map(group => ({
          ...group,
          items: group.items.filter(i => i.id !== item.id),
        })));
      }
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
    if (hasSellerOrders) {
      const sid = item.seller_profile_id ?? 0;
      setSellerGroups(prev => {
        const exists = prev.find(g => g.seller_profile_id === sid);
        if (exists) {
          return prev.map(g =>
            g.seller_profile_id === sid
              ? { ...g, items: [...g.items, item].sort((a, b) => a.item_number - b.item_number) }
              : g
          );
        }
        // 新しい出品者グループを末尾に追加
        return [...prev, {
          seller_profile_id: sid,
          seller_name: item.seller_name ?? 'その他',
          seller_code: null,
          display_order: prev.length + 1,
          items: [item],
        }];
      });
    }
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

  // 自動割り当て（未割当のみ対象・Greedy Bin Packing）
  const handleAutoAssign = async () => {
    try {
      setAutoAssignLoading(true);
      const response = await axios.post(`/api/admin/auctions/${auctionId}/lanes/auto-assign`);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      setAutoAssignDialogOpen(false);
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '自動割り当てに失敗しました', severity: 'error' });
    } finally {
      setAutoAssignLoading(false);
    }
  };

  // 出品ID一括発行（レーン割当済み × 未発行の item に対して exhibit_code を発行 + 出品者へ通知）
  const handleIssueExhibitCodes = async () => {
    try {
      setIssueLoading(true);
      const response = await axios.post(`/api/admin/auctions/${auctionId}/lanes/issue-exhibit-codes`);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      setIssueDialogOpen(false);
      fetchData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '出品IDの発行に失敗しました', severity: 'error' });
    } finally {
      setIssueLoading(false);
    }
  };

  // 出品ID通知の再送（発行済みの出品IDを全出品者へメール/LINEでもう一度案内）
  const handleResendExhibitCodes = async () => {
    try {
      setResendLoading(true);
      const response = await axios.post(`/api/admin/auctions/${auctionId}/lanes/resend-exhibit-codes`);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      setResendDialogOpen(false);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '出品ID通知の再送に失敗しました', severity: 'error' });
    } finally {
      setResendLoading(false);
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
  // 出品者グループのドラッグ&ドロップ（並び替え）
  // =============================================

  const handleSellerGroupDragStart = (e: React.DragEvent, group: SellerGroup) => {
    if (operating) return;
    setDraggedSellerGroup(group);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleSellerGroupDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSellerGroup) return;
    setDragOverSellerIdx(idx);
  };

  const handleSellerGroupDrop = async (toIdx: number) => {
    if (!draggedSellerGroup) return;

    const fromIdx = sellerGroups.findIndex(
      (g) => g.seller_profile_id === draggedSellerGroup.seller_profile_id
    );
    if (fromIdx < 0 || fromIdx === toIdx) {
      handleDragEnd();
      return;
    }

    const newGroups = [...sellerGroups];
    const [moved] = newGroups.splice(fromIdx, 1);
    newGroups.splice(toIdx, 0, moved);
    setSellerGroups(newGroups);
    handleDragEnd();

    // APIに保存（seller_profile_id > 0 の実在する出品者のみ）
    const realSellers = newGroups.filter((g) => g.seller_profile_id > 0);
    try {
      await axios.put(`/api/admin/auctions/${auctionId}/seller-order/reorder`, {
        seller_orders: realSellers.map((g, idx) => ({
          seller_profile_id: g.seller_profile_id,
          display_order: idx + 1,
        })),
      });
      setSnackbar({ open: true, message: '出品者順序を更新しました', severity: 'success' });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || '順序の保存に失敗しました',
        severity: 'error',
      });
      fetchData();
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
      {/* アクション */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 3 }}>
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
          {(() => {
            const unissuedCount = lanes.reduce(
              (acc, l) => acc + l.items.filter((it) => !it.exhibit_code).length,
              0,
            );
            const issuedCount = lanes.reduce(
              (acc, l) => acc + l.items.filter((it) => !!it.exhibit_code).length,
              0,
            );
            return (
              <>
                <Button
                  startIcon={<ConfirmationNumberIcon />}
                  onClick={() => setIssueDialogOpen(true)}
                  variant="contained"
                  color="secondary"
                  size="small"
                  disabled={
                    auction?.status === 'live' ||
                    issueLoading ||
                    unissuedCount === 0
                  }
                >
                  出品ID発行
                  {unissuedCount > 0 ? `（${unissuedCount}件）` : ''}
                </Button>
                <Button
                  startIcon={<ForwardToInboxIcon />}
                  onClick={() => setResendDialogOpen(true)}
                  variant="outlined"
                  color="secondary"
                  size="small"
                  disabled={
                    auction?.status === 'live' ||
                    resendLoading ||
                    issuedCount === 0
                  }
                >
                  通知を再送
                </Button>
              </>
            );
          })()}
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
            onDragOver={(e) => { if (draggedItem && dragSource?.type === 'lane') e.preventDefault(); }}
            onDrop={handleDropOnUnassigned}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PetsIcon />
              未割当 ({unassignedItems.length})
            </Typography>

            {hasSellerOrders ? (
              // 出品者グループ表示
              sellerGroups.every((g) => g.items.length === 0) ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  すべての生体が割当済みです
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {sellerGroups.map((group, groupIdx) =>
                    group.items.length === 0 ? null : (
                      <Box
                        key={group.seller_profile_id}
                        onDragOver={(e) => {
                          if (draggedSellerGroup && draggedSellerGroup.seller_profile_id !== group.seller_profile_id) {
                            handleSellerGroupDragOver(e, groupIdx);
                          }
                        }}
                        onDrop={(e) => {
                          if (draggedSellerGroup) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSellerGroupDrop(groupIdx);
                          }
                        }}
                        sx={{
                          border: '1px solid',
                          borderColor: dragOverSellerIdx === groupIdx ? 'primary.main' : 'grey.300',
                          borderRadius: 1,
                          opacity: draggedSellerGroup?.seller_profile_id === group.seller_profile_id ? 0.5 : 1,
                          transition: 'border-color 0.15s, opacity 0.15s',
                          bgcolor: dragOverSellerIdx === groupIdx ? 'primary.50' : 'background.paper',
                        }}
                      >
                        {/* 出品者ヘッダー（ドラッグで並び替え） */}
                        <Box
                          draggable={group.seller_profile_id > 0 && auction?.status !== 'live'}
                          onDragStart={(e) => handleSellerGroupDragStart(e, group)}
                          onDragEnd={handleDragEnd}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            bgcolor: 'grey.100',
                            borderRadius: '4px 4px 0 0',
                            cursor: group.seller_profile_id > 0 && auction?.status !== 'live' ? 'grab' : 'default',
                            '&:active': { cursor: 'grabbing' },
                          }}
                        >
                          {group.seller_profile_id > 0 && auction?.status !== 'live' && (
                            <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                          )}
                          <StoreIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {group.seller_name}
                          </Typography>
                          <Chip label={`${group.items.length}点`} size="small" />
                        </Box>

                        {/* 生体一覧 */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.5 }}>
                          {group.items.map((item) => (
                            <Card
                              key={item.id}
                              draggable={!operating}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                handleDragStart(e, item, { type: 'unassigned' });
                              }}
                              onDragEnd={handleDragEnd}
                              sx={{
                                cursor: operating ? 'default' : 'grab',
                                opacity: draggedItem?.id === item.id ? 0.4 : 1,
                                '&:hover': { boxShadow: 2 },
                                transition: 'all 0.2s',
                              }}
                            >
                              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 18, flexShrink: 0 }} />
                                  <Avatar
                                    src={item.thumbnail_path || undefined}
                                    sx={{ width: 28, height: 28, bgcolor: 'grey.200', flexShrink: 0 }}
                                  >
                                    <PetsIcon sx={{ fontSize: 14 }} />
                                  </Avatar>
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                      {item.is_anonymous && (
                                        <Chip label="匿名" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                                      )}
                                      {item.status === 'draft' && (
                                        <Chip label="審査中" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                                      )}
                                      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                        {item.exhibit_code ?? '未発行'} ・ #{item.item_number} {item.species_name}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                      ¥{formatYen(item.start_price)} / {item.quantity}匹
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
                      </Box>
                    )
                  )}
                </Box>
              )
            ) : (
              // フラット表示（出品者順序未設定時）
              unassignedItems.length === 0 ? (
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              {item.is_anonymous && (
                                <Chip label="匿名" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                              )}
                              {item.status === 'draft' && (
                                <Chip label="審査中" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                              )}
                              <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                {item.exhibit_code ?? '未発行'} ・ #{item.item_number} {item.species_name}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              ¥{formatYen(item.start_price)} / {item.quantity}匹
                            </Typography>
                            {item.seller_name && (
                              <Typography variant="caption" sx={{ display: 'block', color: 'info.main', fontSize: '0.65rem', lineHeight: 1.2 }}>
                                {item.seller_name}
                              </Typography>
                            )}
                          </Box>
                          {item.is_premium && (
                            <StarIcon sx={{ color: '#F59E0B', fontSize: 18, flexShrink: 0 }} />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )
            )}
          </Paper>
        </Grid>

        {/* レーン */}
        <Grid item xs={12} md={9}>
          <Grid container spacing={2}>
            {lanes.map((lane) => (
              <Grid item xs={12} md={6} lg={6} key={lane.id}>
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
                        レーン {lane.lane_name || lane.lane_number}
                      </Typography>
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
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                    {item.is_anonymous && (
                                      <Chip label="匿名" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                                    )}
                                    {item.status === 'draft' && (
                                      <Chip label="審査中" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                                    )}
                                    <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                      {item.exhibit_code ?? '未発行'} ・ #{item.item_number} {item.species_name}
                                    </Typography>
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    ¥{formatYen(item.start_price)} / {item.quantity}匹
                                  </Typography>
                                  {item.seller_name && (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'info.main', fontSize: '0.65rem', lineHeight: 1.2 }}>
                                      {item.seller_name}
                                    </Typography>
                                  )}
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
            未割当の生体を、出品者グループ単位でレーンに自動割り当てします。
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            出品者ごとに生体をグループ化し、各レーンの生体数が均等になるよう分配します。
            レーン内の出品者グループ順はランダムになります。
          </Alert>
          <Alert severity="success">
            既に割り当て済みの生体はそのまま維持され、未割当の生体のみが各レーン末尾に追加されます。
            全てリセットして割り当て直す場合は「一括解除」後に実行してください。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAssignDialogOpen(false)} disabled={autoAssignLoading}>
            キャンセル
          </Button>
          <Button
            onClick={handleAutoAssign}
            disabled={autoAssignLoading}
            variant="contained"
            color="primary"
          >
            {autoAssignLoading ? <CircularProgress size={20} /> : '自動割当を実行'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 出品ID発行ダイアログ */}
      <Dialog open={issueDialogOpen} onClose={() => !issueLoading && setIssueDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>出品IDを発行</DialogTitle>
        <DialogContent>
          {(() => {
            const unissuedItems = lanes.flatMap((l) => l.items.filter((it) => !it.exhibit_code));
            const sellerCount = new Set(
              unissuedItems
                .map((it) => it.seller_profile_id)
                .filter((sid): sid is number => !!sid),
            ).size;
            return (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  レーン割当済みで未発行の生体 <strong>{unissuedItems.length}件</strong> に出品IDを発行します。
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  発行後、対象の出品者（{sellerCount}名）に出品IDをまとめたメール通知が送信されます。
                </Alert>
                <Alert severity="warning">
                  発行された出品IDは固定され、以後レーン移動や並び替えで変わりません。
                  順番に変更がないことを確認してから実行してください。
                </Alert>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)} disabled={issueLoading}>
            キャンセル
          </Button>
          <Button
            onClick={handleIssueExhibitCodes}
            disabled={issueLoading}
            variant="contained"
            color="secondary"
          >
            {issueLoading ? <CircularProgress size={20} /> : '発行して通知'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 出品ID通知 再送ダイアログ */}
      <Dialog open={resendDialogOpen} onClose={() => !resendLoading && setResendDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>出品ID通知を再送</DialogTitle>
        <DialogContent>
          {(() => {
            const issuedItems = lanes.flatMap((l) => l.items.filter((it) => !!it.exhibit_code));
            const sellerCount = new Set(
              issuedItems
                .map((it) => it.seller_profile_id)
                .filter((sid): sid is number => !!sid),
            ).size;
            return (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  発行済みの出品ID <strong>{issuedItems.length}件</strong> を、
                  対象の出品者（{sellerCount}名）へメール / LINE でもう一度案内します。
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  新しい出品IDの発行は行いません。前回と同じ内容の通知が再度届きます（約1分後に送信）。
                </Alert>
                <Alert severity="warning">
                  すでに案内済みの出品者にも重複して届きます。誤送信にご注意ください。
                </Alert>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResendDialogOpen(false)} disabled={resendLoading}>
            キャンセル
          </Button>
          <Button
            onClick={handleResendExhibitCodes}
            disabled={resendLoading}
            variant="contained"
            color="secondary"
          >
            {resendLoading ? <CircularProgress size={20} /> : '再送する'}
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
