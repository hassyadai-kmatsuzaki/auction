import { useEffect, useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Stack, Alert, Chip, IconButton, CircularProgress, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper,
} from '@mui/material';
import { Close, NotificationsActive, MailOutline } from '@mui/icons-material';
import axios from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

interface RenewalUser {
  id: number;
  name: string;
  email: string;
  company_name: string | null;
  bank_transfer_confirmed_at: string | null;
  subscription: {
    id: number;
    status: string;
    plan_name: string | null;
    plan_amount: number | null;
    current_period_end: string | null;
  };
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('ja-JP') : '-');
const formatYen = (n: number | null) => (n != null ? '¥' + new Intl.NumberFormat('ja-JP').format(n) : '-');

const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * 管理者ログイン時に、銀行振込モードかつ更新期限が30日以内に迫っているユーザー一覧を
 * モーダルで表示する。各ユーザーに対して「更新案内を発行」ボタンで振込モーダルの再表示を
 * トリガーできる。1セッション内では閉じれば再表示しない。
 */
export default function BankTransferRenewalsAlert() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<RenewalUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRenewals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/admin/users-bank-transfer-renewals');
      const list = (res.data?.data?.users ?? []) as RenewalUser[];
      setUsers(list);
      if (list.length > 0) setOpen(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    // セッション中に一度だけ自動で取得
    if (sessionStorage.getItem('bt_renewals_dismissed') === '1') return;
    fetchRenewals();
  }, [isAdmin, fetchRenewals]);

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem('bt_renewals_dismissed', '1');
  };

  const handleRenew = async (userId: number) => {
    setActingId(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await axios.post(`/api/admin/users/${userId}/renew-bank-transfer`);
      setSuccess(res.data?.message ?? '更新案内を発行しました');
      // 一覧から該当ユーザーを除外（次回ログイン以降の振込で confirmBankTransfer されるまでは表示し続ける必要があるが、当画面では「対応済」として消す）
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '処理に失敗しました');
    } finally {
      setActingId(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0,0,0,0.45)',
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <NotificationsActive color="warning" fontSize="small" />
        <span>銀行振込の更新時期が近いユーザー</span>
        <IconButton
          aria-label="閉じる"
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            銀行振込で年会費プランにご加入中のユーザーのうち、次回更新日まで30日以内のユーザーです。
            「更新案内」を押すと、対象ユーザーが次にログインしたときに振込情報モーダルが再表示されます。
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}

          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : users.length === 0 ? (
            <Alert severity="success">対応が必要なユーザーはありません。</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ユーザー</TableCell>
                    <TableCell>プラン</TableCell>
                    <TableCell>次回更新</TableCell>
                    <TableCell>残日数</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => {
                    const days = daysUntil(u.subscription.current_period_end);
                    const overdue = days !== null && days < 0;
                    return (
                      <TableRow key={u.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <MailOutline fontSize="inherit" /> {u.email}
                          </Typography>
                          {u.company_name && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {u.company_name}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{u.subscription.plan_name ?? '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatYen(u.subscription.plan_amount)}</Typography>
                        </TableCell>
                        <TableCell>{fmtDate(u.subscription.current_period_end)}</TableCell>
                        <TableCell>
                          {days === null ? (
                            '-'
                          ) : overdue ? (
                            <Chip size="small" color="error" label={`${Math.abs(days)}日経過`} />
                          ) : days <= 7 ? (
                            <Chip size="small" color="warning" label={`残${days}日`} />
                          ) : (
                            <Chip size="small" label={`残${days}日`} variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="更新案内モーダルをユーザーに再表示">
                            <span>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={actingId === u.id}
                                onClick={() => handleRenew(u.id)}
                              >
                                {actingId === u.id ? '処理中…' : '更新案内'}
                              </Button>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
