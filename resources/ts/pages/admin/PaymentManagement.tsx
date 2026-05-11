import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, TextField, MenuItem, Pagination, Stack, CircularProgress,
  Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Link as MuiLink,
} from '@mui/material';
import axios from '../../lib/axios';

interface User { id: number; name: string; email: string; }
interface Plan { id: number; code: string; name: string; }
interface Payment {
  id: number;
  user: User | null;
  plan: Plan | null;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: 'card' | 'bank_transfer' | null;
  failure_reason: string | null;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  refunded_amount: number | null;
  receipt_url: string | null;
  square_payment_id: string | null;
  created_at: string;
}

const STATUS: Record<Payment['status'], { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
  completed: { label: '完了', color: 'success' },
  failed:    { label: '失敗', color: 'error' },
  refunded:  { label: '返金済', color: 'warning' },
  pending:   { label: '処理中', color: 'default' },
};

const formatYen = (n: number) => '¥' + new Intl.NumberFormat('ja-JP').format(n);
const fmtDT = (s: string | null) => s ? new Date(s).toLocaleString('ja-JP') : '-';

export default function PaymentManagement() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filters, setFilters] = useState({ status: 'all', plan_id: '', search: '' });
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);

  const [confirmBankTarget, setConfirmBankTarget] = useState<Payment | null>(null);
  const [confirmBankBusy, setConfirmBankBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, per_page: 30 };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.plan_id) params.plan_id = filters.plan_id;
      if (filters.search) params.search = filters.search;
      const res = await axios.get('/api/admin/payments', { params });
      setRows(res.data.data.payments);
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

  const openRefund = (p: Payment) => {
    setRefundTarget(p);
    setRefundAmount(String(p.amount));
    setRefundReason('');
  };

  const runRefund = async () => {
    if (!refundTarget) return;
    setRefundBusy(true);
    try {
      const amt = Number(refundAmount);
      await axios.post(`/api/admin/payments/${refundTarget.id}/refund`, {
        amount: amt,
        reason: refundReason || null,
      });
      setRefundTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? '返金に失敗しました');
    } finally {
      setRefundBusy(false);
    }
  };

  const runConfirmBankTransfer = async () => {
    if (!confirmBankTarget?.user) return;
    setConfirmBankBusy(true);
    try {
      await axios.post(`/api/admin/users/${confirmBankTarget.user.id}/confirm-bank-transfer`);
      setConfirmBankTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? '振込確認に失敗しました');
    } finally {
      setConfirmBankBusy(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>決済管理</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField size="small" select label="状態" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }} sx={{ minWidth: 140 }}>
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="completed">完了</MenuItem>
            <MenuItem value="failed">失敗</MenuItem>
            <MenuItem value="refunded">返金済</MenuItem>
            <MenuItem value="pending">処理中</MenuItem>
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
                    <TableCell>決済日時</TableCell>
                    <TableCell>ユーザー</TableCell>
                    <TableCell>プラン</TableCell>
                    <TableCell align="right">金額</TableCell>
                    <TableCell>支払方法</TableCell>
                    <TableCell>状態</TableCell>
                    <TableCell>Square決済ID</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>該当データなし</TableCell></TableRow>}
                  {rows.map((r) => {
                    const s = STATUS[r.status];
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell>{fmtDT(r.paid_at ?? r.created_at)}</TableCell>
                        <TableCell>
                          <Typography fontWeight={500}>{r.user?.name ?? '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.user?.email}</Typography>
                        </TableCell>
                        <TableCell>{r.plan?.name ?? '-'}</TableCell>
                        <TableCell align="right">{formatYen(r.amount)}</TableCell>
                        <TableCell>
                          {r.method === 'bank_transfer' ? (
                            <Chip size="small" label="銀行振込" color="info" variant="outlined" />
                          ) : r.method === 'card' ? (
                            <Chip size="small" label="カード" variant="outlined" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={s.label} color={s.color} />
                          {r.failure_reason && <Typography variant="caption" display="block" color="error">{r.failure_reason}</Typography>}
                        </TableCell>
                        <TableCell>
                          {r.receipt_url ? (
                            <MuiLink href={r.receipt_url} target="_blank" rel="noopener">{r.square_payment_id?.slice(0, 10)}…</MuiLink>
                          ) : (
                            <code>{r.square_payment_id?.slice(0, 10) ?? '-'}</code>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {r.status === 'completed' && (
                            <Button size="small" variant="outlined" onClick={() => openRefund(r)}>返金</Button>
                          )}
                          {r.status === 'pending' && r.method === 'bank_transfer' && r.user && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => setConfirmBankTarget(r)}
                              sx={{ paddingInline: '8px' }}
                            >
                              振込確認
                            </Button>
                          )}
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

      <Dialog open={!!refundTarget} onClose={() => setRefundTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>返金処理</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>{refundTarget?.user?.name} さんの {formatYen(refundTarget?.amount ?? 0)} を返金します。</Typography>
            <TextField label="返金金額（円）" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9]/g, ''))} fullWidth />
            <TextField label="理由" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundTarget(null)}>キャンセル</Button>
          <Button variant="contained" color="warning" onClick={runRefund} disabled={refundBusy}>{refundBusy ? '処理中…' : '返金する'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmBankTarget} onClose={() => setConfirmBankTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>銀行振込の入金確認</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography>
              {confirmBankTarget?.user?.name} さんからの
              {formatYen(confirmBankTarget?.amount ?? 0)} の入金を確認済みとして登録します。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              この決済は完了扱いになり、サブスクリプションが有効化（1年延長）されます。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBankTarget(null)}>キャンセル</Button>
          <Button variant="contained" color="success" onClick={runConfirmBankTransfer} disabled={confirmBankBusy}>
            {confirmBankBusy ? '処理中…' : '入金確認する'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
