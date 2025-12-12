import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Description as DescriptionIcon,
  VerifiedUser as WarrantyIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

// Mock データ - 請求書
const invoices = [
  {
    id: 1,
    invoice_number: 'INV-2025-0001',
    buyer: { id: 1, name: '山田一郎', email: 'yamada@example.com' },
    auction: '2025年11月オークション',
    items_count: 3,
    total_amount: 58500,
    status: 'paid',
    issued_at: '2025-11-12T10:00:00Z',
    paid_at: '2025-11-13T15:00:00Z',
  },
  {
    id: 2,
    invoice_number: 'INV-2025-0002',
    buyer: { id: 2, name: '伊藤美穂', email: 'ito@example.com' },
    auction: '2025年11月オークション',
    items_count: 2,
    total_amount: 42000,
    status: 'pending',
    issued_at: '2025-11-12T10:00:00Z',
    paid_at: null,
  },
  {
    id: 3,
    invoice_number: 'INV-2025-0003',
    buyer: { id: 3, name: '渡辺健太', email: 'watanabe@example.com' },
    auction: '2025年11月オークション',
    items_count: 1,
    total_amount: 15750,
    status: 'overdue',
    issued_at: '2025-11-12T10:00:00Z',
    paid_at: null,
  },
];

// Mock データ - 支払通知書
const paymentNotices = [
  {
    id: 1,
    notice_number: 'PAY-2025-0001',
    seller: { id: 1, name: '田中養魚場', email: 'tanaka@example.com' },
    auction: '2025年11月オークション',
    items_count: 5,
    sales_amount: 120000,
    commission: 12000,
    net_amount: 108000,
    status: 'sent',
    issued_at: '2025-11-15T10:00:00Z',
    transfer_scheduled: '2025-11-20',
  },
  {
    id: 2,
    notice_number: 'PAY-2025-0002',
    seller: { id: 3, name: '鈴木メダカファーム', email: 'suzuki@example.com' },
    auction: '2025年11月オークション',
    items_count: 8,
    sales_amount: 185000,
    commission: 14800,
    net_amount: 170200,
    status: 'draft',
    issued_at: null,
    transfer_scheduled: '2025-11-20',
  },
];

// Mock データ - 保証書
const warranties = [
  {
    id: 1,
    warranty_number: 'WRT-2025-0001',
    item: { species_name: '紅白ラメ 3ペア', seller: '田中養魚場' },
    buyer: { name: '山田一郎' },
    type: 'breeding',
    characteristics: '固定率80%、F3世代、赤白バランス良好',
    issued_at: '2025-11-14T10:00:00Z',
    valid_until: '2025-11-28',
  },
  {
    id: 2,
    warranty_number: 'WRT-2025-0002',
    item: { species_name: '三色ラメ 2ペア', seller: '鈴木メダカファーム' },
    buyer: { name: '伊藤美穂' },
    type: 'bloodline',
    characteristics: '血統書付き、親魚写真添付',
    issued_at: '2025-11-14T10:00:00Z',
    valid_until: '2025-11-28',
  },
  {
    id: 3,
    warranty_number: 'WRT-2025-0003',
    item: { species_name: 'オリジナル品種「星空」 5匹', seller: 'メダカの佐藤' },
    buyer: { name: '渡辺健太' },
    type: 'original',
    characteristics: '自社開発品種、固定率65%、青ラメ＋体外光',
    issued_at: '2025-11-14T10:00:00Z',
    valid_until: '2025-11-28',
  },
];

export default function DocumentManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

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
      sent: { label: '送付済み', color: '#059669', bgcolor: '#ECFDF5' },
      draft: { label: '下書き', color: '#64748B', bgcolor: '#F1F5F9' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
  };

  const getWarrantyTypeChip = (type: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      breeding: { label: 'ブリード保証', color: '#3B82F6', bgcolor: '#DBEAFE' },
      bloodline: { label: '血統保証', color: '#8B5CF6', bgcolor: '#EDE9FE' },
      original: { label: '自社品種', color: '#059669', bgcolor: '#ECFDF5' },
    };
    const c = config[type] || { label: type, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
  };

  const handlePreview = (doc: any, type: string) => {
    setSelectedDocument({ ...doc, type });
    setPreviewOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            帳票管理
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            請求書、支払通知書、保証書の発行・管理
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<ReceiptIcon />} iconPosition="start" label={`請求書 (${invoices.length})`} />
          <Tab icon={<DescriptionIcon />} iconPosition="start" label={`支払通知書 (${paymentNotices.length})`} />
          <Tab icon={<WarrantyIcon />} iconPosition="start" label={`保証書 (${warranties.length})`} />
        </Tabs>
      </Card>

      {/* 請求書タブ */}
      {tabValue === 0 && (
        <>
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="請求書番号、買受者名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="outlined" startIcon={<FilterIcon />}>
                フィルター
              </Button>
            </Box>
          </Card>

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
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {invoice.invoice_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#EFF6FF', color: '#3B82F6' }}>
                            {invoice.buyer.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{invoice.buyer.name}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{invoice.buyer.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{invoice.auction}</TableCell>
                      <TableCell align="center">{invoice.items_count}点</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          ¥{invoice.total_amount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{getInvoiceStatusChip(invoice.status)}</TableCell>
                      <TableCell>{new Date(invoice.issued_at).toLocaleDateString('ja-JP')}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="プレビュー">
                          <IconButton size="small" onClick={() => handlePreview(invoice, 'invoice')}>
                            <ViewIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ダウンロード">
                          <IconButton size="small">
                            <DownloadIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="メール送信">
                          <IconButton size="small">
                            <EmailIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* 支払通知書タブ */}
      {tabValue === 1 && (
        <>
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="通知書番号、出品者名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" startIcon={<DescriptionIcon />}>
                一括発行
              </Button>
            </Box>
          </Card>

          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>通知書番号</TableCell>
                    <TableCell>出品者</TableCell>
                    <TableCell>オークション</TableCell>
                    <TableCell align="center">落札点数</TableCell>
                    <TableCell align="right">売上金額</TableCell>
                    <TableCell align="right">手数料</TableCell>
                    <TableCell align="right">振込金額</TableCell>
                    <TableCell align="center">ステータス</TableCell>
                    <TableCell>振込予定日</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentNotices.map((notice) => (
                    <TableRow key={notice.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {notice.notice_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#F0FDF4', color: '#059669' }}>
                            {notice.seller.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{notice.seller.name}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{notice.seller.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{notice.auction}</TableCell>
                      <TableCell align="center">{notice.items_count}点</TableCell>
                      <TableCell align="right">¥{notice.sales_amount.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>
                        -¥{notice.commission.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#059669' }}>
                          ¥{notice.net_amount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{getPaymentStatusChip(notice.status)}</TableCell>
                      <TableCell>{notice.transfer_scheduled}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="プレビュー">
                          <IconButton size="small" onClick={() => handlePreview(notice, 'payment')}>
                            <ViewIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ダウンロード">
                          <IconButton size="small">
                            <DownloadIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        {notice.status === 'draft' && (
                          <Tooltip title="送信">
                            <IconButton size="small" color="primary">
                              <EmailIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* 保証書タブ */}
      {tabValue === 2 && (
        <>
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="保証書番号、品種名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" startIcon={<WarrantyIcon />}>
                保証書発行
              </Button>
            </Box>
          </Card>

          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>保証書番号</TableCell>
                    <TableCell>商品</TableCell>
                    <TableCell>出品者</TableCell>
                    <TableCell>買受者</TableCell>
                    <TableCell align="center">保証種別</TableCell>
                    <TableCell>特徴・固定率</TableCell>
                    <TableCell>有効期限</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {warranties.map((warranty) => (
                    <TableRow key={warranty.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {warranty.warranty_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {warranty.item.species_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{warranty.item.seller}</TableCell>
                      <TableCell>{warranty.buyer.name}</TableCell>
                      <TableCell align="center">{getWarrantyTypeChip(warranty.type)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {warranty.characteristics}
                        </Typography>
                      </TableCell>
                      <TableCell>{warranty.valid_until}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="プレビュー">
                          <IconButton size="small" onClick={() => handlePreview(warranty, 'warranty')}>
                            <ViewIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ダウンロード">
                          <IconButton size="small">
                            <DownloadIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="印刷">
                          <IconButton size="small">
                            <PrintIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* プレビューダイアログ */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedDocument?.type === 'invoice' && '請求書プレビュー'}
          {selectedDocument?.type === 'payment' && '支払通知書プレビュー'}
          {selectedDocument?.type === 'warranty' && '保証書プレビュー'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ p: 3, bgcolor: 'grey.50', borderRadius: 2, minHeight: 400 }}>
            {selectedDocument?.type === 'invoice' && (
              <Box>
                <Typography variant="h5" align="center" sx={{ mb: 3 }}>請 求 書</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">請求書番号: {selectedDocument.invoice_number}</Typography>
                    <Typography variant="body2">発行日: {new Date(selectedDocument.issued_at).toLocaleDateString('ja-JP')}</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2">株式会社メダカオークション</Typography>
                    <Typography variant="body2">東京都渋谷区xxx 1-2-3</Typography>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>{selectedDocument.buyer.name} 様</Typography>
                <Typography variant="body2" sx={{ mb: 3 }}>{selectedDocument.auction}</Typography>
                <Typography variant="h4" sx={{ textAlign: 'center', my: 3 }}>
                  ご請求金額: ¥{selectedDocument.total_amount.toLocaleString()}
                </Typography>
              </Box>
            )}
            {selectedDocument?.type === 'warranty' && (
              <Box>
                <Typography variant="h5" align="center" sx={{ mb: 3 }}>保 証 書</Typography>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  {getWarrantyTypeChip(selectedDocument.type)}
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>商品名:</strong> {selectedDocument.item.species_name}</Typography>
                    <Typography variant="body2"><strong>出品者:</strong> {selectedDocument.item.seller}</Typography>
                    <Typography variant="body2"><strong>購入者:</strong> {selectedDocument.buyer.name}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>特徴・固定率:</strong></Typography>
                    <Typography variant="body1" sx={{ mt: 1, p: 2, bgcolor: 'white', borderRadius: 1 }}>
                      {selectedDocument.characteristics}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2"><strong>有効期限:</strong> {selectedDocument.valid_until}まで</Typography>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />}>PDF出力</Button>
          <Button variant="contained" startIcon={<EmailIcon />}>メール送信</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

