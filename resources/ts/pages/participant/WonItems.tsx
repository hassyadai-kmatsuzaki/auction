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
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Event as EventIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';
import ReviewDialog from '../../features/reviews/ReviewDialog';
import { optimizedImageUrl } from '../../lib/optimizedMedia';

interface WonItemData {
  id: number;
  item: {
    id: number;
    item_number: number;
    exhibit_code?: string | null;
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
    subtotal: number;
    commission_total: number;
    shipping_fee: number;
    grand_total: number;
    all_paid: boolean;
    any_pending: boolean;
  };
  shipping: {
    address: string | null;
    can_update: boolean;
    calculated: boolean;
    can_calculate: boolean;
    calculation_mode?: 'auto' | 'manual' | 'mixed' | null;
    pending_manual_approval?: boolean;
  };
  won_items: WonItemData[];
}

interface Summary {
  subtotal: number;
  commission_total: number;
  shipping_fee: number;
  grand_total: number;
  pending_amount: number;
  paid_amount: number;
  item_count: number;
  auction_count: number;
}

// 消費税率（請求書/納品書PDFと同一値）
const TAX_RATE = 10;

// PDF (invoice.blade.php / delivery_note.blade.php) と同じ計算式
// tax = floor((商品小計 + 落札手数料 + 配送料) × tax_rate / 100)
// grand_total = 商品小計 + 落札手数料 + 配送料 + tax
const computeTaxBreakdown = (subtotal: number, commission: number, shipping: number) => {
  const taxBase = subtotal + commission + shipping;
  const taxAmount = Math.floor((taxBase * TAX_RATE) / 100);
  return {
    taxAmount,
    grandTotalInclTax: taxBase + taxAmount,
  };
};

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


  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WonItemData | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ wonItemId: number; sellerName: string } | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    fetchWonItems();
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
      {summary && (() => {
        const overall = computeTaxBreakdown(summary.subtotal, summary.commission_total, summary.shipping_fee);
        const paidTax = Math.floor((summary.paid_amount * TAX_RATE) / 100);
        const pendingTax = Math.floor((summary.pending_amount * TAX_RATE) / 100);
        return (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                ご請求金額（税込）
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                ¥{formatYen(overall.grandTotalInclTax)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {summary.auction_count}件のオークション / {summary.item_count}品
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5, bgcolor: '#ECFDF5' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                入金確認済み（税込）
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>
                ¥{formatYen(summary.paid_amount + paidTax)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5, bgcolor: '#FEF3C7' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                支払い待ち（税込）
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                ¥{formatYen(summary.pending_amount + pendingTax)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                配送料金合計
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#64748B' }}>
                ¥{formatYen(summary.shipping_fee)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
        );
      })()}

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
          const { taxAmount, grandTotalInclTax } = computeTaxBreakdown(
            group.summary.subtotal,
            group.summary.commission_total,
            group.summary.shipping_fee,
          );
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
                    ¥{formatYen(grandTotalInclTax)}
                  </Typography>
                  {group.summary.all_paid ? (
                    <Chip label="入金済み" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600 }} />
                  ) : group.summary.any_pending ? (
                    <Chip label="支払い待ち" size="small" sx={{ bgcolor: '#FEF3C7', color: '#F59E0B', fontWeight: 600 }} />
                  ) : null}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {/* 配送先（オークション単位） */}
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>配送先:</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {group.shipping.address || '未設定'}
                  </Typography>
                </Box>

                {/* 「その他」種別を含むため送料が手動確定待ちの案内 */}
                {group.shipping.pending_manual_approval && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    「その他」種別の商品を含むため、送料は管理者が確認後に確定します。
                    確定しましたらメール・LINEでお知らせしますので、そのまましばらくお待ちください。
                  </Alert>
                )}

                {/* オークション単位のアクションボタン */}
                {auctionId && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* 送料計算状態 */}
                    {group.shipping.calculated && (
                      <Chip label="送料計算済み" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600 }} />
                    )}
                    {/* 「その他」種別を含む場合は管理者による手動確定待ちを明示 */}
                    {group.shipping.pending_manual_approval && (
                      <Chip
                        label="管理者の送料確定待ち"
                        size="small"
                        sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600 }}
                      />
                    )}
                    {/* 請求書（送料計算後のみ） */}
                    <Tooltip title={
                      group.shipping.pending_manual_approval
                        ? '「その他」種別の送料は管理者が確定します。確定後にダウンロードできます'
                        : !group.shipping.calculated
                          ? '送料計算後にダウンロードできます'
                          : ''
                    }>
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleDownloadInvoice(auctionId)}
                          disabled={!group.shipping.calculated}
                        >
                          請求書
                        </Button>
                      </span>
                    </Tooltip>
                    {/* 領収書（送料計算済み + 全品入金済み） */}
                    {group.summary.all_paid && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="success"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadReceipt(auctionId)}
                        disabled={!group.shipping.calculated}
                      >
                        領収書
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
                            image={optimizedImageUrl(wonItem.item?.thumbnail_path, 'small')}
                            alt={wonItem.item?.species_name || '商品'}
                            loading="lazy"
                            sx={{ borderRadius: 1, aspectRatio: '3/2', objectFit: 'cover', width: '100%' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={10}>
                          {/* ヘッダー */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {wonItem.item?.exhibit_code ?? `No.${wonItem.item?.item_number ?? '-'}`}
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
                            {wonItem.delivery_status === 'completed' && wonItem.payment_status === 'paid' && (
                              <Button
                                size="small"
                                startIcon={<StarIcon />}
                                onClick={() => setReviewTarget({
                                  wonItemId: wonItem.id,
                                  sellerName: wonItem.item?.species_name ?? '出品者',
                                })}
                                sx={{ fontSize: '0.7rem' }}
                              >
                                評価する
                              </Button>
                            )}
                          </Box>

                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {wonItem.item?.species_name || '（削除された商品）'}
                          </Typography>

                          {/* 金額情報 */}
                          <Box sx={{ display: 'flex', gap: 3, mb: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              ¥{formatYen(wonItem.winning_price)} × {wonItem.quantity}匹
                              = <strong>¥{formatYen(Number(wonItem.winning_price) * Number(wonItem.quantity))}</strong>
                            </Typography>
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

                          {/* 配送先は個別ではなくオークション単位で表示 */}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}

                {/* オークション合計（請求書/納品書PDFと同一構造） */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                  <Box sx={{ minWidth: 320, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>商品小計</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ¥{formatYen(group.summary.subtotal)}
                      </Typography>
                    </Box>
                    {group.summary.commission_total > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>落札手数料</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ¥{formatYen(group.summary.commission_total)}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>配送料</Typography>
                      {group.summary.shipping_fee > 0 ? (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ¥{formatYen(group.summary.shipping_fee)}
                        </Typography>
                      ) : group.shipping.pending_manual_approval ? (
                        <Typography variant="body2" sx={{ color: '#B45309', fontWeight: 600 }}>
                          管理者確定待ち
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>¥0</Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        消費税（{TAX_RATE}%）
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ¥{formatYen(taxAmount)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>合計金額</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                        ¥{formatYen(grandTotalInclTax)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

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

      {/* 評価ダイアログ */}
      {reviewTarget && (
        <ReviewDialog
          open={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          wonItemId={reviewTarget.wonItemId}
          targetName={reviewTarget.sellerName}
          onSubmitted={() => setSnackbar({ open: true, message: '評価を送信しました', severity: 'success' })}
        />
      )}

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
