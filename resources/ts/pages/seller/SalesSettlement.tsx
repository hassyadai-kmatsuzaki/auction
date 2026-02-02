import React, { useState, useEffect, useCallback } from 'react';
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
  CircularProgress,
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
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from '../../lib/axios';

interface Settlement {
  id: number;
  auction: string;
  auction_date: string;
  total_sales: number;
  commission: number;
  shipping_fee: number;
  packing_fee: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  items_count: number;
}

interface Statistics {
  total_net_amount: number;
  total_sales: number;
  total_commission: number;
  completed_count: number;
}

interface MonthlySale {
  month: string;
  sales: number;
  net: number;
}

interface BankInfo {
  bank_name: string;
  branch_name: string;
  account_type: string;
  account_number: string;
  account_holder: string;
}

interface NextSettlement {
  auction: string;
  auction_date: string;
  items_count: number;
  expected_payment_date: string;
}

interface SettlementItem {
  id: number;
  item: {
    id: number;
    item_number: string;
    species_name: string;
    quantity: number;
  };
  buyer: string;
  winning_price: number;
  commission: number;
  seller_amount: number;
}

interface SettlementDetail {
  settlement: Settlement;
  items: SettlementItem[];
}

export default function SalesSettlement() {
  const navigate = useNavigate();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [nextSettlement, setNextSettlement] = useState<NextSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [settlementDetail, setSettlementDetail] = useState<SettlementDetail | null>(null);

  // データ取得
  const fetchSettlements = useCallback(async () => {
    try {
      const response = await axios.get('/api/seller/settlements');
      if (response.data.success) {
        setSettlements(response.data.data.settlements);
        setStatistics(response.data.data.statistics);
        setMonthlySales(response.data.data.monthly_sales);
        setBankInfo(response.data.data.bank_info);
        setNextSettlement(response.data.data.next_settlement);
        setError(null);
      }
    } catch (err: any) {
      console.error('精算情報取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleOpenDetail = async (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    
    try {
      const response = await axios.get(`/api/seller/settlements/${settlement.id}`);
      if (response.data.success) {
        setSettlementDetail(response.data.data);
      }
    } catch (err) {
      console.error('精算詳細取得エラー:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSettlementDetail(null);
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
        <Button onClick={fetchSettlements}>再読み込み</Button>
      </Box>
    );
  }

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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchSettlements} title="更新">
            <RefreshIcon />
          </IconButton>
          <Button variant="outlined" startIcon={<DownloadIcon />}>
            CSVダウンロード
          </Button>
        </Box>
      </Box>

      {/* 統計カード */}
      {statistics && (
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
                      ¥{Number(statistics.total_net_amount).toLocaleString()}
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
                      ¥{Number(statistics.total_sales).toLocaleString()}
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
                      ¥{Number(statistics.total_commission).toLocaleString()}
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
                      {statistics.completed_count}回
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* 売上推移グラフ */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                月別売上推移
              </Typography>
              <Box sx={{ height: 300 }}>
                {monthlySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySales} barGap={8}>
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
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">データがありません</Typography>
                  </Box>
                )}
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
                <Button size="small" onClick={() => navigate('/seller/profile')}>
                  変更
                </Button>
              </Box>
              {bankInfo && (
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
              )}
            </CardContent>
          </Card>

          {/* 次回精算予定 */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon sx={{ color: '#F59E0B' }} />
                次回精算予定
              </Typography>
              {nextSettlement ? (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    オークション終了後に精算されます
                  </Alert>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      対象オークション
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
                      {nextSettlement.auction}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      出品数
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
                      {nextSettlement.items_count}点
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      振込予定日
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {new Date(nextSettlement.expected_payment_date).toLocaleDateString('ja-JP')}（予定）
                    </Typography>
                  </Paper>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  現在予定されている精算はありません
                </Typography>
              )}
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
                      <TableCell align="right">受取金額</TableCell>
                      <TableCell align="center">ステータス</TableCell>
                      <TableCell>振込日</TableCell>
                      <TableCell align="center">詳細</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {settlements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">精算履歴がありません</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      settlements.map((settlement) => (
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
                          <TableCell align="right">¥{Number(settlement.total_sales).toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            -¥{Number(settlement.commission).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                              ¥{Number(settlement.net_amount).toLocaleString()}
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 詳細ダイアログ */}
      <Dialog open={detailDialogOpen} onClose={handleCloseDetail} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            精算詳細
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedSettlement && (
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

              {/* 落札アイテム一覧 */}
              {settlementDetail?.items && settlementDetail.items.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    落札アイテム明細（{settlementDetail.items.length}点）
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell>品番</TableCell>
                          <TableCell>品種名</TableCell>
                          <TableCell>落札者</TableCell>
                          <TableCell align="right">落札価格</TableCell>
                          <TableCell align="right">手数料</TableCell>
                          <TableCell align="right">受取金額</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {settlementDetail.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>No.{item.item.item_number}</TableCell>
                            <TableCell>{item.item.species_name}</TableCell>
                            <TableCell>{item.buyer}</TableCell>
                            <TableCell align="right">¥{Number(item.winning_price).toLocaleString()}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              -¥{Number(item.commission).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                              ¥{Number(item.seller_amount).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                精算内訳
              </Typography>
              <List disablePadding>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemText primary="売上金額" />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    ¥{Number(selectedSettlement.total_sales).toLocaleString()}
                  </Typography>
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemText primary="出品手数料" />
                  <Typography variant="body1" sx={{ color: 'error.main' }}>
                    -¥{Number(selectedSettlement.commission).toLocaleString()}
                  </Typography>
                </ListItem>
                {selectedSettlement.shipping_fee > 0 && (
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <ListItemText primary="配送料" />
                    <Typography variant="body1" sx={{ color: 'error.main' }}>
                      -¥{Number(selectedSettlement.shipping_fee).toLocaleString()}
                    </Typography>
                  </ListItem>
                )}
                {selectedSettlement.packing_fee > 0 && (
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <ListItemText primary="梱包料" />
                    <Typography variant="body1" sx={{ color: 'error.main' }}>
                      -¥{Number(selectedSettlement.packing_fee).toLocaleString()}
                    </Typography>
                  </ListItem>
                )}
                <Divider />
                <ListItem sx={{ px: 0, py: 1.5, bgcolor: '#F0FDF4', borderRadius: 1, mt: 1 }}>
                  <ListItemText
                    primary="受取金額"
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    ¥{Number(selectedSettlement.net_amount).toLocaleString()}
                  </Typography>
                </ListItem>
              </List>

              <Box sx={{ mt: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      ステータス
                    </Typography>
                    <Chip
                      label={selectedSettlement.status === 'completed' ? '振込済み' : '処理中'}
                      size="small"
                      sx={{
                        bgcolor: selectedSettlement.status === 'completed' ? '#ECFDF5' : '#FEF3C7',
                        color: selectedSettlement.status === 'completed' ? '#059669' : '#D97706',
                        fontWeight: 600,
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      振込日
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedSettlement.paid_at
                        ? new Date(selectedSettlement.paid_at).toLocaleDateString('ja-JP')
                        : '未振込'}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetail}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
