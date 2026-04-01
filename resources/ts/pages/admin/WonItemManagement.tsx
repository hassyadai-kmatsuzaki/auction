import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
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
} from '@mui/icons-material';
import axios from '../../lib/axios';

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
  pending_count: number;
  pending_amount: number;
  paid_count: number;
  paid_amount: number;
  shipped_count: number;
  completed_count: number;
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/auctions')}>
            戻る
          </Button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              落札者管理
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {auction?.title}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchWonItems} title="更新">
            <RefreshIcon />
          </IconButton>
          <Button variant="outlined" startIcon={<ExportIcon />}>
            CSVエクスポート
          </Button>
        </Box>
      </Box>

      {/* KPIカード */}
      {statistics && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, mb: 4 }}>
          <StatCard
            title="総売上"
            value={`¥${Number(statistics.total_sales).toLocaleString()}`}
            subValue={`${statistics.total_items}件`}
            icon={<MoneyIcon />}
            color="#3B82F6"
          />
          <StatCard
            title="入金確認済"
            value={`¥${Number(statistics.paid_amount).toLocaleString()}`}
            subValue={`${statistics.paid_count}件`}
            icon={<CheckCircleIcon />}
            color="#059669"
          />
          <StatCard
            title="未入金"
            value={`${statistics.pending_count}件`}
            subValue={`¥${Number(statistics.pending_amount).toLocaleString()}`}
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

      {/* テーブル */}
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
                filteredItems.map((item) => (
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
                        ¥{Number(item.total_amount).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        (手数料¥{Number(item.commission_amount).toLocaleString()})
                      </Typography>
                      {(item.shipping_fee ?? 0) > 0 && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                          配送料¥{Number(item.shipping_fee).toLocaleString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {getPaymentStatusChip(item.payment_status)}
                    </TableCell>
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
                        {item.payment_status === 'pending' && (
                          <Tooltip title="入金確認">
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
                          <Tooltip title="発送登録">
                            <IconButton
                              size="small"
                              sx={{ color: 'primary.main' }}
                              onClick={() => handleOpenTrackingDialog(item)}
                            >
                              <LocalShippingIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {item.delivery_status === 'shipped' && item.tracking_number && item.shipping_company && (
                          <Tooltip title="配送状況を確認">
                            <IconButton
                              size="small"
                              sx={{ color: 'primary.main' }}
                              component={Link}
                              href={getTrackingUrl(item.tracking_number, item.shipping_company)}
                              target="_blank"
                            >
                              <OpenInNewIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
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
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          labelRowsPerPage="表示件数"
        />
      </Card>

      {/* 発送登録ダイアログ */}
      <Dialog open={trackingDialogOpen} onClose={() => setTrackingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>発送登録</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {selectedItem.item.species_name} ({selectedItem.quantity}匹)
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                落札者: {selectedItem.winner?.name} ({selectedItem.winner?.email})
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
