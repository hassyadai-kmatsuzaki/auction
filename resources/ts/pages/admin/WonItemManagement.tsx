import React, { useState } from 'react';
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
} from '@mui/icons-material';

// Mock データ
const wonItems = [
  {
    id: 1,
    item: { item_number: 1, species_name: '幹之メダカ フルボディ', quantity: 5 },
    seller: { id: 1, name: '田中養魚場' },
    winner: { id: 1, name: '山田一郎', nickname: 'やまちゃん', email: 'yamada@example.com', phone: '090-1111-2222' },
    winning_price: 12000,
    buyer_fee: 600,
    total_amount: 12600,
    payment_status: 'paid',
    delivery_status: 'shipped',
    tracking_number: '1234-5678-9012',
    shipping_company: 'ヤマト運輸',
    paid_at: '2025-11-13T10:30:00Z',
    shipped_at: '2025-11-14T14:00:00Z',
  },
  {
    id: 2,
    item: { item_number: 2, species_name: '紅白ラメ', quantity: 3 },
    seller: { id: 1, name: '田中養魚場' },
    winner: { id: 2, name: '伊藤美穂', nickname: 'メダカ好き美穂', email: 'ito@example.com', phone: '090-2222-3333' },
    winning_price: 35000,
    buyer_fee: 1750,
    total_amount: 36750,
    payment_status: 'paid',
    delivery_status: 'pending',
    tracking_number: '',
    shipping_company: '',
    paid_at: '2025-11-13T15:00:00Z',
    shipped_at: null,
  },
  {
    id: 3,
    item: { item_number: 3, species_name: 'オロチメダカ', quantity: 4 },
    seller: { id: 3, name: '鈴木メダカファーム' },
    winner: { id: 3, name: '渡辺健太', nickname: 'けんた', email: 'watanabe@example.com', phone: '090-3333-4444' },
    winning_price: 15000,
    buyer_fee: 750,
    total_amount: 15750,
    payment_status: 'pending',
    delivery_status: 'pending',
    tracking_number: '',
    shipping_company: '',
    paid_at: null,
    shipped_at: null,
  },
  {
    id: 4,
    item: { item_number: 4, species_name: '三色ラメ', quantity: 2 },
    seller: { id: 3, name: '鈴木メダカファーム' },
    winner: { id: 1, name: '山田一郎', nickname: 'やまちゃん', email: 'yamada@example.com', phone: '090-1111-2222' },
    winning_price: 42000,
    buyer_fee: 2100,
    total_amount: 44100,
    payment_status: 'paid',
    delivery_status: 'shipped',
    tracking_number: '9876-5432-1098',
    shipping_company: '佐川急便',
    paid_at: '2025-11-13T11:00:00Z',
    shipped_at: '2025-11-14T16:30:00Z',
  },
];

// KPIカード
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
  const { auctionId } = useParams();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof wonItems[0] | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_number: '', shipping_company: 'ヤマト運輸' });

  // 統計
  const totalSales = wonItems.reduce((sum, item) => sum + item.total_amount, 0);
  const paidAmount = wonItems
    .filter((item) => item.payment_status === 'paid')
    .reduce((sum, item) => sum + item.total_amount, 0);
  const shippedCount = wonItems.filter((item) => item.delivery_status === 'shipped').length;
  const pendingPaymentCount = wonItems.filter((item) => item.payment_status === 'pending').length;

  // フィルタリング
  const filteredItems = wonItems.filter((item) => {
    const matchesSearch =
      item.item.species_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.winner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tracking_number.includes(searchQuery);

    if (tabValue === 0) return matchesSearch;
    if (tabValue === 1) return matchesSearch && item.payment_status === 'pending';
    if (tabValue === 2) return matchesSearch && item.payment_status === 'paid' && item.delivery_status === 'pending';
    if (tabValue === 3) return matchesSearch && item.delivery_status === 'shipped';
    return matchesSearch;
  });

  const handleOpenTrackingDialog = (item: typeof wonItems[0]) => {
    setSelectedItem(item);
    setTrackingForm({ tracking_number: item.tracking_number || '', shipping_company: item.shipping_company || 'ヤマト運輸' });
    setTrackingDialogOpen(true);
  };

  const handleCopyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
  };

  const getPaymentStatusChip = (status: string) => {
    const config = {
      paid: { label: '入金済み', color: '#059669', bgcolor: '#ECFDF5' },
      pending: { label: '未入金', color: '#F59E0B', bgcolor: '#FEF3C7' },
    }[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };

    return (
      <Chip
        size="small"
        label={config.label}
        sx={{ bgcolor: config.bgcolor, color: config.color, fontWeight: 600, fontSize: '0.7rem' }}
      />
    );
  };

  const getDeliveryStatusChip = (status: string) => {
    const config = {
      shipped: { label: '発送済み', color: '#059669', bgcolor: '#ECFDF5' },
      pending: { label: '発送待ち', color: '#64748B', bgcolor: '#F1F5F9' },
    }[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };

    return (
      <Chip
        size="small"
        label={config.label}
        sx={{ bgcolor: config.bgcolor, color: config.color, fontWeight: 600, fontSize: '0.7rem' }}
      />
    );
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/auctions')}
          >
            戻る
          </Button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              落札者管理
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              2025年11月オークション
            </Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<ExportIcon />}>
          CSVエクスポート
        </Button>
      </Box>

      {/* KPIカード */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, mb: 4 }}>
        <StatCard
          title="総売上"
          value={`¥${totalSales.toLocaleString()}`}
          subValue={`${wonItems.length}件`}
          icon={<MoneyIcon />}
          color="#3B82F6"
        />
        <StatCard
          title="入金済み"
          value={`¥${paidAmount.toLocaleString()}`}
          subValue={`${wonItems.filter(i => i.payment_status === 'paid').length}件`}
          icon={<CheckCircleIcon />}
          color="#059669"
        />
        <StatCard
          title="未入金"
          value={`${pendingPaymentCount}件`}
          icon={<ReceiptIcon />}
          color="#F59E0B"
        />
        <StatCard
          title="発送済み"
          value={`${shippedCount}件`}
          subValue={`/ ${wonItems.length}件`}
          icon={<LocalShippingIcon />}
          color="#8B5CF6"
        />
      </Box>

      {/* フィルター */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`すべて (${wonItems.length})`} />
            <Tab label={`支払い待ち (${pendingPaymentCount})`} />
            <Tab label={`発送待ち (${wonItems.filter(i => i.payment_status === 'paid' && i.delivery_status === 'pending').length})`} />
            <Tab label={`発送済み (${shippedCount})`} />
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
                <TableCell>出品者</TableCell>
                <TableCell>落札者</TableCell>
                <TableCell align="right">落札金額</TableCell>
                <TableCell align="center">支払い</TableCell>
                <TableCell align="center">発送</TableCell>
                <TableCell>伝票番号</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
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
                        {item.item.quantity}匹
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.seller.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#EFF6FF', color: '#3B82F6', fontSize: '0.75rem' }}>
                        {item.winner.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.winner.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          @{item.winner.nickname}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ¥{item.total_amount.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      (税込 手数料¥{item.buyer_fee.toLocaleString()})
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {getPaymentStatusChip(item.payment_status)}
                    {item.paid_at && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                        {new Date(item.paid_at).toLocaleDateString('ja-JP')}
                      </Typography>
                    )}
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
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {item.tracking_number}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {item.shipping_company}
                          </Typography>
                        </Box>
                        <Tooltip title="コピー">
                          <IconButton size="small" onClick={() => handleCopyTrackingNumber(item.tracking_number)}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      {item.payment_status === 'pending' && (
                        <Tooltip title="入金確認">
                          <IconButton size="small" sx={{ color: 'success.main' }}>
                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {item.payment_status === 'paid' && (
                        <Tooltip title="伝票番号を登録">
                          <IconButton
                            size="small"
                            sx={{ color: 'primary.main' }}
                            onClick={() => handleOpenTrackingDialog(item)}
                          >
                            {item.tracking_number ? <EditIcon sx={{ fontSize: 18 }} /> : <LocalShippingIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 伝票番号登録ダイアログ */}
      <Dialog open={trackingDialogOpen} onClose={() => setTrackingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>伝票番号を登録</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {selectedItem.item.species_name} ({selectedItem.item.quantity}匹)
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                落札者: {selectedItem.winner.name} ({selectedItem.winner.email})
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
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={() => setTrackingDialogOpen(false)}
            startIcon={<LocalShippingIcon />}
          >
            登録して発送済みにする
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
