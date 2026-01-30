import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Gavel as GavelIcon,
  Notifications as NotificationsIcon,
  PendingActions as PendingActionsIcon,
  AttachMoney as MoneyIcon,
  ArrowForward as ArrowForwardIcon,
  MoreVert as MoreVertIcon,
  Pets as PetsIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Campaign as CampaignIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Block as BlockIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Refresh as RefreshIcon,
  LocalShipping as LocalShippingIcon,
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

interface Statistics {
  auctions: {
    total: number;
    this_month: number;
    live: number;
    upcoming: number;
  };
  sales: {
    total: number;
    this_month: number;
    today: number;
  };
  won_items: {
    total: number;
    this_month: number;
    pending_payment: number;
    pending_shipment: number;
  };
  users: {
    total: number;
    pending_approval: number;
    active: number;
  };
}

interface PendingUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface UpcomingAuction {
  id: number;
  title: string;
  event_date: string;
  start_time: string | null;
  status: string;
  items_count: number;
}

interface MonthlySale {
  month: string;
  total: number;
  count: number;
}

interface RecentActivity {
  type: string;
  message: string;
  amount?: number;
  created_at: string;
}

// KPIカードコンポーネント
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  color?: string;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, trend, trendLabel, icon, color = '#059669', loading = false }: StatCardProps) {
  const isPositive = trend && trend > 0;

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 150 }}>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
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
          {trend !== undefined && (
            <Chip
              size="small"
              icon={isPositive ? <TrendingUpIcon sx={{ fontSize: 14 }} /> : <TrendingDownIcon sx={{ fontSize: 14 }} />}
              label={`${isPositive ? '+' : ''}${trend}%`}
              sx={{
                bgcolor: isPositive ? '#ECFDF5' : '#FEF2F2',
                color: isPositive ? '#059669' : '#DC2626',
                fontWeight: 600,
                fontSize: '0.75rem',
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
          )}
        </Box>

        <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, fontSize: '2rem' }}>
          {value}
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {title}
        </Typography>

        {(subtitle || trendLabel) && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {trendLabel && <span style={{ color: isPositive ? '#059669' : '#DC2626' }}>前月比 {trendLabel}</span>}
            {subtitle && <span>{subtitle}</span>}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const greeting = today.getHours() < 12 ? 'おはようございます' : today.getHours() < 18 ? 'こんにちは' : 'お疲れ様です';

  // 状態
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<UpcomingAuction[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // データ取得
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/dashboard');
      if (response.data.success) {
        setStatistics(response.data.data.statistics);
        setPendingUsers(response.data.data.pending_users || []);
        setUpcomingAuctions(response.data.data.upcoming_auctions || []);
        setMonthlySales(response.data.data.monthly_sales || []);
        setRecentActivity(response.data.data.recent_activity || []);
        setError(null);
      }
    } catch (err: any) {
      console.error('ダッシュボード取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ユーザー承認
  const handleApprove = async (userId: number) => {
    setActionLoading(true);
    try {
      const response = await axios.patch(`/api/admin/users/${userId}`, {
        status: 'approved',
      });
      if (response.data.success) {
        setSnackbar({ open: true, message: 'ユーザーを承認しました', severity: 'success' });
        fetchDashboard();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '承認に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // ユーザー却下
  const handleReject = async (userId: number) => {
    setActionLoading(true);
    try {
      const response = await axios.patch(`/api/admin/users/${userId}`, {
        status: 'rejected',
      });
      if (response.data.success) {
        setSnackbar({ open: true, message: 'ユーザーを却下しました', severity: 'success' });
        fetchDashboard();
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '却下に失敗しました', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // フィルタリングされた承認待ちユーザー
  const filteredPendingUsers = pendingUsers.filter((user) => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
  });

  // グラフデータの変換
  const chartData = monthlySales.map((item) => ({
    month: item.month,
    sales: Number(item.total),
    items: item.count,
  }));

  // アクティビティのアイコン取得
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'won_item':
        return <MoneyIcon sx={{ fontSize: 16 }} />;
      case 'user_registration':
        return <PeopleIcon sx={{ fontSize: 16 }} />;
      case 'auction':
        return <EventIcon sx={{ fontSize: 16 }} />;
      default:
        return <NotificationsIcon sx={{ fontSize: 16 }} />;
    }
  };

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={fetchDashboard}>再読み込み</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {greeting}、管理者さん
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            ダッシュボード
          </Typography>
        </Box>
        <IconButton onClick={fetchDashboard} title="更新">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* KPIカード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="今月の開催回数"
            value={statistics?.auctions.this_month || 0}
            icon={<EventIcon />}
            color="#3B82F6"
            loading={loading}
            subtitle={`ライブ中: ${statistics?.auctions.live || 0}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="今月の売上"
            value={`¥${((statistics?.sales.this_month || 0) / 10000).toFixed(0)}万`}
            icon={<MoneyIcon />}
            color="#059669"
            loading={loading}
            subtitle={`本日: ¥${((statistics?.sales.today || 0) / 10000).toFixed(1)}万`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="今月の落札数"
            value={statistics?.won_items.this_month || 0}
            icon={<PetsIcon />}
            color="#F59E0B"
            loading={loading}
            subtitle={`未入金: ${statistics?.won_items.pending_payment || 0}件`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="登録ユーザー数"
            value={statistics?.users.total || 0}
            icon={<PeopleIcon />}
            color="#8B5CF6"
            loading={loading}
            subtitle={`承認待ち: ${statistics?.users.pending_approval || 0}人`}
          />
        </Grid>
      </Grid>

      {/* メインコンテンツ */}
      <Grid container spacing={3}>
        {/* 売上グラフ */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    売上推移
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    過去6ヶ月の月間売上
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ height: 300 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(value) => `${value / 10000}万`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'sales' ? `¥${(value / 10000).toFixed(0)}万` : `${value}件`,
                          name === 'sales' ? '売上' : '落札数',
                        ]}
                      />
                      <Bar dataKey="sales" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">データがありません</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 承認待ちユーザー & 通知 */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PendingActionsIcon sx={{ color: '#F59E0B' }} />
                  承認待ち
                </Typography>
                <Chip
                  label={statistics?.users.pending_approval || 0}
                  size="small"
                  sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 700 }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                {statistics?.users.pending_approval || 0}件の新規ユーザー登録申請があります
              </Typography>
              <Button
                variant="contained"
                fullWidth
                endIcon={<ArrowForwardIcon />}
                onClick={() => setApprovalModalOpen(true)}
                disabled={!statistics?.users.pending_approval}
                sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
              >
                承認画面へ
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  最近のアクティビティ
                </Typography>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : recentActivity.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <React.Fragment key={index}>
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#F1F5F9', color: '#64748B' }}>
                            {getActivityIcon(activity.type)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={activity.message}
                          secondary={new Date(activity.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500, sx: { lineHeight: 1.4 } }}
                          secondaryTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                        />
                      </ListItem>
                      {index < recentActivity.slice(0, 5).length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  最近のアクティビティはありません
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 開催予定オークション */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    開催予定オークション
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    今後のオークションスケジュール
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/admin/auctions')}>
                  すべて表示
                </Button>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>オークション名</TableCell>
                      <TableCell>開催日</TableCell>
                      <TableCell align="center">出品数</TableCell>
                      <TableCell align="center">ステータス</TableCell>
                      <TableCell align="right">アクション</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    ) : upcomingAuctions.length > 0 ? (
                      upcomingAuctions.map((auction) => (
                        <TableRow key={auction.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: auction.status === 'live' ? '#FEF2F2' : '#F0FDF4', color: auction.status === 'live' ? '#DC2626' : '#059669' }}>
                                <EventIcon />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {auction.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  ID: {auction.id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {new Date(auction.event_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                                {auction.start_time && ` ${auction.start_time}`}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {auction.items_count}体
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={auction.status === 'live' ? '開催中' : auction.status === 'scheduled' ? '予定' : '準備中'}
                              sx={{
                                bgcolor: auction.status === 'live' ? '#FEF2F2' : auction.status === 'scheduled' ? '#DBEAFE' : '#F1F5F9',
                                color: auction.status === 'live' ? '#DC2626' : auction.status === 'scheduled' ? '#2563EB' : '#64748B',
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" onClick={() => navigate(`/admin/auctions/${auction.id}`)}>
                              管理
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">予定されたオークションはありません</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 承認モーダル */}
      <Dialog open={approvalModalOpen} onClose={() => setApprovalModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PendingActionsIcon sx={{ color: '#F59E0B' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                新規ユーザー登録申請
              </Typography>
              <Chip label={`${pendingUsers.length}件`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 600 }} />
            </Box>
            <IconButton onClick={() => setApprovalModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* 検索 */}
          <Box sx={{ mb: 3, mt: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="名前・メールで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* ユーザー一覧 */}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>申請者</TableCell>
                  <TableCell>メールアドレス</TableCell>
                  <TableCell>申請日</TableCell>
                  <TableCell align="center">アクション</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPendingUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: '#F3E8FF', color: '#9333EA' }}>
                          <PersonIcon sx={{ fontSize: 18 }} />
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {user.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{user.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(user.created_at).toLocaleDateString('ja-JP')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          startIcon={<CheckIcon />}
                          onClick={() => handleApprove(user.id)}
                          disabled={actionLoading}
                          sx={{ minWidth: 80 }}
                        >
                          承認
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<BlockIcon />}
                          onClick={() => handleReject(user.id)}
                          disabled={actionLoading}
                          sx={{ minWidth: 80 }}
                        >
                          却下
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredPendingUsers.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                該当するユーザーがいません
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setApprovalModalOpen(false)}>閉じる</Button>
          <Button
            variant="outlined"
            onClick={() => {
              setApprovalModalOpen(false);
              navigate('/admin/users');
            }}
          >
            ユーザー管理へ
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
