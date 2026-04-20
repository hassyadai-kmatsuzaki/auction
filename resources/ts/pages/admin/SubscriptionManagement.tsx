import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, IconButton, TextField, MenuItem, Pagination, Stack, CircularProgress,
  Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import axios from '../../lib/axios';

interface Plan { id: number; code: string; name: string; amount: number; }
interface User { id: number; name: string; email: string; status: string; }
interface Subscription {
  id: number;
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'suspended';
  plan: Plan | null;
  user: User | null;
  card_brand: string | null;
  card_last4: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  suspended_reason: string | null;
  canceled_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<Subscription['status'], { label: string; color: 'success' | 'warning' | 'default' | 'error' | 'info' }> = {
  active: { label: '有効', color: 'success' },
  pending: { label: '未課金', color: 'default' },
  past_due: { label: '支払失敗', color: 'warning' },
  suspended: { label: '停止中', color: 'error' },
  canceled: { label: '解約済', color: 'default' },
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ja-JP') : '-';

export default function SubscriptionManagement() {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filters, setFilters] = useState({ status: 'all', plan_id: '', search: '' });
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [actionTarget, setActionTarget] = useState<Subscription | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'retry' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, per_page: 30 };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.plan_id) params.plan_id = filters.plan_id;
      if (filters.search) params.search = filters.search;
      const res = await axios.get('/api/admin/subscriptions', { params });
      setRows(res.data.data.subscriptions);
      setLastPage(res.data.data.pagination.last_page);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await axios.get('/api/admin/plans');
      setPlans(res.data.data.plans);
    } catch {}
  };

  useEffect(() => { loadPlans(); }, []);
  useEffect(() => { load(); }, [page, filters.status, filters.plan_id]);

  const openAction = (row: Subscription, type: 'cancel' | 'retry') => {
    setActionTarget(row);
    setActionType(type);
    setActionReason('');
  };

  const runAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionBusy(true);
    try {
      if (actionType === 'cancel') {
        await axios.post(`/api/admin/subscriptions/${actionTarget.id}/cancel`, { reason: actionReason || null });
      } else {
        await axios.post(`/api/admin/subscriptions/${actionTarget.id}/retry`);
      }
      setActionTarget(null);
      setActionType(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? '操作に失敗しました');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>サブスクリプション管理</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField size="small" select label="状態" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }} sx={{ minWidth: 140 }}>
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="active">有効</MenuItem>
            <MenuItem value="pending">未課金</MenuItem>
            <MenuItem value="past_due">支払失敗</MenuItem>
            <MenuItem value="suspended">停止中</MenuItem>
            <MenuItem value="canceled">解約済</MenuItem>
          </TextField>
          <TextField size="small" select label="プラン" value={filters.plan_id} onChange={(e) => { setPage(1); setFilters({ ...filters, plan_id: e.target.value }); }} sx={{ minWidth: 180 }}>
            <MenuItem value="">すべて</MenuItem>
            {plans.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
          </TextField>
          <TextField size="small" label="名前/メールで検索" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }} />
          <Button variant="outlined" onClick={() => { setPage(1); load(); }}>検索</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ユーザー</TableCell>
                    <TableCell>プラン</TableCell>
                    <TableCell>状態</TableCell>
                    <TableCell>カード</TableCell>
                    <TableCell>次回更新</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>該当データなし</TableCell></TableRow>}
                  {rows.map((r) => {
                    const s = STATUS_LABEL[r.status];
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell>
                          <Typography fontWeight={500}>{r.user?.name ?? '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.user?.email}</Typography>
                        </TableCell>
                        <TableCell>{r.plan?.name ?? '-'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={s.label} color={s.color} />
                          {r.suspended_reason && <Typography variant="caption" display="block" color="error">{r.suspended_reason}</Typography>}
                        </TableCell>
                        <TableCell>{r.card_brand && r.card_last4 ? `${r.card_brand} ****${r.card_last4}` : '-'}</TableCell>
                        <TableCell>{fmtDate(r.current_period_end)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {(r.status === 'suspended' || r.status === 'past_due') && (
                              <Button size="small" variant="outlined" onClick={() => openAction(r, 'retry')}>再課金</Button>
                            )}
                            {r.status !== 'canceled' && (
                              <Button size="small" color="error" variant="outlined" onClick={() => openAction(r, 'cancel')}>解約</Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {lastPage > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Pagination count={lastPage} page={page} onChange={(_, p) => setPage(p)} />
              </Box>
            )}
          </>
        )}
      </Paper>

      <Dialog open={!!actionTarget && actionType === 'cancel'} onClose={() => setActionTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>サブスクリプションを解約</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{actionTarget?.user?.name} さんのサブスクリプションを解約します。</Typography>
          <TextField label="理由（任意）" value={actionReason} onChange={(e) => setActionReason(e.target.value)} fullWidth multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionTarget(null)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={runAction} disabled={actionBusy}>{actionBusy ? '処理中…' : '解約する'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!actionTarget && actionType === 'retry'} onClose={() => setActionTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>登録済みカードで再課金</DialogTitle>
        <DialogContent>
          <Typography>{actionTarget?.user?.name} さんの登録カードで再課金を試みます。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionTarget(null)}>キャンセル</Button>
          <Button variant="contained" onClick={runAction} disabled={actionBusy}>{actionBusy ? '処理中…' : '実行'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
