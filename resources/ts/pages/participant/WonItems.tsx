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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  LocalShipping as LocalShippingIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Event as EventIcon,
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

interface AuctionGroup {
  auction: {
    id: number;
    title: string;
    event_date: string;
  } | null;
  summary: {
    item_count: number;
    total_amount: number;
    shipping_fee: number;
    grand_total: number;
    all_paid: boolean;
    any_pending: boolean;
  };
  won_items: WonItemData[];
}

interface Summary {
  total_amount: number;
  pending_amount: number;
  paid_amount: number;
  shipping_fee: number;
  item_count: number;
  auction_count: number;
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

// PDFダウンロードヘルパー
const downloadPdf = async (url: string, filename: string): Promise<string | null> => {
  const res = await axios.get(url, { responseType: 'blob' });
  const contentType = res.headers['content-type'] || '';
  if (!contentType.includes('application/pdf')) {
    const text = await (res.data as Blob).text();
    try { return JSON.parse(text).message; } catch { return null; }
  }
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
  return null;
};

export default function WonItems() {
  const [auctionGroups, setAuctionGroups] = useState<AuctionGroup[]>([]);
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
        setAuctionGroups(response.data.data.auctions);
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

  // 全WonItemをフラット化してフィルタリング
  const allItems = auctionGroups.flatMap(g => g.won_items);

  const getFilteredAuctionGroups = (): AuctionGroup[] => {
    if (activeTab === 'all') return auctionGroups;

    return auctionGroups.map(group => {
      let filtered: WonItemData[];
      switch (activeTab) {
        case 'payment_pending':
          filtered = group.won_items.filter(i => i.payment_status === 'pending');
          break;
        case 'shipping_pending':
          filtered = group.won_items.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status));
          break;
        case 'shipped':
          filtered = group.won_items.filter(i => i.delivery_status === 'shipped');
          break;
        case 'completed':
          filtered = group.won_items.filter(i => i.delivery_status === 'completed');
          break;
        default:
          filtered = group.won_items;
      }
      return { ...group, won_items: filtered };
    }).filter(g => g.won_items.length > 0);
  };

  const getTabCounts = () => ({
    all: allItems.length,
    payment_pending: allItems.filter(i => i.payment_status === 'pending').length,
    shipping_pending: allItems.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status)).length,
    shipped: allItems.filter(i => i.delivery_status === 'shipped').length,
    completed: allItems.filter(i => i.delivery_status === 'completed').length,
  });

  const filteredGroups = getFilteredAuctionGroups();
  const tabCounts = getTabCounts();

  const handleEditAddress = async (item: WonItemData) => {
    try {
      const response = await axios.get(`/api/participant/won-items/${item.id}`);
      if (response.data.success) {
        const detail = response.data.data.won_item;
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
      setSnackbar({ open: true, message: '情報の取得に失敗しました', severity: 'error' });
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
      if (err.response?.data?.errors) {
        setAddressErrors(err.response.data.errors);
      } else {
        setSnackbar({ open: true, message: err.response?.data?.message || '更新に失敗しました', severity: 'error' });
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
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  const handleDownloadInvoice = async (auctionId: number) => {
    try {
      const errMsg = await downloadPdf(
        `/api/participant/auctions/${auctionId}/invoice`,
        `invoice_auction_${auctionId}.pdf`
      );
      if (errMsg) {
        setSnackbar({ open: true, message: errMsg || '請求書のダウンロードに失敗しました', severity: 'error' });
      }
    } catch (err: any) {
      let msg = '請求書のダウンロードに失敗しました';
      if (err?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch {}
      }
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  };

  const handleDownloadReceipt = async (auctionId: number) => {
    try {
      const errMsg = await downloadPdf(
        `/api/participant/auctions/${auctionId}/receipt`,
        `receipt_auction_${auctionId}.pdf`
      );
      if (errMsg) {
        setSnackbar({ open: true, message: errMsg || '領収書のダウンロードに失敗しました', severity: 'error' });
      }
    } catch (err: any) {
      let msg = '領収書のダウンロードに失敗しました';
      if (err?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch {}
      }
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
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
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                合計落札金額
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                ¥{(summary.total_amount + summary.shipping_fee).toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {summary.auction_count}件のオークション / {summary.item_count}品
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5, bgcolor: '#ECFDF5' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                入金確認済み
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>
                ¥{summary.paid_amount.toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5, bgcolor: '#FEF3C7' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                支払い待ち
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                ¥{summary.pending_amount.toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                配送料金合計
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#64748B' }}>
                ¥{summary.shipping_fee.toLocaleString()}
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

      {/* オークション別落札商品一覧 */}
      {filteredGroups.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {activeTab === 'all' ? '落札した商品はまだありません。' : '該当する商品はありません。'}
          </Typography>
        </Paper>
      ) : (
        filteredGroups.map((group) => {
          const auctionId = group.auction?.id;
          return (
            <Accordion key={auctionId ?? 'unknown'} defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2, flexWrap: 'wrap' }}>
                  <EventIcon sx={{ color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {group.auction?.title || '不明なオークション'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {group.auction?.event_date || ''} / {group.summary.item_count}品落札
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                    ¥{group.summary.grand_total.toLocaleString()}
                  </Typography>
                  {group.summary.all_paid ? (
                    <Chip label="入金済み" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600 }} />
                  ) : group.summary.any_pending ? (
                    <Chip label="支払い待ち" size="small" sx={{ bgcolor: '#FEF3C7', color: '#F59E0B', fontWeight: 600 }} />
                  ) : null}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {/* オークション単位のアクションボタン */}
                {auctionId && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownloadInvoice(auctionId)}
                    >
                      請求書ダウンロード
                    </Button>
                    {group.summary.all_paid && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="success"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadReceipt(auctionId)}
                      >
                        領収書ダウンロード
                      </Button>
                    )}
                  </Box>
                )}

                <Divider sx={{ mb: 2 }} />

                {/* 落札商品リスト */}
                {group.won_items.map((wonItem) => (
                  <Card key={wonItem.id} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={2}>
                          <CardMedia
                            component="img"
                            image={wonItem.item?.thumbnail_path || '/img/noimage.png'}
                            alt={wonItem.item?.species_name || '商品'}
                            sx={{ borderRadius: 1, aspectRatio: '3/2', objectFit: 'cover', width: '100%' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={10}>
                          {/* ヘッダー */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
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

                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {wonItem.item?.species_name || '（削除された商品）'}
                          </Typography>

                          {/* 金額情報 */}
                          <Box sx={{ display: 'flex', gap: 3, mb: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              ¥{Number(wonItem.winning_price).toLocaleString()} × {wonItem.quantity}匹
                              = <strong>¥{Number(wonItem.total_amount).toLocaleString()}</strong>
                            </Typography>
                            {wonItem.shipping_fee > 0 && (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                配送料: ¥{Number(wonItem.shipping_fee).toLocaleString()}
                              </Typography>
                            )}
                            {wonItem.payment_deadline && wonItem.payment_status === 'pending' && (
                              <Typography variant="body2" sx={{ color: 'error.main' }}>
                                支払期限: {new Date(wonItem.payment_deadline).toLocaleDateString('ja-JP')}
                              </Typography>
                            )}
                          </Box>

                          {/* 配送情報 */}
                          {wonItem.tracking_number && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                              <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
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
                                  variant="text"
                                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                  component={Link}
                                  href={getTrackingUrl(wonItem.tracking_number, wonItem.shipping_company)}
                                  target="_blank"
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  追跡
                                </Button>
                              )}
                            </Box>
                          )}

                          {/* 配送先 */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              配送先: {wonItem.shipping_address || '未設定'}
                            </Typography>
                            {wonItem.payment_status === 'pending' && (
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => handleEditAddress(wonItem)}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {wonItem.shipping_address ? '変更' : '設定'}
                              </Button>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}

                {/* オークション合計 */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, pt: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    商品小計: ¥{group.summary.total_amount.toLocaleString()}
                  </Typography>
                  {group.summary.shipping_fee > 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      配送料合計: ¥{group.summary.shipping_fee.toLocaleString()}
                    </Typography>
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#059669' }}>
                    合計: ¥{group.summary.grand_total.toLocaleString()}
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })
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
              </Box>

              <Divider sx={{ my: 2 }} />

              <Stepper activeStep={getDeliveryStepIndex(selectedItem.delivery_status)} sx={{ mb: 3 }}>
                <Step><StepLabel>発送準備中</StepLabel></Step>
                <Step><StepLabel>配送中</StepLabel></Step>
                <Step><StepLabel>配達完了</StepLabel></Step>
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
