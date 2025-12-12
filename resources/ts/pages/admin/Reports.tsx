import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
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
  TextField,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Pets as PetsIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  AttachMoney as MoneyIcon,
  CalendarMonth as CalendarIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Mock データ
const monthlySalesData = [
  { month: '1月', sales: 1250000, transactions: 120, avgPrice: 10416 },
  { month: '2月', sales: 1380000, transactions: 135, avgPrice: 10222 },
  { month: '3月', sales: 1520000, transactions: 148, avgPrice: 10270 },
  { month: '4月', sales: 1450000, transactions: 142, avgPrice: 10211 },
  { month: '5月', sales: 1680000, transactions: 165, avgPrice: 10181 },
  { month: '6月', sales: 1920000, transactions: 185, avgPrice: 10378 },
  { month: '7月', sales: 2150000, transactions: 210, avgPrice: 10238 },
  { month: '8月', sales: 2080000, transactions: 198, avgPrice: 10505 },
  { month: '9月', sales: 1850000, transactions: 175, avgPrice: 10571 },
  { month: '10月', sales: 1920000, transactions: 182, avgPrice: 10549 },
  { month: '11月', sales: 2250000, transactions: 215, avgPrice: 10465 },
  { month: '12月', sales: 2480000, transactions: 238, avgPrice: 10420 },
];

const speciesBreakdown = [
  { name: '幹之系', value: 32, amount: 793600, color: '#3B82F6' },
  { name: 'ラメ系', value: 28, amount: 694400, color: '#F59E0B' },
  { name: '三色系', value: 18, amount: 446400, color: '#10B981' },
  { name: '楊貴妃系', value: 12, amount: 297600, color: '#EF4444' },
  { name: 'その他', value: 10, amount: 248000, color: '#6B7280' },
];

const topSellers = [
  { rank: 1, name: '田中養魚場', sales: 485000, transactions: 45, avgPrice: 10777 },
  { rank: 2, name: 'メダカの佐藤', sales: 392000, transactions: 38, avgPrice: 10315 },
  { rank: 3, name: '鈴木メダカファーム', sales: 328000, transactions: 32, avgPrice: 10250 },
  { rank: 4, name: '山田めだか園', sales: 275000, transactions: 28, avgPrice: 9821 },
  { rank: 5, name: '高橋ブリーダー', sales: 248000, transactions: 25, avgPrice: 9920 },
];

const topBuyers = [
  { rank: 1, name: '佐々木様', purchases: 185000, transactions: 12, avgPrice: 15416 },
  { rank: 2, name: '伊藤様', purchases: 142000, transactions: 15, avgPrice: 9466 },
  { rank: 3, name: '渡辺様', purchases: 128000, transactions: 10, avgPrice: 12800 },
  { rank: 4, name: '中村様', purchases: 115000, transactions: 8, avgPrice: 14375 },
  { rank: 5, name: '小林様', purchases: 98000, transactions: 12, avgPrice: 8166 },
];

const recentReports = [
  { id: 1, name: '2025年11月 月次レポート', type: 'monthly', generatedAt: '2025-12-01 09:00', status: 'completed', size: '2.4MB' },
  { id: 2, name: '2025年 第48週 週次レポート', type: 'weekly', generatedAt: '2025-12-02 09:00', status: 'completed', size: '1.2MB' },
  { id: 3, name: '2025年 第49週 週次レポート', type: 'weekly', generatedAt: '2025-12-09 09:00', status: 'completed', size: '1.1MB' },
  { id: 4, name: '2025年12月 月次レポート', type: 'monthly', generatedAt: '2025-12-12 10:30', status: 'processing', size: '-' },
];

export default function Reports() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState('2025-11');

  const currentMonthData = {
    totalSales: 2480000,
    salesChange: 10.2,
    totalTransactions: 238,
    transactionsChange: 10.7,
    avgPrice: 10420,
    priceChange: -0.4,
    uniqueSellers: 45,
    uniqueBuyers: 156,
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/ai-analytics')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            レポート自動生成
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            週次・月次の取引サマリーを自動作成
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
        >
          最新レポート生成
        </Button>
      </Box>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="サマリー" icon={<AssessmentIcon />} iconPosition="start" />
        <Tab label="品種別分析" icon={<PetsIcon />} iconPosition="start" />
        <Tab label="ユーザー分析" icon={<PersonIcon />} iconPosition="start" />
        <Tab label="レポート履歴" icon={<ScheduleIcon />} iconPosition="start" />
      </Tabs>

      {/* サマリータブ */}
      {tabValue === 0 && (
        <Box>
          {/* 期間選択 */}
          <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>レポート種別</InputLabel>
              <Select
                value={reportPeriod}
                label="レポート種別"
                onChange={(e) => setReportPeriod(e.target.value)}
              >
                <MenuItem value="weekly">週次</MenuItem>
                <MenuItem value="monthly">月次</MenuItem>
                <MenuItem value="quarterly">四半期</MenuItem>
                <MenuItem value="yearly">年次</MenuItem>
              </Select>
            </FormControl>
            <TextField
              type="month"
              size="small"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              sx={{ width: 180 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" startIcon={<PdfIcon />}>
              PDF出力
            </Button>
            <Button variant="outlined" startIcon={<ExcelIcon />}>
              Excel出力
            </Button>
          </Paper>

          {/* KPIカード */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>
                      <MoneyIcon sx={{ color: 'primary.main' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        総売上
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        ¥{(currentMonthData.totalSales / 10000).toFixed(0)}万
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {currentMonthData.salesChange >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="caption"
                          sx={{ color: currentMonthData.salesChange >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {currentMonthData.salesChange >= 0 ? '+' : ''}{currentMonthData.salesChange}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'success.light', width: 48, height: 48 }}>
                      <AssessmentIcon sx={{ color: 'success.main' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        取引件数
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {currentMonthData.totalTransactions}件
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        <Typography variant="caption" sx={{ color: 'success.main' }}>
                          +{currentMonthData.transactionsChange}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'warning.light', width: 48, height: 48 }}>
                      <PetsIcon sx={{ color: 'warning.main' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        平均落札価格
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        ¥{currentMonthData.avgPrice.toLocaleString()}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                        <Typography variant="caption" sx={{ color: 'error.main' }}>
                          {currentMonthData.priceChange}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'info.light', width: 48, height: 48 }}>
                      <PersonIcon sx={{ color: 'info.main' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        アクティブユーザー
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {currentMonthData.uniqueSellers + currentMonthData.uniqueBuyers}人
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        出品者{currentMonthData.uniqueSellers} / 落札者{currentMonthData.uniqueBuyers}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* グラフ */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  月別売上推移
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={monthlySalesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value / 10000}万`} />
                    <RechartsTooltip formatter={(value: number) => [`¥${value.toLocaleString()}`, '売上']} />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* 品種別分析タブ */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                品種別取引割合
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={speciesBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {speciesBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => [`${value}%`, '割合']} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
                {speciesBreakdown.map((item) => (
                  <Chip
                    key={item.name}
                    label={`${item.name} ${item.value}%`}
                    size="small"
                    sx={{ bgcolor: item.color, color: 'white', fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                品種別売上詳細
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>品種カテゴリ</TableCell>
                      <TableCell align="right">売上金額</TableCell>
                      <TableCell align="center">構成比</TableCell>
                      <TableCell align="center">前月比</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {speciesBreakdown.map((item) => (
                      <TableRow key={item.name} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: item.color }} />
                            {item.name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">¥{item.amount.toLocaleString()}</TableCell>
                        <TableCell align="center">{item.value}%</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`+${Math.floor(Math.random() * 15)}%`}
                            size="small"
                            color="success"
                            sx={{ minWidth: 60 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                品種別取引件数推移
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlySalesData.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip />
                  <Bar dataKey="transactions" name="取引件数" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ユーザー分析タブ */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                トップ出品者
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>順位</TableCell>
                      <TableCell>出品者</TableCell>
                      <TableCell align="right">売上</TableCell>
                      <TableCell align="right">件数</TableCell>
                      <TableCell align="right">平均</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topSellers.map((seller) => (
                      <TableRow key={seller.rank} hover>
                        <TableCell>
                          <Chip
                            label={seller.rank}
                            size="small"
                            color={seller.rank <= 3 ? 'primary' : 'default'}
                            sx={{ minWidth: 28 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.light', fontSize: '0.7rem' }}>
                              <StoreIcon sx={{ fontSize: 14 }} />
                            </Avatar>
                            {seller.name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">¥{seller.sales.toLocaleString()}</TableCell>
                        <TableCell align="right">{seller.transactions}</TableCell>
                        <TableCell align="right">¥{seller.avgPrice.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                トップ落札者
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>順位</TableCell>
                      <TableCell>落札者</TableCell>
                      <TableCell align="right">購入額</TableCell>
                      <TableCell align="right">件数</TableCell>
                      <TableCell align="right">平均</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topBuyers.map((buyer) => (
                      <TableRow key={buyer.rank} hover>
                        <TableCell>
                          <Chip
                            label={buyer.rank}
                            size="small"
                            color={buyer.rank <= 3 ? 'success' : 'default'}
                            sx={{ minWidth: 28 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, bgcolor: 'success.light', fontSize: '0.7rem' }}>
                              <PersonIcon sx={{ fontSize: 14 }} />
                            </Avatar>
                            {buyer.name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">¥{buyer.purchases.toLocaleString()}</TableCell>
                        <TableCell align="right">{buyer.transactions}</TableCell>
                        <TableCell align="right">¥{buyer.avgPrice.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                ユーザー活動サマリー
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      新規登録ユーザー
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      28
                    </Typography>
                    <Chip label="+12%" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      リピート率
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      68%
                    </Typography>
                    <Chip label="+3%" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      平均入札回数/ユーザー
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      4.2
                    </Typography>
                    <Chip label="+0.5" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      ユーザー満足度
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      4.5
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      /5.0
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* レポート履歴タブ */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              生成済みレポート
            </Typography>
            <Button variant="outlined" startIcon={<EmailIcon />}>
              定期配信設定
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>レポート名</TableCell>
                  <TableCell>種別</TableCell>
                  <TableCell>生成日時</TableCell>
                  <TableCell align="center">ステータス</TableCell>
                  <TableCell align="right">サイズ</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentReports.map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssessmentIcon sx={{ color: 'primary.main' }} />
                        {report.name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.type === 'monthly' ? '月次' : report.type === 'weekly' ? '週次' : report.type}
                        size="small"
                        color={report.type === 'monthly' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{report.generatedAt}</TableCell>
                    <TableCell align="center">
                      {report.status === 'completed' ? (
                        <Chip label="完了" size="small" color="success" />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress sx={{ width: 60 }} />
                          <Typography variant="caption">生成中</Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">{report.size}</TableCell>
                    <TableCell align="center">
                      {report.status === 'completed' && (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <IconButton size="small" color="primary">
                            <PdfIcon />
                          </IconButton>
                          <IconButton size="small" color="success">
                            <ExcelIcon />
                          </IconButton>
                          <IconButton size="small">
                            <DownloadIcon />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            自動生成スケジュール
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CalendarIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="subtitle2">週次レポート</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  毎週月曜日 09:00 に自動生成
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CalendarIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="subtitle2">月次レポート</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  毎月1日 09:00 に自動生成
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}

