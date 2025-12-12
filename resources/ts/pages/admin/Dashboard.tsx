import React from 'react';
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
  Area,
  AreaChart,
} from 'recharts';

// Mock データ
const stats = {
  thisMonthAuctions: 2,
  totalSales: 1850000,
  totalItems: 245,
  totalUsers: 156,
  pendingUsers: 8,
  activeAuctions: 1,
};

// 月間売上データ
const monthlyData = [
  { month: '7月', sales: 1200000, items: 180 },
  { month: '8月', sales: 980000, items: 145 },
  { month: '9月', sales: 1450000, items: 210 },
  { month: '10月', sales: 1650000, items: 235 },
  { month: '11月', sales: 1850000, items: 245 },
  { month: '12月', sales: 1200000, items: 180 },
];

const recentActivities = [
  { id: 1, type: 'auction', text: '11月12日オークションが終了しました', time: '2時間前', icon: <EventIcon /> },
  { id: 2, type: 'user', text: '新規ユーザー登録申請が8件あります', time: '3時間前', icon: <PeopleIcon /> },
  { id: 3, type: 'item', text: '生体120個体の登録が完了しました', time: '1日前', icon: <PetsIcon /> },
  { id: 4, type: 'payment', text: '落札者30名の入金確認が完了', time: '1日前', icon: <MoneyIcon /> },
];

const upcomingAuctions = [
  { id: 1, title: '2025年12月オークション', date: '2025-12-10', items: 120, status: 'preparing' },
  { id: 2, title: '2025年クリスマス特別', date: '2025-12-24', items: 80, status: 'draft' },
];

// KPIカードコンポーネント
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ title, value, subtitle, trend, trendLabel, icon, color = '#059669' }: StatCardProps) {
  const isPositive = trend && trend > 0;
  
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
  const today = new Date();
  const greeting = today.getHours() < 12 ? 'おはようございます' : today.getHours() < 18 ? 'こんにちは' : 'お疲れ様です';

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
          {greeting}、管理者さん
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          ダッシュボード
        </Typography>
      </Box>

      {/* KPIカード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="今月の開催回数"
            value={stats.thisMonthAuctions}
            icon={<EventIcon />}
            trend={50}
            trendLabel="+1回"
            color="#3B82F6"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="総売上金額"
            value={`¥${(stats.totalSales / 10000).toFixed(0)}万`}
            icon={<MoneyIcon />}
            trend={12.1}
            trendLabel="¥20万"
            color="#059669"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="総出品数"
            value={stats.totalItems}
            icon={<PetsIcon />}
            trend={4.3}
            trendLabel="+10体"
            color="#F59E0B"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="登録参加者数"
            value={stats.totalUsers}
            icon={<PeopleIcon />}
            trend={7.2}
            trendLabel="+11人"
            color="#8B5CF6"
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
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#059669' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>売上</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#3B82F6' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>出品数</Typography>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barGap={8}>
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
                      tickFormatter={(value) => `${value / 10000}万`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(value: number, name: string) => [
                        name === 'sales' ? `¥${(value / 10000).toFixed(0)}万` : `${value}体`,
                        name === 'sales' ? '売上' : '出品数'
                      ]}
                    />
                    <Bar dataKey="sales" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
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
                  label={stats.pendingUsers}
                  size="small"
                  sx={{
                    bgcolor: '#FEF3C7',
                    color: '#D97706',
                    fontWeight: 700,
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                {stats.pendingUsers}件の新規ユーザー登録申請があります
              </Typography>
              <Button
                variant="contained"
                fullWidth
                endIcon={<ArrowForwardIcon />}
                sx={{
                  bgcolor: '#F59E0B',
                  '&:hover': { bgcolor: '#D97706' },
                }}
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
                <IconButton size="small">
                  <MoreVertIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              
              <List sx={{ p: 0 }}>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: '#F1F5F9',
                            color: '#64748B',
                          }}
                        >
                          {React.cloneElement(activity.icon as React.ReactElement, { sx: { fontSize: 16 } })}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.text}
                        secondary={activity.time}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 500,
                          sx: { lineHeight: 1.4 },
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          sx: { color: 'text.secondary' },
                        }}
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
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
                <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />}>
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
                    {upcomingAuctions.map((auction) => (
                      <TableRow
                        key={auction.id}
                        hover
                        sx={{ '&:last-child td': { border: 0 } }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              variant="rounded"
                              sx={{
                                width: 40,
                                height: 40,
                                bgcolor: '#F0FDF4',
                                color: '#059669',
                              }}
                            >
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
                              {new Date(auction.date).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {auction.items}体
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={auction.status === 'preparing' ? '準備中' : '下書き'}
                            sx={{
                              bgcolor: auction.status === 'preparing' ? '#DBEAFE' : '#F1F5F9',
                              color: auction.status === 'preparing' ? '#2563EB' : '#64748B',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined">
                            管理
                          </Button>
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
    </Box>
  );
}
