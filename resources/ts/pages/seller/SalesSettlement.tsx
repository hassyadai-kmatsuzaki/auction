import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Grid,
  Paper,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  AccountBalance as BankIcon,
  TrendingUp as TrendingUpIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  AttachMoney as MoneyIcon,
  LocalShipping as ShippingIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

// Mock データ
const settlements = [
  {
    id: 1,
    auction: '2025年11月オークション',
    auction_date: '2025-11-12',
    total_sales: 105000,
    commission: 10500,
    shipping_fee: 3000,
    packing_fee: 1500,
    net_amount: 90000,
    status: 'completed',
    paid_at: '2025-11-20',
    items_count: 3,
  },
  {
    id: 2,
    auction: '2025年10月オークション',
    auction_date: '2025-10-15',
    total_sales: 72000,
    commission: 7200,
    shipping_fee: 2000,
    packing_fee: 1000,
    net_amount: 61800,
    status: 'completed',
    paid_at: '2025-10-22',
    items_count: 2,
  },
  {
    id: 3,
    auction: '2025年9月オークション',
    auction_date: '2025-09-10',
    total_sales: 58000,
    commission: 5800,
    shipping_fee: 2000,
    packing_fee: 1000,
    net_amount: 49200,
    status: 'completed',
    paid_at: '2025-09-18',
    items_count: 2,
  },
];

const pendingSettlement = {
  id: 0,
  auction: '2025年12月オークション',
  auction_date: '2025-12-10',
  total_sales: 0,
  commission: 0,
  shipping_fee: 0,
  packing_fee: 0,
  net_amount: 0,
  status: 'pending',
  paid_at: null,
  items_count: 2,
  expected_payment_date: '2025-12-18',
};

const monthlySalesData = [
  { month: '7月', sales: 45000, net: 38000 },
  { month: '8月', sales: 62000, net: 52000 },
  { month: '9月', sales: 58000, net: 49200 },
  { month: '10月', sales: 72000, net: 61800 },
  { month: '11月', sales: 105000, net: 90000 },
  { month: '12月', sales: 0, net: 0 },
];

const bankInfo = {
  bank_name: '〇〇銀行',
  branch_name: '△△支店',
  account_type: '普通',
  account_number: '1234567',
  account_holder: 'タナカ ヨウギョジョウ',
};

export default function SalesSettlement() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<typeof settlements[0] | null>(null);

  // 統計
  const totalNetAmount = settlements.reduce((sum, s) => sum + s.net_amount, 0);
  const totalSales = settlements.reduce((sum, s) => sum + s.total_sales, 0);
  const totalCommission = settlements.reduce((sum, s) => sum + s.commission, 0);
  const completedCount = settlements.filter(s => s.status === 'completed').length;

  const handleOpenDetail = (settlement: typeof settlements[0]) => {
    setSelectedSettlement(settlement);
    setDetailDialogOpen(true);
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            売上・精算
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            売上と精算状況を確認できます
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
        >
          CSVダウンロード
        </Button>
      </Box>

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#ECFDF5', width: 44, height: 44 }}>
                  <MoneyIcon sx={{ color: '#059669' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    累計受取金額
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>
                    ¥{totalNetAmount.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#DBEAFE', width: 44, height: 44 }}>
                  <TrendingUpIcon sx={{ color: '#2563EB' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    累計売上
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    ¥{totalSales.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#FEF3C7', width: 44, height: 44 }}>
                  <ReceiptIcon sx={{ color: '#D97706' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    累計手数料
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    ¥{totalCommission.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#F3E8FF', width: 44, height: 44 }}>
                  <CheckCircleIcon sx={{ color: '#9333EA' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    精算完了
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {completedCount}回
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* 売上推移グラフ */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                月別売上推移
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySalesData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                      }}
                      formatter={(value: number, name: string) => [
                        `¥${value.toLocaleString()}`,
                        name === 'sales' ? '売上' : '受取金額'
                      ]}
                    />
                    <Bar dataKey="sales" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={35} name="sales" />
                    <Bar dataKey="net" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={35} name="net" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#3B82F6' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>売上</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#059669' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>受取金額</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 振込先情報 */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BankIcon sx={{ color: '#3B82F6' }} />
                  振込先口座
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/seller/profile')}
                >
                  変更
                </Button>
              </Box>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC' }}>
                <List dense disablePadding>
                  <ListItem disablePadding sx={{ mb: 1 }}>
                    <ListItemText
                      primary="銀行名"
                      secondary={bankInfo.bank_name}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    />
                  </ListItem>
                  <ListItem disablePadding sx={{ mb: 1 }}>
                    <ListItemText
                      primary="支店名"
                      secondary={bankInfo.branch_name}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    />
                  </ListItem>
                  <ListItem disablePadding sx={{ mb: 1 }}>
                    <ListItemText
                      primary="口座種別 / 口座番号"
                      secondary={`${bankInfo.account_type} / ${bankInfo.account_number}`}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemText
                      primary="口座名義"
                      secondary={bankInfo.account_holder}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    />
                  </ListItem>
                </List>
              </Paper>
            </CardContent>
          </Card>

          {/* 次回精算予定 */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon sx={{ color: '#F59E0B' }} />
                次回精算予定
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                12月オークション終了後に精算されます
              </Alert>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  対象オークション
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
                  {pendingSettlement.auction}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  出品数
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
                  {pendingSettlement.items_count}点
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  振込予定日
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {new Date(pendingSettlement.expected_payment_date!).toLocaleDateString('ja-JP')}（予定）
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* 精算履歴テーブル */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                精算履歴
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>オークション</TableCell>
                      <TableCell align="center">出品数</TableCell>
                      <TableCell align="right">売上金額</TableCell>
                      <TableCell align="right">手数料</TableCell>
                      <TableCell align="right">配送・梱包</TableCell>
                      <TableCell align="right">受取金額</TableCell>
                      <TableCell align="center">ステータス</TableCell>
                      <TableCell>振込日</TableCell>
                      <TableCell align="center">詳細</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {settlements.map((settlement) => (
                      <TableRow key={settlement.id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {settlement.auction}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {new Date(settlement.auction_date).toLocaleDateString('ja-JP')}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">{settlement.items_count}点</TableCell>
                        <TableCell align="right">¥{settlement.total_sales.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          -¥{settlement.commission.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          -¥{(settlement.shipping_fee + settlement.packing_fee).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            ¥{settlement.net_amount.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={settlement.status === 'completed' ? '振込済み' : '処理中'}
                            size="small"
                            icon={settlement.status === 'completed' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <ScheduleIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              bgcolor: settlement.status === 'completed' ? '#ECFDF5' : '#FEF3C7',
                              color: settlement.status === 'completed' ? '#059669' : '#D97706',
                              fontWeight: 600,
                              '& .MuiChip-icon': { color: 'inherit' },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {settlement.paid_at ? (
                            new Date(settlement.paid_at).toLocaleDateString('ja-JP')
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDetail(settlement)}
                          >
                            <VisibilityIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 詳細ダイアログ */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            精算詳細
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {selectedSettlement && (
            <Box>
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  対象オークション
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {selectedSettlement.auction}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  開催日: {new Date(selectedSettlement.auction_date).toLocaleDateString('ja-JP')}
                </Typography>
              </Paper>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                精算内訳
              </Typography>
              <List disablePadding>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemText primary="売上金額" />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    ¥{selectedSettlement.total_sales.toLocaleString()}
                  </Typography>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemText primary="出品手数料（10%）" />
                  <Typography variant="body1" sx={{ color: 'error.main' }}>
                    -¥{selectedSettlement.commission.toLocaleString()}
                  </Typography>
                </ListItem>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemText primary="配送料" />
                  <Typography variant="body1" sx={{ color: 'error.main' }}>
                    -¥{selectedSettlement.shipping_fee.toLocaleString()}
                  </Typography>
                </ListItem>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemText primary="梱包料" />
                  <Typography variant="body1" sx={{ color: 'error.main' }}>
                    -¥{selectedSettlement.packing_fee.toLocaleString()}
                  </Typography>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0, py: 1.5, bgcolor: '#F0FDF4', borderRadius: 1, mt: 1 }}>
                  <ListItemText
                    primary="受取金額"
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    ¥{selectedSettlement.net_amount.toLocaleString()}
                  </Typography>
                </ListItem>
              </List>

              <Box sx={{ mt: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  振込日
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedSettlement.paid_at
                    ? new Date(selectedSettlement.paid_at).toLocaleDateString('ja-JP')
                    : '未振込'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>閉じる</Button>
          <Button variant="contained" startIcon={<DownloadIcon />}>
            明細書ダウンロード
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

