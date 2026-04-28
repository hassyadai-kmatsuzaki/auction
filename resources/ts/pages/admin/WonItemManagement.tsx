import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  TablePagination,
  Link,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  LocalShipping as LocalShippingIcon,
  Search as SearchIcon,
  FileDownload as ExportIcon,
  Receipt as ReceiptIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  Calculate as CalculateIcon,
  Description as DescriptionIcon,
  Inventory2 as Inventory2Icon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

interface WonItem {
  id: number;
  item: {
    id: number;
    item_number: number;
    species_name: string;
    quantity: number;
    thumbnail_path?: string;
  };
  winner: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  winning_price: number;
  quantity: number;
  total_amount: number;
  commission_amount: number;
  shipping_fee: number;
  payment_status: string;
  payment_deadline?: string;
  delivery_status: string;
  delivery_method?: string;
  shipping_address?: string;
  tracking_number?: string;
  shipping_company?: string;
  shipped_at?: string;
  shipping_calculated_at?: string;
  shipping_approved_at?: string | null;
  calculation_mode?: 'auto' | 'manual' | 'mixed' | null;
  shipping_fee_auto?: number | null;
  created_at: string;
}

// 配送業者の追跡URLを生成
const getTrackingUrl = (trackingNumber: string, company: string) => {
  const cleanNumber = trackingNumber.replace(/-/g, '');
  switch (company) {
    case 'ヤマト運輸':
      return `https://jizen.kuronekoyamato.co.jp/jizen/servlet/crjz.b.NQ0010?id=${cleanNumber}`;
    case '佐川急便':
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${cleanNumber}`;
    case '日本郵便':
      return `https://trackings.post.japanpost.jp/services/srv/search/direct?searchKind=S003&locale=ja&SVID=023&reqCodeNo1=${cleanNumber}`;
    default:
      return '';
  }
};

interface Statistics {
  total_items: number;
  total_sales: number;
  total_shipping_fees: number;
  pending_count: number;
  pending_amount: number;
  paid_count: number;
  paid_amount: number;
  shipped_count: number;
  completed_count: number;
}

const REGION_LABELS: Record<string, string> = {
  hokkaido: '北海道',
  tohoku: '東北',
  kanto: '関東',
  shinetsu: '信越',
  hokuriku: '北陸',
  chubu: '中部',
  kansai: '関西',
  chugoku: '中国',
  shikoku: '四国',
  kyushu: '九州',
  okinawa: '沖縄',
};

interface ShippingBoxBreakdown {
  box_size: number;
  bags: string[];
  shipping_cost: number;
  packing_material_cost: number;
}

interface ShippingBreakdown {
  bags: Array<{ size: string; quantity: number }>;
  boxes: ShippingBoxBreakdown[];
  shipping_cost: number;
  packing_material_cost: number;
  total_shipping_fee: number;
  destination_region: string;
}

interface ShippingDetail {
  winnerName?: string;
  winnerEmail?: string;
  itemCount: number;
  totalQuantity: number;
  calculatedAt?: string | null;
  breakdown: ShippingBreakdown;
}

interface AuctionInfo {
  id: number;
  title: string;
  event_date: string;
}

function StatCard({ title, value, subValue, icon, color }: { title: string; value: string; subValue?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            {subValue && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {subValue}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function WonItemManagement() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  const [auction, setAuction] = useState<AuctionInfo | null>(null);
  const [wonItems, setWonItems] = useState<WonItem[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WonItem | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_number: '', shipping_company: 'ヤマト運輸' });
  const [actionLoading, setActionLoading] = useState(false);
  const [shippingDetailOpen, setShippingDetailOpen] = useState(false);
  const [shippingDetail, setShippingDetail] = useState<ShippingDetail | null>(null);
  const [shippingDetailLoading, setShippingDetailLoading] = useState(false);
  const [approveShippingOpen, setApproveShippingOpen] = useState(false);
  const [approveShippingWinnerId, setApproveShippingWinnerId] = useState<number | null>(null);
  const [approveShippingAutoFee, setApproveShippingAutoFee] = useState<number>(0);
  const [approveShippingOverride, setApproveShippingOverride] = useState<string>('');
  const [approveShippingReason, setApproveShippingReason] = useState<string>('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // データ取得
  const fetchWonItems = useCallback(async () => {
    try {
      const paymentFilter = tabValue === 1 ? 'pending' : tabValue === 2 ? 'confirmed' : tabValue === 3 ? 'confirmed' : undefined;
      const deliveryFilter = tabValue === 2 ? 'preparing' : tabValue === 3 ? 'shipped' : undefined;

      const response = await axios.get(`/api/admin/auctions/${auctionId}/won-items`, {
        params: {
          page: page + 1,
          per_page: rowsPerPage,
          payment_status: paymentFilter,
          delivery_status: deliveryFilter,
        },
      });

      if (response.data.success) {
        setAuction(response.data.data.auction);
        setWonItems(response.data.data.won_items);
        setStatistics(response.data.data.statistics);
        setTotalItems(response.data.data.pagination.total);
        setError(null);
      }
    } catch (err: any) {
      console.error('落札商品取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [auctionId, page, rowsPerPage, tabValue]);

  useEffect(() => {
    fetchWonItems();
  }, [fetchWonItems]);

  // 入金確認
  const handleConfirmPayment = async (id: number) => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/won-items/${id}/confirm-payment`);
      if (response.data.success) {
        setSnackbar({ open: true, message: '入金を確認しました', severity: 'success' });
        fetchWonItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '入金確認に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 発送登録
  const handleShip = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/won-items/${selectedItem.id}/ship`, {
        shipping_company: trackingForm.shipping_company,
        tracking_number: trackingForm.tracking_number,
      });
      if (response.data.success) {
        setSnackbar({ open: true, message: '発送を登録しました', severity: 'success' });
        setTrackingDialogOpen(false);
        fetchWonItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '発送登録に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenTrackingDialog = (item: WonItem) => {
    setSelectedItem(item);
    setTrackingForm({ tracking_number: item.tracking_number || '', shipping_company: 'ヤマト運輸' });
    setTrackingDialogOpen(true);
  };

  const handleCopyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  // 配達完了
  const handleComplete = async (id: number) => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/won-items/${id}/complete`);
      if (response.data.success) {
        setSnackbar({ open: true, message: '配達完了を登録しました', severity: 'success' });
        fetchWonItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '配達完了に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 送料内訳を取得して表示（落札者単位）
  const handleOpenShippingDetail = async (items: WonItem[]) => {
    const representative = items.find((i) => i.shipping_calculated_at) || items[0];
    if (!representative) return;
    setShippingDetailOpen(true);
    setShippingDetail(null);
    setShippingDetailLoading(true);
    try {
      const response = await axios.get(`/api/admin/won-items/${representative.id}`);
      if (response.data.success) {
        const w = response.data.data.won_item;
        if (!w.shipping_breakdown) {
          setSnackbar({ open: true, message: 'この落札者の送料はまだ計算されていません', severity: 'error' });
          setShippingDetailOpen(false);
          return;
        }
        setShippingDetail({
          winnerName: w.winner?.name,
          winnerEmail: w.winner?.email,
          itemCount: items.length,
          totalQuantity: items.reduce((sum, i) => sum + Number(i.item.quantity || 0), 0),
          calculatedAt: representative.shipping_calculated_at,
          breakdown: w.shipping_breakdown,
        });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: '送料内訳の取得に失敗しました', severity: 'error' });
      setShippingDetailOpen(false);
    } finally {
      setShippingDetailLoading(false);
    }
  };

  // 送料入力モーダルを開く（「その他」を含む発送単位の手動確定用）
  const handleOpenApproveShipping = (winnerId: number, _autoFee: number) => {
    setApproveShippingWinnerId(winnerId);
    setApproveShippingAutoFee(0);
    setApproveShippingOverride('');
    setApproveShippingReason('');
    setApproveShippingOpen(true);
  };

  // 送料無料ボタン
  const handleSetFreeShipping = () => {
    setApproveShippingOverride('0');
    setApproveShippingReason('送料無料');
  };

  // 送料入力を確定
  const handleSubmitApproveShipping = async () => {
    if (approveShippingWinnerId === null) return;
    if (approveShippingOverride.trim() === '') {
      setSnackbar({ open: true, message: '送料を入力してください', severity: 'error' });
      return;
    }
    const overrideNum = Number(approveShippingOverride);
    if (Number.isNaN(overrideNum) || overrideNum < 0) {
      setSnackbar({ open: true, message: '送料は0以上の数値を入力してください', severity: 'error' });
      return;
    }
    if (overrideNum === 0 && !approveShippingReason.trim()) {
      setSnackbar({ open: true, message: '送料0円で確定する場合は「送料無料」ボタンを押すか、理由を入力してください', severity: 'error' });
      return;
    }
    setActionLoading(true);
    try {
      const payload: Record<string, any> = {
        shipping_fee: overrideNum,
      };
      if (approveShippingReason.trim()) {
        payload.adjustment_reason = approveShippingReason.trim();
      }
      const response = await axios.post(
        `/api/admin/auctions/${auctionId}/winners/${approveShippingWinnerId}/approve-shipping`,
        payload,
      );
      if (response.data.success) {
        setSnackbar({ open: true, message: response.data.message || '送料を確定しました', severity: 'success' });
        setApproveShippingOpen(false);
        fetchWonItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '送料の確定に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 送料計算（落札者単位）
  const handleCalculateShipping = async (winnerId: number) => {
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/admin/auctions/${auctionId}/winners/${winnerId}/calculate-shipping`);
      if (response.data.success) {
        const fee = response.data.data?.total_shipping_fee;
        setSnackbar({ open: true, message: `送料を計算しました（¥${formatYen(fee)}）`, severity: 'success' });
        fetchWonItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '送料の計算に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 支払通知書DL
  const handleDownloadPaymentNotice = async (sellerId: number) => {
    try {
      const res = await axios.get(`/api/admin/auctions/${auctionId}/sellers/${sellerId}/payment-notice`, { responseType: 'blob' });
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const text = await (res.data as Blob).text();
        let msg = '支払通知書のダウンロードに失敗しました';
        try { msg = JSON.parse(text).message || msg; } catch {}
        setSnackbar({ open: true, message: msg, severity: 'error' });
        return;
      }
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payment_notice_auction_${auctionId}_seller_${sellerId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      let msg = '支払通知書のダウンロードに失敗しました';
      if (err?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch {}
      }
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  };

  const getPaymentStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      confirmed: { label: '入金確認済', color: '#059669', bgcolor: '#ECFDF5' },
      paid: { label: '入金済み', color: '#3B82F6', bgcolor: '#DBEAFE' },
      pending: { label: '未入金', color: '#F59E0B', bgcolor: '#FEF3C7' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return (
      <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600, fontSize: '0.7rem' }} />
    );
  };

  const getDeliveryStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      completed: { label: '配達完了', color: '#059669', bgcolor: '#ECFDF5' },
      shipped: { label: '発送済み', color: '#3B82F6', bgcolor: '#DBEAFE' },
      preparing: { label: '発送準備中', color: '#F59E0B', bgcolor: '#FEF3C7' },
      pending: { label: '入金待ち', color: '#64748B', bgcolor: '#F1F5F9' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return (
      <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600, fontSize: '0.7rem' }} />
    );
  };

  // フィルタリング（検索）
  const filteredItems = wonItems.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.item.species_name.toLowerCase().includes(query) ||
      (item.winner?.name || '').toLowerCase().includes(query) ||
      (item.tracking_number || '').includes(query)
    );
  });

  // 落札者ごとにグループ化
  const groupedByWinner = useMemo(() => {
    const map = new Map<string, { winner: WonItem['winner']; shippingAddress?: string; items: WonItem[] }>();
    filteredItems.forEach((item) => {
      const key = item.winner ? `u${item.winner.id}` : 'anonymous';
      if (!map.has(key)) {
        map.set(key, { winner: item.winner, shippingAddress: item.shipping_address, items: [] });
      }
      map.get(key)!.items.push(item);
    });
    return Array.from(map.values());
  }, [filteredItems]);

  // 商品行レンダラー（落札者単位でステータス統一のため per-row の支払い/発送/操作は不要）
  const renderItemRow = (item: WonItem, showWinner: boolean) => (
    <TableRow key={item.id} hover>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {item.item.item_number}
        </Typography>
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.item.species_name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.quantity}匹
          </Typography>
        </Box>
      </TableCell>
      {showWinner && (
        <TableCell>
          {item.winner ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: '#EFF6FF', color: '#3B82F6', fontSize: '0.75rem' }}>
                {item.winner.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.winner.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {item.winner.email}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
        </TableCell>
      )}
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ¥{formatYen(item.total_amount)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          (手数料¥{formatYen(item.commission_amount)})
        </Typography>
      </TableCell>
    </TableRow>
  );

  // リスト表示専用の行（グループ操作だが、全行にアクションを表示して任意行から操作できる）
  const renderListRow = (item: WonItem) => (
    <TableRow key={item.id} hover>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {item.item.item_number}
        </Typography>
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.item.species_name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.quantity}匹
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        {item.winner ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: '#EFF6FF', color: '#3B82F6', fontSize: '0.75rem' }}>
              {item.winner.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {item.winner.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {item.winner.email}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ¥{formatYen(item.total_amount)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          (手数料¥{formatYen(item.commission_amount)})
        </Typography>
      </TableCell>
      <TableCell align="center">{getPaymentStatusChip(item.payment_status)}</TableCell>
      <TableCell align="center">
        {getDeliveryStatusChip(item.delivery_status)}
        {item.shipped_at && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
            {new Date(item.shipped_at).toLocaleDateString('ja-JP')}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {item.tracking_number ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {item.tracking_number}
            </Typography>
            <Tooltip title="コピー">
              <IconButton size="small" onClick={() => handleCopyTrackingNumber(item.tracking_number!)}>
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            {item.shipping_company && getTrackingUrl(item.tracking_number, item.shipping_company) && (
              <Tooltip title="配送状況を確認">
                <IconButton
                  size="small"
                  component={Link}
                  href={getTrackingUrl(item.tracking_number, item.shipping_company)}
                  target="_blank"
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {!item.shipping_calculated_at && item.winner && (
            <Tooltip title="送料計算（落札者単位）">
              <IconButton
                size="small"
                sx={{ color: 'warning.main' }}
                onClick={() => handleCalculateShipping(item.winner!.id)}
                disabled={actionLoading}
              >
                <CalculateIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {item.shipping_calculated_at && item.winner && (
            <Tooltip title="送料内訳">
              <IconButton
                size="small"
                sx={{ color: 'info.main' }}
                onClick={() =>
                  handleOpenShippingDetail(filteredItems.filter((i) => i.winner?.id === item.winner!.id))
                }
              >
                <Inventory2Icon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {(item.payment_status === 'pending' || item.payment_status === 'paid') && (
            <Tooltip title="入金確認（落札者単位）">
              <IconButton
                size="small"
                sx={{ color: 'success.main' }}
                onClick={() => handleConfirmPayment(item.id)}
                disabled={actionLoading}
              >
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {item.payment_status === 'confirmed' && item.delivery_status === 'preparing' && (
            <Tooltip title="発送登録（落札者単位）">
              <IconButton
                size="small"
                sx={{ color: 'primary.main' }}
                onClick={() => handleOpenTrackingDialog(item)}
              >
                <LocalShippingIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {item.delivery_status === 'shipped' && (
            <Tooltip title="配達完了（落札者単位）">
              <IconButton
                size="small"
                sx={{ color: 'success.main' }}
                onClick={() => handleComplete(item.id)}
                disabled={actionLoading}
              >
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );

  // 落札者グループのヘッダー（ステータスチップ・伝票番号・アクションを集約）
  const renderGroupActions = (items: WonItem[]) => {
    const representative = items[0];
    const paymentStatus = representative.payment_status;
    const deliveryStatus = representative.delivery_status;
    const trackingNumber = representative.tracking_number;
    const shippingCompany = representative.shipping_company;
    const shippedAt = representative.shipped_at;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>支払い</Typography>
          {getPaymentStatusChip(paymentStatus)}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>発送</Typography>
          {getDeliveryStatusChip(deliveryStatus)}
          {shippedAt && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {new Date(shippedAt).toLocaleDateString('ja-JP')}
            </Typography>
          )}
        </Box>
        {trackingNumber && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>伝票番号</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                {trackingNumber}
              </Typography>
              <Tooltip title="コピー">
                <IconButton size="small" onClick={() => handleCopyTrackingNumber(trackingNumber)}>
                  <CopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              {shippingCompany && getTrackingUrl(trackingNumber, shippingCompany) && (
                <Tooltip title="配送状況を確認">
                  <IconButton
                    size="small"
                    component={Link}
                    href={getTrackingUrl(trackingNumber, shippingCompany)}
                    target="_blank"
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          {(paymentStatus === 'pending' || paymentStatus === 'paid') && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => handleConfirmPayment(representative.id)}
              disabled={actionLoading}
            >
              入金確認
            </Button>
          )}
          {paymentStatus === 'confirmed' && deliveryStatus === 'preparing' && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<LocalShippingIcon />}
              onClick={() => handleOpenTrackingDialog(representative)}
            >
              発送登録
            </Button>
          )}
          {deliveryStatus === 'shipped' && (
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => handleComplete(representative.id)}
              disabled={actionLoading}
            >
              配達完了
            </Button>
          )}
        </Box>
      </Box>
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
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={() => navigate('/admin/auctions')}>オークション一覧に戻る</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* アクション */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 4 }}>
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
        >
          <ToggleButton value="card" aria-label="カード表示">
            <ViewModuleIcon fontSize="small" sx={{ mr: 0.5 }} /> カード
          </ToggleButton>
          <ToggleButton value="list" aria-label="リスト表示">
            <ViewListIcon fontSize="small" sx={{ mr: 0.5 }} /> リスト
          </ToggleButton>
        </ToggleButtonGroup>
        <IconButton onClick={fetchWonItems} title="更新">
          <RefreshIcon />
        </IconButton>
        <Button variant="outlined" startIcon={<ExportIcon />}>
          CSVエクスポート
        </Button>
      </Box>

      {/* KPIカード */}
      {statistics && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, mb: 4 }}>
          <StatCard
            title="総売上"
            value={`¥${formatYen(statistics.total_sales)}`}
            subValue={`${statistics.total_items}件`}
            icon={<MoneyIcon />}
            color="#3B82F6"
          />
          <StatCard
            title="入金確認済"
            value={`¥${formatYen(statistics.paid_amount)}`}
            subValue={`${statistics.paid_count}件`}
            icon={<CheckCircleIcon />}
            color="#059669"
          />
          <StatCard
            title="未入金"
            value={`${statistics.pending_count}件`}
            subValue={`¥${formatYen(statistics.pending_amount)}`}
            icon={<ReceiptIcon />}
            color="#F59E0B"
          />
          <StatCard
            title="発送済み"
            value={`${statistics.shipped_count}件`}
            subValue={`完了: ${statistics.completed_count}件`}
            icon={<LocalShippingIcon />}
            color="#8B5CF6"
          />
          <StatCard
            title="合計送料"
            value={`¥${formatYen(statistics.total_shipping_fees ?? 0)}`}
            subValue="按分後の集計"
            icon={<Inventory2Icon />}
            color="#0EA5E9"
          />
        </Box>
      )}

      {/* フィルター */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => { setTabValue(v); setPage(0); }}>
            <Tab label={`すべて (${statistics?.total_items || 0})`} />
            <Tab label={`支払い待ち (${statistics?.pending_count || 0})`} />
            <Tab label={`発送準備中`} />
            <Tab label={`発送済み (${statistics?.shipped_count || 0})`} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="品種名、落札者名、伝票番号で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      {/* カード表示 */}
      {viewMode === 'card' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {groupedByWinner.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">落札商品がありません</Typography>
            </Card>
          ) : (
            groupedByWinner.map((group) => {
              const totalAmount = group.items.reduce((s, i) => s + Number(i.total_amount || 0), 0);
              const totalShippingFee = group.items.reduce((s, i) => s + Number(i.shipping_fee || 0), 0);
              const calculatedCount = group.items.filter((i) => i.shipping_calculated_at).length;
              const allCalculated = calculatedCount === group.items.length;
              const approvedCount = group.items.filter((i) => i.shipping_approved_at).length;
              const allApproved = approvedCount === group.items.length && group.items.length > 0;
              const hasManual = group.items.some((i) => i.calculation_mode === 'manual');
              const groupKey = group.winner ? `u${group.winner.id}` : 'anonymous';
              return (
                <Card key={groupKey}>
                  {/* 落札者ヘッダー */}
                  <Box
                    sx={{
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                      bgcolor: 'grey.50',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 260 }}>
                      {group.winner ? (
                        <>
                          <Avatar sx={{ bgcolor: '#EFF6FF', color: '#3B82F6' }}>
                            {group.winner.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {group.winner.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              {group.winner.email}
                            </Typography>
                            {group.shippingAddress && (
                              <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}
                              >
                                <LocationOnIcon sx={{ fontSize: 14 }} />
                                {group.shippingAddress}
                              </Typography>
                            )}
                          </Box>
                        </>
                      ) : (
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          落札者不明
                        </Typography>
                      )}
                    </Box>

                    {/* 集計 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>落札件数</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {group.items.length}件
                        </Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem />
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>落札合計</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          ¥{formatYen(totalAmount)}
                        </Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem />
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>送料</Typography>
                        {allCalculated ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: allApproved ? 'success.main' : 'info.main' }}>
                              ¥{formatYen(totalShippingFee)}
                            </Typography>
                            <Chip
                              size="small"
                              label={allApproved ? '承認済' : '未承認'}
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                bgcolor: allApproved ? '#ECFDF5' : '#FEF3C7',
                                color: allApproved ? '#059669' : '#B45309',
                                fontWeight: 700,
                              }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 600 }}>
                            未計算（{group.items.length - calculatedCount}件）
                          </Typography>
                        )}
                      </Box>

                      {/* アクション */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!allCalculated && group.winner && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<CalculateIcon />}
                            onClick={() => handleCalculateShipping(group.winner!.id)}
                            disabled={actionLoading}
                          >
                            送料計算
                          </Button>
                        )}
                        {calculatedCount > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            startIcon={<Inventory2Icon />}
                            onClick={() => handleOpenShippingDetail(group.items)}
                          >
                            送料内訳
                          </Button>
                        )}
                        {allCalculated && !allApproved && hasManual && group.winner && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleOpenApproveShipping(group.winner!.id, totalShippingFee)}
                            disabled={actionLoading}
                          >
                            送料入力
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* ステータス・アクション帯（落札者単位） */}
                  <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    {renderGroupActions(group.items)}
                  </Box>

                  {/* 商品テーブル */}
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>No.</TableCell>
                          <TableCell>品種名</TableCell>
                          <TableCell align="right">落札金額</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.items.map((item) => renderItemRow(item, false))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              );
            })
          )}
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="表示件数"
          />
        </Box>
      )}

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>No.</TableCell>
                  <TableCell>品種名</TableCell>
                  <TableCell>落札者</TableCell>
                  <TableCell align="right">落札金額</TableCell>
                  <TableCell align="center">支払い</TableCell>
                  <TableCell align="center">発送</TableCell>
                  <TableCell>伝票番号</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">落札商品がありません</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => renderListRow(item))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="表示件数"
          />
        </Card>
      )}

      {/* 発送登録ダイアログ */}
      <Dialog open={trackingDialogOpen} onClose={() => setTrackingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>発送登録</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                落札者: {selectedItem.winner?.name} ({selectedItem.winner?.email})
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                この落札者の同一オークション内の落札商品すべてに同じ伝票番号を登録します。
              </Typography>
              {selectedItem.shipping_address && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  配送先: {selectedItem.shipping_address}
                </Typography>
              )}
            </Box>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="配送業者"
                value={trackingForm.shipping_company}
                onChange={(e) => setTrackingForm({ ...trackingForm, shipping_company: e.target.value })}
                select
                SelectProps={{ native: true }}
              >
                <option value="ヤマト運輸">ヤマト運輸</option>
                <option value="佐川急便">佐川急便</option>
                <option value="日本郵便">日本郵便</option>
                <option value="その他">その他</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="伝票番号"
                value={trackingForm.tracking_number}
                onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })}
                placeholder="1234-5678-9012"
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDialogOpen(false)} disabled={actionLoading}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleShip}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <LocalShippingIcon />}
            disabled={actionLoading || !trackingForm.tracking_number}
          >
            発送登録
          </Button>
        </DialogActions>
      </Dialog>

      {/* 送料入力ダイアログ（「その他」種別を含む発送単位の手動確定用） */}
      <Dialog open={approveShippingOpen} onClose={() => setApproveShippingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>送料の入力</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              「その他」種別が含まれているため、送料を手動で入力してください。
              確定すると落札者に送料が開示され、請求書が発行可能になります。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
              <TextField
                fullWidth
                label="送料（円）"
                type="number"
                value={approveShippingOverride}
                onChange={(e) => {
                  setApproveShippingOverride(e.target.value);
                  if (approveShippingReason === '送料無料') setApproveShippingReason('');
                }}
                inputProps={{ min: 0 }}
                autoFocus
              />
              <Button
                variant="outlined"
                color="info"
                onClick={handleSetFreeShipping}
                sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
              >
                送料無料
              </Button>
            </Box>
            <TextField
              fullWidth
              label={Number(approveShippingOverride) === 0 ? '理由（必須）' : '理由（任意）'}
              value={approveShippingReason}
              onChange={(e) => setApproveShippingReason(e.target.value)}
              multiline
              rows={2}
              required={Number(approveShippingOverride) === 0}
              helperText="送料0円で確定する場合は理由が必須です"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveShippingOpen(false)} disabled={actionLoading}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmitApproveShipping}
            disabled={actionLoading || approveShippingOverride.trim() === ''}
          >
            {actionLoading ? <CircularProgress size={20} /> : '確定する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 送料内訳ダイアログ */}
      <Dialog open={shippingDetailOpen} onClose={() => setShippingDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>送料内訳</DialogTitle>
        <DialogContent>
          {shippingDetailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : shippingDetail ? (
            <Box>
              {/* サマリ */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                {shippingDetail.winnerName && (
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    落札者: {shippingDetail.winnerName}
                    {shippingDetail.winnerEmail && (
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                        ({shippingDetail.winnerEmail})
                      </Typography>
                    )}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  対象: {shippingDetail.itemCount}品 / 合計{shippingDetail.totalQuantity}匹
                </Typography>
                {shippingDetail.calculatedAt && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    計算日時: {new Date(shippingDetail.calculatedAt).toLocaleString('ja-JP')}
                  </Typography>
                )}
              </Box>

              {/* 合計 */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>配送先地域</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {REGION_LABELS[shippingDetail.breakdown.destination_region] || shippingDetail.breakdown.destination_region}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>送料合計</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                    ¥{formatYen(shippingDetail.breakdown.total_shipping_fee)}
                  </Typography>
                </Grid>
              </Grid>

              {/* 袋構成（全体） */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>袋構成（落札者合計）</Typography>
              <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {shippingDetail.breakdown.bags.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                ) : (
                  shippingDetail.breakdown.bags.map((b) => (
                    <Chip key={b.size} size="small" label={`${b.size}×${b.quantity}`} />
                  ))
                )}
              </Box>

              {/* 箱ごとの内訳 */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>箱ごとの内訳</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>箱サイズ</TableCell>
                      <TableCell>袋構成</TableCell>
                      <TableCell align="right">配送料</TableCell>
                      <TableCell align="right">梱包資材費</TableCell>
                      <TableCell align="right">小計</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shippingDetail.breakdown.boxes.map((box, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{box.box_size}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {box.bags.map((b, i) => (
                              <Chip key={i} size="small" label={b} variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell align="right">¥{formatYen(box.shipping_cost)}</TableCell>
                        <TableCell align="right">¥{formatYen(box.packing_material_cost)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ¥{formatYen(box.shipping_cost + box.packing_material_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} sx={{ fontWeight: 600 }}>合計</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ¥{formatYen(shippingDetail.breakdown.shipping_cost)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ¥{formatYen(shippingDetail.breakdown.packing_material_cost)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ¥{formatYen(shippingDetail.breakdown.total_shipping_fee)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Alert severity="info" sx={{ mt: 2 }}>
                同一落札者×同一オークションの全落札品をまとめて計算した内訳です。
              </Alert>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShippingDetailOpen(false)}>閉じる</Button>
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
