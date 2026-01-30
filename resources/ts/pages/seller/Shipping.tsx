import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  Link,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocalShipping as ShippingIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface ShippingItem {
  id: number;
  item: {
    id: number;
    item_number: number;
    species_name: string;
    quantity: number;
    thumbnail_path?: string;
  };
  auction: {
    id: number;
    title: string;
  };
  buyer: {
    id: number;
    name: string;
    address: string;
  } | null;
  price: number;
  total_amount: number;
  payment_status: string;
  delivery_status: string;
  tracking_number?: string;
  shipping_company?: string;
  sold_at: string;
  shipped_at?: string;
  delivered_at?: string;
}

interface Statistics {
  pending: number;
  shipped: number;
  delivered: number;
}

// ヤマト運輸の追跡URLを生成
const getYamatoTrackingUrl = (trackingNumber: string) => {
  return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${trackingNumber.replace(/-/g, '')}`;
};

export default function SellerShipping() {
  const [items, setItems] = useState<ShippingItem[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({ pending: 0, shipped: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShippingItem | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_number: '', shipping_company: 'ヤマト運輸' });
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // データ取得
  const fetchShippingItems = useCallback(async () => {
    try {
      const statusFilter = tabValue === 1 ? 'pending' : tabValue === 2 ? 'shipped' : tabValue === 3 ? 'delivered' : undefined;

      const response = await axios.get('/api/seller/shipping', {
        params: { status: statusFilter },
      });

      if (response.data.success) {
        setItems(response.data.data.items);
        setStatistics(response.data.data.statistics);
        setError(null);
      }
    } catch (err: any) {
      console.error('発送情報取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tabValue]);

  useEffect(() => {
    fetchShippingItems();
  }, [fetchShippingItems]);

  // 発送登録
  const handleShip = async () => {
    if (!selectedItem || !trackingForm.tracking_number) return;
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/seller/shipping/${selectedItem.id}/ship`, {
        shipping_company: trackingForm.shipping_company,
        tracking_number: trackingForm.tracking_number,
      });
      if (response.data.success) {
        setSnackbar({ open: true, message: '発送情報を登録しました', severity: 'success' });
        setTrackingDialogOpen(false);
        fetchShippingItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '発送登録に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // 伝票番号更新
  const handleUpdateTracking = async () => {
    if (!selectedItem || !trackingForm.tracking_number) return;
    setActionLoading(true);
    try {
      const response = await axios.put(`/api/seller/shipping/${selectedItem.id}/tracking`, {
        shipping_company: trackingForm.shipping_company,
        tracking_number: trackingForm.tracking_number,
      });
      if (response.data.success) {
        setSnackbar({ open: true, message: '伝票番号を更新しました', severity: 'success' });
        setTrackingDialogOpen(false);
        fetchShippingItems();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '更新に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenTrackingDialog = (item: ShippingItem) => {
    setSelectedItem(item);
    setTrackingForm({
      tracking_number: item.tracking_number || '',
      shipping_company: item.shipping_company || 'ヤマト運輸',
    });
    setTrackingDialogOpen(true);
  };

  const handleCopyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  // フィルタリング（検索）
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.item.species_name.toLowerCase().includes(query) ||
      (item.buyer?.name || '').toLowerCase().includes(query) ||
      (item.tracking_number || '').includes(query)
    );
  });

  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      pending: { label: '発送待ち', color: '#F59E0B', bgcolor: '#FEF3C7' },
      shipped: { label: '配送中', color: '#3B82F6', bgcolor: '#DBEAFE' },
      delivered: { label: '配達完了', color: '#059669', bgcolor: '#ECFDF5' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
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
        <Button onClick={fetchShippingItems}>再読み込み</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            配送状況
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            落札された商品の発送状況を管理します
          </Typography>
        </Box>
        <IconButton onClick={fetchShippingItems} title="更新">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* 統計 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>発送待ち</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>{statistics.pending}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>配送中</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#3B82F6' }}>{statistics.shipped}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>配達完了</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>{statistics.delivered}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* フィルター */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`すべて`} />
            <Tab label={`発送待ち (${statistics.pending})`} />
            <Tab label={`配送中 (${statistics.shipped})`} />
            <Tab label={`配達完了 (${statistics.delivered})`} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="品種名、買受者名、伝票番号で検索..."
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
                <TableCell>商品</TableCell>
                <TableCell>買受者・配送先</TableCell>
                <TableCell align="right">落札価格</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell>伝票番号</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">発送対象の商品がありません</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.item.species_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.auction.title} / No.{item.item.item_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.buyer?.name || '不明'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.buyer?.address || '住所未登録'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ¥{Number(item.price).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {getStatusChip(item.delivery_status)}
                    </TableCell>
                    <TableCell>
                      {item.tracking_number ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                              {item.tracking_number}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {item.shipping_company}
                            </Typography>
                          </Box>
                          <Tooltip title="コピー">
                            <IconButton size="small" onClick={() => handleCopyTrackingNumber(item.tracking_number!)}>
                              <CopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="配送状況を確認">
                            <IconButton
                              size="small"
                              component={Link}
                              href={getYamatoTrackingUrl(item.tracking_number)}
                              target="_blank"
                            >
                              <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          未登録
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {item.delivery_status === 'pending' && item.payment_status !== 'pending' && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<ShippingIcon />}
                          onClick={() => handleOpenTrackingDialog(item)}
                        >
                          発送登録
                        </Button>
                      )}
                      {item.delivery_status === 'pending' && item.payment_status === 'pending' && (
                        <Chip label="入金待ち" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706' }} />
                      )}
                      {item.delivery_status !== 'pending' && item.tracking_number && (
                        <Tooltip title="伝票番号を編集">
                          <IconButton size="small" onClick={() => handleOpenTrackingDialog(item)}>
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 伝票番号登録ダイアログ */}
      <Dialog open={trackingDialogOpen} onClose={() => setTrackingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedItem?.delivery_status === 'pending' ? '発送情報を登録' : '伝票番号を編集'}
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                {selectedItem.item.species_name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                買受者: {selectedItem.buyer?.name || '不明'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                配送先: {selectedItem.buyer?.address || '住所未登録'}
              </Typography>
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
            onClick={selectedItem?.delivery_status === 'pending' ? handleShip : handleUpdateTracking}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <ShippingIcon />}
            disabled={actionLoading || !trackingForm.tracking_number}
          >
            {selectedItem?.delivery_status === 'pending' ? '発送登録' : '更新'}
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
