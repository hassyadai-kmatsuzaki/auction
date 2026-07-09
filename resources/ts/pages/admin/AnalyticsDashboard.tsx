import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Grid, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert, TextField, Chip, Link,
} from '@mui/material';
import { People as PeopleIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import { adminAnalyticsApi } from '@/api/admin/analyticsApi';

const STATUS_LABEL: Record<string, string> = {
  preparing: '準備中', scheduled: '予定', live: '開催中', finished: '終了', cancelled: 'キャンセル',
};

export default function AnalyticsDashboard() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [from, setFrom] = useState(fmt(monthAgo));
  const [to, setTo] = useState(fmt(today));

  const overviewQ = useQuery({
    queryKey: ['analytics-overview', from, to],
    queryFn: () => adminAnalyticsApi.overview(from, to),
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>行動分析ダッシュボード</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField type="date" size="small" label="開始" InputLabelProps={{ shrink: true }}
            value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField type="date" size="small" label="終了" InputLabelProps={{ shrink: true }}
            value={to} onChange={(e) => setTo(e.target.value)} />
        </Box>
      </Box>

      {overviewQ.isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {overviewQ.isError && <Alert severity="error">分析データの取得に失敗しました。</Alert>}

      {overviewQ.data && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
                  <PeopleIcon fontSize="small" /><Typography variant="body2">総ユーザー数</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>{overviewQ.data.total_users}</Typography>
                <Typography variant="caption" color="text.secondary">テストユーザー除く</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
                  <TrendingUpIcon fontSize="small" /><Typography variant="body2">アクティブユーザー</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>{overviewQ.data.active_users}</Typography>
                <Typography variant="caption" color="text.secondary">期間内にアクセスした人数</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>日次アクセス（ユニークユーザー）</Typography>
            {overviewQ.data.daily_trend.length === 0 ? (
              <Typography color="text.secondary" variant="body2">データがありません。</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={overviewQ.data.daily_trend} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Line type="monotone" dataKey="uu" name="アクセスUU" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>オークション別比較</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>開催日</TableCell>
                  <TableCell>オークション</TableCell>
                  <TableCell>状態</TableCell>
                  <TableCell align="right">閲覧UU</TableCell>
                  <TableCell align="right">会場入場</TableCell>
                  <TableCell align="right">お気に入り</TableCell>
                  <TableCell align="right">指値</TableCell>
                  <TableCell align="right">入札者</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overviewQ.data.auctions.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center">期間内のオークションがありません。</TableCell></TableRow>
                )}
                {overviewQ.data.auctions.map((a) => (
                  <TableRow key={a.auction_id} hover>
                    <TableCell>{a.event_date ?? '-'}</TableCell>
                    <TableCell>
                      <Link component={RouterLink} to={`/admin/auctions/${a.auction_id}/analytics`} underline="hover">
                        {a.title}
                      </Link>
                    </TableCell>
                    <TableCell><Chip size="small" label={STATUS_LABEL[a.status] ?? a.status} /></TableCell>
                    <TableCell align="right">{a.item_view_uu}</TableCell>
                    <TableCell align="right">{a.venue_enter}</TableCell>
                    <TableCell align="right">{a.favorites}</TableCell>
                    <TableCell align="right">{a.bid_limits}</TableCell>
                    <TableCell align="right">{a.bidders}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
