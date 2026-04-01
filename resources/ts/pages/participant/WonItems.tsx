import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  Button,
  TextField,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Link,
  Tooltip,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  LocalShipping as LocalShippingIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface WonItemData {
  id: number;
  item: {
    id: number;
    item_number: number;
    species_name: string;
    quantity: number;
    thumbnail_path?: string;
    inspection_info?: string;
    individual_info?: string;
    auction?: {
      id: number;
      title: string;
      event_date: string;
    } | null;
  } | null;
  winning_price: number;
  quantity: number;
  total_amount: number;
  commission_amount: number;
  shipping_fee: number;
  payment_status: 'pending' | 'paid' | 'confirmed' | 'refunded';
  payment_deadline?: string;
  delivery_status: 'pending' | 'preparing' | 'shipped' | 'completed' | 'cancelled';
  delivery_method: 'shipping' | 'pickup';
  shipping_address?: string;
  tracking_number?: string;
  shipping_company?: string;
  shipped_at?: string;
  created_at: string;
}

interface Summary {
  total_amount: number;
  pending_amount: number;
  paid_amount: number;
  item_count: number;
}

// ヤマト運輸の追跡URLを生成
const getTrackingUrl = (trackingNumber: string, company: string) => {
  const cleanNumber = trackingNumber.replace(/-/g, '');
  switch (company) {
    case 'ヤマト運輸':
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${cleanNumber}`;
    case '佐川急便':
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${cleanNumber}`;
    case '日本郵便':
      return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${cleanNumber}`;
    default:
      return '';
  }
};

// タブ定義
type FilterTab = 'all' | 'payment_pending' | 'shipping_pending' | 'shipped' | 'completed';

interface DefaultAddress {
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string;
  name: string;
  phone: string;
}

export default function WonItems() {
  const [wonItems, setWonItems] = useState<WonItemData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [defaultAddress, setDefaultAddress] = useState<DefaultAddress | null>(null);
  
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WonItemData | null>(null);
  const [addressForm, setAddressForm] = useState({
    shipping_postal_code: '',
    shipping_prefecture: '',
    shipping_city: '',
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_name: '',
    shipping_phone: '',
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  
  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WonItemData | null>(null);
  
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    fetchWonItems();
    fetchDefaultAddress();
  }, []);

  const fetchWonItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/participant/won-items');
      if (response.data.success) {
        setWonItems(response.data.data.won_items);
        setSummary(response.data.data.summary);
      }
    } catch (err: any) {
      setError('落札商品の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultAddress = async () => {
    try {
      const response = await axios.get('/api/participant/settings');
      if (response.data.success) {
        const p = response.data.data.profile;
        if (p.postal_code && p.prefecture && p.city && p.address_line1) {
          setDefaultAddress({
            postal_code: p.postal_code || '',
            prefecture: p.prefecture || '',
            city: p.city || '',
            address_line1: p.address_line1 || '',
            address_line2: p.address_line2 || '',
            name: p.name || '',
            phone: p.phone || '',
          });
        }
      }
    } catch {
      // サイレント
    }
  };

  // タブフィルタ
  const getFilteredItems = () => {
    switch (activeTab) {
      case 'payment_pending':
        return wonItems.filter(i => i.payment_status === 'pending');
      case 'shipping_pending':
        return wonItems.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status));
      case 'shipped':
        return wonItems.filter(i => i.delivery_status === 'shipped');
      case 'completed':
        return wonItems.filter(i => i.delivery_status === 'completed');
      default:
        return wonItems;
    }
  };

  const getTabCounts = () => ({
    all: wonItems.length,
    payment_pending: wonItems.filter(i => i.payment_status === 'pending').length,
    shipping_pending: wonItems.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status)).length,
    shipped: wonItems.filter(i => i.delivery_status === 'shipped').length,
    completed: wonItems.filter(i => i.delivery_status === 'completed').length,
  });

  const filteredItems = getFilteredItems();
  const tabCounts = getTabCounts();

  const handleEditAddress = async (item: WonItemData) => {
    try {
      // 詳細を取得して住所情報を設定
      const response = await axios.get(`/api/participant/won-items/${item.id}`);
      if (response.data.success) {
        const detail = response.data.data.won_item;
        // 既に配送先が設定されていればそれを使う、なければデフォルト配送先を使う
        const hasExisting = detail.shipping_postal_code;
        if (hasExisting) {
          setAddressForm({
            shipping_postal_code: detail.shipping_postal_code || '',
            shipping_prefecture: detail.shipping_prefecture || '',
            shipping_city: detail.shipping_city || '',
            shipping_address_line1: detail.shipping_address_line1 || '',
            shipping_address_line2: detail.shipping_address_line2 || '',
            shipping_name: detail.shipping_name || '',
            shipping_phone: detail.shipping_phone || '',
          });
        } else if (defaultAddress) {
          setAddressForm({
            shipping_postal_code: defaultAddress.postal_code,
            shipping_prefecture: defaultAddress.prefecture,
            shipping_city: defaultAddress.city,
            shipping_address_line1: defaultAddress.address_line1,
            shipping_address_line2: defaultAddress.address_line2,
            shipping_name: defaultAddress.name,
            shipping_phone: defaultAddress.phone,
          });
        } else {
          setAddressForm({
            shipping_postal_code: '',
            shipping_prefecture: '',
            shipping_city: '',
            shipping_address_line1: '',
            shipping_address_line2: '',
            shipping_name: '',
            shipping_phone: '',
          });
        }
        setEditingItem(item);
        setEditAddressOpen(true);
      }
    } catch {
      setSnackbar({
        open: true,
        message: '情報の取得に失敗しました',
        severity: 'error',
      });
    }
  };

  const handleSaveAddress = async () => {
    if (!editingItem) return;
    
    setSaving(true);
    setAddressErrors({});
    
    try {
      const response = await axios.put(`/api/participant/won-items/${editingItem.id}/address`, addressForm);
      if (response.data.success) {
        const fee = response.data.data?.shipping_fee;
        setSnackbar({
          open: true,
          message: fee ? `配送先を更新しました（配送料金: ¥${Number(fee).toLocaleString()}）` : '配送先を更新しました',
          severity: 'success',
        });
        setEditAddressOpen(false);
        setEditingItem(null);
        await fetchWonItems();
      }
    } catch (err: any) {
      console.error('住所更新エラー:', err);
      if (err.response?.data?.errors) {
        setAddressErrors(err.response.data.errors);
      } else {
        setSnackbar({
          open: true,
          message: err.response?.data?.message || '更新に失敗しました',
          severity: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTrackingDetail = (item: WonItemData) => {
    setSelectedItem(item);
    setTrackingDetailOpen(true);
  };

  const handleCopyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
    setSnackbar({
      open: true,
      message: 'コピーしました',
      severity: 'success',
    });
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '支払い待ち';
      case 'paid': return '入金済み';
      case 'confirmed': return '入金確認済み';
      case 'refunded': return '返金済み';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { color: '#F59E0B', bgcolor: '#FEF3C7' };
      case 'paid':
      case 'confirmed': return { color: '#059669', bgcolor: '#ECFDF5' };
      case 'refunded': return { color: '#DC2626', bgcolor: '#FEF2F2' };
      default: return { color: '#64748B', bgcolor: '#F1F5F9' };
    }
  };

  const getDeliveryStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '発送待ち';
      case 'preparing': return '発送準備中';
      case 'shipped': return '配送中';
      case 'completed': return '配達完了';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getDeliveryStepIndex = (status: string) => {
    switch (status) {
      case 'pending':
      case 'preparing': return 0;
      case 'shipped': return 1;
      case 'completed': return 2;
      default: return 0;
    }
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        落札管理
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        落札した商品の支払い状況と配送状況を確認できます
      </Typography>

      {/* サマリー */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                合計落札金額
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                ¥{summary.total_amount.toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2.5, bgcolor: '#ECFDF5' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                入金確認済み
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>
                ¥{summary.paid_amount.toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2.5, bgcolor: '#FEF3C7' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                支払い待ち
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                ¥{summary.pending_amount.toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* タブフィルター */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`すべて (${tabCounts.all})`} value="all" />
          <Tab label={`支払い待ち (${tabCounts.payment_pending})`} value="payment_pending" />
          <Tab label={`発送待ち (${tabCounts.shipping_pending})`} value="shipping_pending" />
          <Tab label={`配送中 (${tabCounts.shipped})`} value="shipped" />
          <Tab label={`配達完了 (${tabCounts.completed})`} value="completed" />
        </Tabs>
      </Paper>

      {/* 落札商品一覧 */}
      {filteredItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {activeTab === 'all' ? '落札した商品はまだありません。' : '該当する商品はありません。'}
          </Typography>
        </Paper>
      ) : (
        filteredItems.map((wonItem) => (
          <Card key={wonItem.id} sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={3}>
                  <CardMedia
                    component="img"
                    image={wonItem.item?.thumbnail_path || '/img/noimage.png'}
                    alt={wonItem.item?.species_name || '商品'}
                    sx={{ borderRadius: 2, aspectRatio: '3/2', objectFit: 'cover', width: '100%' }}
                  />
                </Grid>
                <Grid item xs={12} sm={9}>
                  {/* ヘッダー */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      No.{wonItem.item?.item_number ?? '-'}
                    </Typography>
                    <Chip
                      label={getPaymentStatusLabel(wonItem.payment_status)}
                      size="small"
                      sx={{ ...getPaymentStatusColor(wonItem.payment_status), fontWeight: 600, fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={getDeliveryStatusLabel(wonItem.delivery_status)}
                      size="small"
                      sx={{ bgcolor: '#DBEAFE', color: '#3B82F6', fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {wonItem.item?.species_name || '（削除された商品）'}
                  </Typography>

                  {/* オークション情報 */}
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {wonItem.item?.auction ? `${wonItem.item.auction.title} (${wonItem.item.auction.event_date})` : ''}
                  </Typography>

                  {/* 金額情報 */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        落札単価: ¥{Number(wonItem.winning_price).toLocaleString()} × {wonItem.quantity}匹
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        手数料: ¥{Number(wonItem.commission_amount).toLocaleString()}
                      </Typography>
                      {wonItem.shipping_fee > 0 && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          配送料金: ¥{Number(wonItem.shipping_fee).toLocaleString()}
                        </Typography>
                      )}
                      <Typography variant="h6" sx={{ color: '#059669', fontWeight: 700, mt: 0.5 }}>
                        合計: ¥{(Number(wonItem.total_amount) + Number(wonItem.shipping_fee)).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      {wonItem.payment_deadline && wonItem.payment_status === 'pending' && (
                        <Typography variant="body2" sx={{ color: 'error.main' }}>
                          支払期限: {new Date(wonItem.payment_deadline).toLocaleDateString('ja-JP')}
                        </Typography>
                      )}
                      {wonItem.shipped_at && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          発送日: {new Date(wonItem.shipped_at).toLocaleDateString('ja-JP')}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>

                  {/* 配送情報 */}
                  {wonItem.tracking_number && (
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          配送情報
                        </Typography>
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          onClick={() => handleOpenTrackingDetail(wonItem)}
                        >
                          詳細を見る
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                        <Typography variant="body2">
                          {wonItem.shipping_company}: 
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {wonItem.tracking_number}
                        </Typography>
                        <Tooltip title="コピー">
                          <IconButton size="small" onClick={() => handleCopyTrackingNumber(wonItem.tracking_number!)}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        {wonItem.shipping_company && (
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<OpenInNewIcon />}
                            component={Link}
                            href={getTrackingUrl(wonItem.tracking_number, wonItem.shipping_company)}
                            target="_blank"
                          >
                            配送状況を確認
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* 配送先 */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      配送先
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {wonItem.shipping_address || '未設定'}
                      </Typography>
                      {wonItem.payment_status === 'pending' && (
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditAddress(wonItem)}
                        >
                          {wonItem.shipping_address ? '変更' : '設定'}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* アクションボタン */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={async () => {
                        try {
                          const res = await axios.get(`/api/participant/won-items/${wonItem.id}/invoice`, { responseType: 'blob' });
                          const url = window.URL.createObjectURL(new Blob([res.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `invoice_${wonItem.id}.pdf`);
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch {
                          setSnackbar({ open: true, message: '請求書のダウンロードに失敗しました', severity: 'error' });
                        }
                      }}
                    >
                      請求書
                    </Button>
                    {['paid', 'confirmed'].includes(wonItem.payment_status) && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="success"
                        startIcon={<DownloadIcon />}
                        onClick={async () => {
                          try {
                            const res = await axios.get(`/api/participant/won-items/${wonItem.id}/receipt`, { responseType: 'blob' });
                            const url = window.URL.createObjectURL(new Blob([res.data]));
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `receipt_${wonItem.id}.pdf`);
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                          } catch {
                            setSnackbar({ open: true, message: '領収書のダウンロードに失敗しました', severity: 'error' });
                          }
                        }}
                      >
                        領収書
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))
      )}

      {/* 配送先編集ダイアログ */}
      <Dialog open={editAddressOpen} onClose={() => setEditAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送先住所の変更</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            ※ 入金確認前のみ変更可能です
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="郵便番号"
                value={addressForm.shipping_postal_code}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_postal_code: e.target.value })}
                placeholder="123-4567"
                error={!!addressErrors.shipping_postal_code}
                helperText={addressErrors.shipping_postal_code?.[0]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="都道府県"
                value={addressForm.shipping_prefecture}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_prefecture: e.target.value })}
                error={!!addressErrors.shipping_prefecture}
                helperText={addressErrors.shipping_prefecture?.[0]}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="市区町村"
                value={addressForm.shipping_city}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_city: e.target.value })}
                error={!!addressErrors.shipping_city}
                helperText={addressErrors.shipping_city?.[0]}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="番地"
                value={addressForm.shipping_address_line1}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_address_line1: e.target.value })}
                error={!!addressErrors.shipping_address_line1}
                helperText={addressErrors.shipping_address_line1?.[0]}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="建物名・部屋番号（任意）"
                value={addressForm.shipping_address_line2}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_address_line2: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="受取人氏名"
                value={addressForm.shipping_name}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_name: e.target.value })}
                error={!!addressErrors.shipping_name}
                helperText={addressErrors.shipping_name?.[0]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="電話番号"
                value={addressForm.shipping_phone}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_phone: e.target.value })}
                error={!!addressErrors.shipping_phone}
                helperText={addressErrors.shipping_phone?.[0]}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAddressOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSaveAddress} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={24} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 配送詳細ダイアログ */}
      <Dialog open={trackingDetailOpen} onClose={() => setTrackingDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送状況詳細</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedItem.item?.species_name || '（削除された商品）'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {selectedItem.item?.auction?.title || ''}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* 配送ステップ */}
              <Stepper activeStep={getDeliveryStepIndex(selectedItem.delivery_status)} sx={{ mb: 3 }}>
                <Step>
                  <StepLabel>発送準備中</StepLabel>
                </Step>
                <Step>
                  <StepLabel>配送中</StepLabel>
                </Step>
                <Step>
                  <StepLabel>配達完了</StepLabel>
                </Step>
              </Stepper>

              {selectedItem.tracking_number && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>伝票番号</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                      {selectedItem.tracking_number}
                    </Typography>
                    <IconButton size="small" onClick={() => handleCopyTrackingNumber(selectedItem.tracking_number!)}>
                      <CopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {selectedItem.shipping_company}
                  </Typography>
                </Box>
              )}

              {selectedItem.tracking_number && selectedItem.shipping_company && (
                <Button
                  fullWidth
                  variant="contained"
                  endIcon={<OpenInNewIcon />}
                  component={Link}
                  href={getTrackingUrl(selectedItem.tracking_number, selectedItem.shipping_company)}
                  target="_blank"
                >
                  {selectedItem.shipping_company}の配送状況ページを開く
                </Button>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDetailOpen(false)}>閉じる</Button>
        </DialogActions>
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
    </Container>
  );
}
