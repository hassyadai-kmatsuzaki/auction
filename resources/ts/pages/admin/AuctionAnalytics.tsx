import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Grid, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  Chip, Link, Tooltip,
} from '@mui/material';
import {
  Visibility as ViewIcon, MeetingRoom as VenueIcon, Favorite as FavoriteIcon,
  PriceChange as LimitIcon, Gavel as BidIcon,
} from '@mui/icons-material';
import {
  adminAnalyticsApi, type DrilldownEvent, type AnalyticsUserRow,
} from '@/api/admin/analyticsApi';

/** クリックでドリルダウン（誰が）を開ける KPI カード。 */
function KpiCard(props: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  onClick?: () => void;
}) {
  const { icon, label, value, sub, onClick } = props;
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2, height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, box-shadow .15s',
        ...(onClick ? { '&:hover': { borderColor: 'primary.main', boxShadow: 1 } } : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
        {icon}
        <Typography variant="body2">{label}</Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

export default function AuctionAnalytics() {
  const { auctionId: idStr } = useParams<{ auctionId: string }>();
  const auctionId = Number(idStr);

  const summaryQ = useQuery({
    queryKey: ['auction-analytics-summary', auctionId],
    queryFn: () => adminAnalyticsApi.auctionSummary(auctionId),
    enabled: !!auctionId,
  });
  const itemsQ = useQuery({
    queryKey: ['auction-analytics-items', auctionId],
    queryFn: () => adminAnalyticsApi.auctionItems(auctionId),
    enabled: !!auctionId,
  });

  // ドリルダウン（誰が）
  const [drill, setDrill] = useState<{ event: DrilldownEvent; itemId?: number; label: string } | null>(null);
  const drillQ = useQuery({
    queryKey: ['auction-analytics-users', auctionId, drill?.event, drill?.itemId],
    queryFn: () => adminAnalyticsApi.auctionUsers(auctionId, drill!.event, drill?.itemId),
    enabled: !!drill,
  });

  if (summaryQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }
  if (summaryQ.isError || !summaryQ.data) {
    return <Alert severity="error">分析データの取得に失敗しました。</Alert>;
  }

  const m = summaryQ.data.metrics;
  const openDrill = (event: DrilldownEvent, label: string, itemId?: number) =>
    setDrill({ event, itemId, label });

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>行動分析</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        テストユーザーは集計から除外。カードや行をクリックすると「誰が」を確認できます。
      </Typography>

      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<VenueIcon fontSize="small" />} label="会場参加者数（人）" value={m.venue_enter.count}
            sub="「会場へ」を押した人数"
            onClick={() => openDrill('venue_enter', '会場に参加した人')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<ViewIcon fontSize="small" />} label="生体閲覧（回）" value={m.item_view.count}
            sub={`閲覧ユーザー ${m.item_view.unique_users} 人（開始前のみ計測）`}
            onClick={() => openDrill('item_view', '生体を閲覧した人')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<FavoriteIcon fontSize="small" />} label="お気に入り追加（回）" value={m.favorite_add.count}
            sub={`手動 ${m.favorite_add.manual} / 自動 ${m.favorite_add.auto}・現在 ${m.favorite_current.count}`}
            onClick={() => openDrill('favorite_add', 'お気に入りに追加した人')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<LimitIcon fontSize="small" />} label="指値設定（回）" value={m.bid_limit_set.count}
            sub={`解除 ${m.bid_limit_remove.count}・現在有効 ${m.bid_limit_current.count}`}
            onClick={() => openDrill('bid_limit_set', '指値を設定した人')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<BidIcon fontSize="small" />} label="入札者（人）" value={m.bidders.unique_users}
            sub="実際に入札した人数"
            onClick={() => openDrill('bid', '入札した人')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<FavoriteIcon fontSize="small" />} label="お気に入り解除（回）" value={m.favorite_remove.count}
            onClick={() => openDrill('favorite_remove', 'お気に入りを解除した人')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard icon={<LimitIcon fontSize="small" />} label="指値解除（回）" value={m.bid_limit_remove.count}
            onClick={() => openDrill('bid_limit_remove', '指値を解除した人')} />
        </Grid>
      </Grid>

      {/* 生体別ランキング */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>生体別（閲覧の多い順）</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>No.</TableCell>
              <TableCell>生体名 / 出品コード</TableCell>
              <TableCell align="right">閲覧数</TableCell>
              <TableCell align="right">閲覧UU</TableCell>
              <TableCell align="right">お気に入り</TableCell>
              <TableCell align="right">指値</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {itemsQ.isLoading && (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={20} /></TableCell></TableRow>
            )}
            {itemsQ.data?.map((r) => (
              <TableRow key={r.item_id} hover>
                <TableCell>{r.item_number ?? '-'}</TableCell>
                <TableCell>
                  {r.species_name ?? '-'}
                  {r.exhibit_code && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{r.exhibit_code}</Typography>}
                </TableCell>
                <TableCell align="right">
                  {r.views > 0 ? (
                    <Tooltip title="閲覧した人を見る">
                      <Link component="button" underline="hover" onClick={() => openDrill('item_view', `${r.species_name ?? ''} を閲覧した人`, r.item_id)}>
                        {r.views}
                      </Link>
                    </Tooltip>
                  ) : 0}
                </TableCell>
                <TableCell align="right">{r.view_users}</TableCell>
                <TableCell align="right">{r.favorites}</TableCell>
                <TableCell align="right">{r.bid_limits}</TableCell>
              </TableRow>
            ))}
            {itemsQ.data && itemsQ.data.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">データがありません。</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 誰が ドリルダウン */}
      <Dialog open={!!drill} onClose={() => setDrill(null)} fullWidth maxWidth="sm">
        <DialogTitle>{drill?.label}</DialogTitle>
        <DialogContent dividers>
          {drillQ.isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
          {drillQ.data && drillQ.data.length === 0 && <Typography color="text.secondary">対象ユーザーはいません。</Typography>}
          {drillQ.data && drillQ.data.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ユーザー</TableCell>
                  <TableCell align="right">回数</TableCell>
                  <TableCell align="right">最終</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drillQ.data.map((u: AnalyticsUserRow) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Typography variant="body2">{u.trade_name || u.name || `#${u.id}`}</Typography>
                      <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    </TableCell>
                    <TableCell align="right"><Chip size="small" label={u.cnt} /></TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {u.last_at ? new Date(u.last_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
