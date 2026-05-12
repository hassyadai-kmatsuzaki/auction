import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
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
  TextField,
  InputAdornment,
  Avatar,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Description as DescriptionIcon,
  LocalShipping as DeliveryIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  adminDocumentApi,
  InvoiceRow,
  PaymentNoticeRow,
  DeliveryNoteRow,
} from '@/api/admin/documentApi';
import { formatYen } from '@/lib/formatPrice';

export default function DocumentManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [paymentNotices, setPaymentNotices] = useState<PaymentNoticeRow[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [inv, pay, dlv] = await Promise.all([
          adminDocumentApi.getInvoices(),
          adminDocumentApi.getPaymentNotices(),
          adminDocumentApi.getDeliveryNotes(),
        ]);
        setInvoices(inv);
        setPaymentNotices(pay);
        setDeliveryNotes(dlv);
      } catch (e: any) {
        setErrorMessage(e?.response?.data?.message ?? '帳票データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.buyer.name.toLowerCase().includes(q) ||
        i.auction.toLowerCase().includes(q),
    );
  }, [invoices, searchQuery]);

  const filteredPaymentNotices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return paymentNotices;
    return paymentNotices.filter(
      (p) =>
        p.notice_number.toLowerCase().includes(q) ||
        p.seller.name.toLowerCase().includes(q) ||
        p.auction.toLowerCase().includes(q),
    );
  }, [paymentNotices, searchQuery]);

  const filteredDeliveryNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deliveryNotes;
    return deliveryNotes.filter(
      (d) =>
        d.delivery_note_number.toLowerCase().includes(q) ||
        d.buyer.name.toLowerCase().includes(q) ||
        d.auction.toLowerCase().includes(q),
    );
  }, [deliveryNotes, searchQuery]);

  const handleDownload = async (key: string, fn: () => Promise<void>) => {
    setDownloadingKey(key);
    try {
      await fn();
    } catch (e: any) {
      setErrorMessage(e?.response?.data?.message ?? 'PDFのダウンロードに失敗しました');
    } finally {
      setDownloadingKey(null);
    }
  };

  const getInvoiceStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      paid: { label: '入金済み', color: '#059669', bgcolor: '#ECFDF5' },
      pending: { label: '未入金', color: '#F59E0B', bgcolor: '#FEF3C7' },
      overdue: { label: '期限超過', color: '#DC2626', bgcolor: '#FEF2F2' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
  };

  const getPaymentStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      sent: { label: '発行可', color: '#059669', bgcolor: '#ECFDF5' },
      draft: { label: '未確定', color: '#64748B', bgcolor: '#F1F5F9' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('ja-JP') : '-';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            帳票管理
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            請求書、支払通知書、納品書の発行・ダウンロード
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<ReceiptIcon />} iconPosition="start" label={`請求書 (${invoices.length})`} />
          <Tab icon={<DescriptionIcon />} iconPosition="start" label={`支払通知書 (${paymentNotices.length})`} />
          <Tab icon={<DeliveryIcon />} iconPosition="start" label={`納品書 (${deliveryNotes.length})`} />
        </Tabs>
      </Card>

      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="番号、名前、オークション名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 360 }}
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

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && tabValue === 0 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>請求書番号</TableCell>
                  <TableCell>買受者</TableCell>
                  <TableCell>オークション</TableCell>
                  <TableCell align="center">点数</TableCell>
                  <TableCell align="right">請求金額</TableCell>
                  <TableCell align="center">ステータス</TableCell>
                  <TableCell>発行日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInvoices.map((row) => {
                  const key = `inv-${row.auction_id}-${row.winner_id}`;
                  return (
                    <TableRow key={key} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {row.invoice_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#EFF6FF', color: '#3B82F6' }}>
                            {row.buyer.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.buyer.name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                                #{row.buyer.id}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.buyer.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{row.auction}</TableCell>
                      <TableCell align="center">{row.items_count}点</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          ¥{formatYen(row.total_amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{getInvoiceStatusChip(row.status)}</TableCell>
                      <TableCell>{formatDate(row.issued_at)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="PDFダウンロード">
                          <span>
                            <IconButton
                              size="small"
                              disabled={downloadingKey === key}
                              onClick={() =>
                                handleDownload(key, () =>
                                  adminDocumentApi.downloadInvoice(row.auction_id, row.winner_id),
                                )
                              }
                            >
                              {downloadingKey === key ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DownloadIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      データがありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {!loading && tabValue === 1 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>通知書番号</TableCell>
                  <TableCell>出品者</TableCell>
                  <TableCell>オークション</TableCell>
                  <TableCell align="center">落札点数</TableCell>
                  <TableCell align="right">売上金額（税込）</TableCell>
                  <TableCell align="right">手数料（税込）</TableCell>
                  <TableCell align="right">振込金額（税込）</TableCell>
                  <TableCell align="center">ステータス</TableCell>
                  <TableCell>振込予定日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPaymentNotices.map((row) => {
                  const key = `pay-${row.auction_id}-${row.seller_id}`;
                  return (
                    <TableRow key={key} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {row.notice_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#F0FDF4', color: '#059669' }}>
                            {row.seller.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.seller.name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                                #{row.seller.id}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.seller.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{row.auction}</TableCell>
                      <TableCell align="center">{row.items_count}点</TableCell>
                      <TableCell align="right">¥{formatYen(row.sales_amount)}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>
                        -¥{formatYen(row.commission)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#059669' }}>
                          ¥{formatYen(row.net_amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{getPaymentStatusChip(row.status)}</TableCell>
                      <TableCell>{row.transfer_scheduled ?? '-'}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="PDFダウンロード">
                          <span>
                            <IconButton
                              size="small"
                              disabled={downloadingKey === key}
                              onClick={() =>
                                handleDownload(key, () =>
                                  adminDocumentApi.downloadPaymentNotice(row.auction_id, row.seller_id),
                                )
                              }
                            >
                              {downloadingKey === key ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DownloadIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPaymentNotices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      データがありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {!loading && tabValue === 2 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>納品書番号</TableCell>
                  <TableCell>買受者</TableCell>
                  <TableCell>オークション</TableCell>
                  <TableCell align="center">点数</TableCell>
                  <TableCell align="center">合計数量</TableCell>
                  <TableCell>発送日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDeliveryNotes.map((row) => {
                  const key = `dlv-${row.auction_id}-${row.winner_id}`;
                  return (
                    <TableRow key={key} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {row.delivery_note_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#ECFDF5', color: '#059669' }}>
                            {row.buyer.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.buyer.name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                                #{row.buyer.id}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.buyer.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{row.auction}</TableCell>
                      <TableCell align="center">{row.items_count}点</TableCell>
                      <TableCell align="center">{row.total_quantity}匹</TableCell>
                      <TableCell>{formatDate(row.shipped_at)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="PDFダウンロード">
                          <span>
                            <IconButton
                              size="small"
                              disabled={downloadingKey === key}
                              onClick={() =>
                                handleDownload(key, () =>
                                  adminDocumentApi.downloadDeliveryNote(row.auction_id, row.winner_id),
                                )
                              }
                            >
                              {downloadingKey === key ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DownloadIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredDeliveryNotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      データがありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={4000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
