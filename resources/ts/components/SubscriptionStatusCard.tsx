import { useEffect, useState } from 'react';
import {
  Paper, Typography, Chip, Button, Stack, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { AccountBalance } from '@mui/icons-material';
import axios from '../lib/axios';
import SubscriptionRegisterModal from './SubscriptionRegisterModal';
import BankTransferInfoModal from './BankTransferInfoModal';

interface Plan { id: number; name: string; amount: number; allows_bid: boolean; allows_sell: boolean; duration_days?: number | null; }
interface Subscription {
  id: number;
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'suspended';
  plan: Plan | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: string | null;
  card_exp_year: string | null;
  current_period_end: string | null;
}

const STATUS_LABEL = {
  active:    { label: '有効', color: 'success' as const },
  pending:   { label: '未課金', color: 'default' as const },
  past_due:  { label: '支払失敗', color: 'warning' as const },
  suspended: { label: '停止中', color: 'error' as const },
  canceled:  { label: '解約済', color: 'default' as const },
};

const formatYen = (n: number) => '¥' + new Intl.NumberFormat('ja-JP').format(n);
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ja-JP') : '-';

export default function SubscriptionStatusCard() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [bankInfoOpen, setBankInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 自動更新の停止・再開（F-086）。停止しても期間満了までは利用できる
  const [autoRenewStopped, setAutoRenewStopped] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [savingAutoRenew, setSavingAutoRenew] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const updateAutoRenew = async (enabled: boolean) => {
    if (savingAutoRenew) return;
    setSavingAutoRenew(true);
    setError(null);
    try {
      const res = await axios.put('/api/me/subscription/auto-renew', { enabled });
      setAutoRenewStopped(res.data.data.auto_renew_stopped);
      setInfo(res.data.message);
      setConfirmStopOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '更新に失敗しました');
    } finally {
      setSavingAutoRenew(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/me/subscription');
      const d = res.data.data;
      setSub(d.subscription);
      setAutoRenewStopped(!!d.auto_renew_stopped);

      // 直近の payment から決済手段を判定（subscription レスポンスに付随）
      const lastPayment = d.subscription?.payments?.[0];
      setPaymentMethod(lastPayment?.method ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return null;

  const status = sub ? STATUS_LABEL[sub.status] : null;
  const isBankTransfer = paymentMethod === 'bank_transfer';

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>年会費プラン</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}

      {!sub ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Typography>現在プランに加入していません。</Typography>
          <Button variant="contained" onClick={() => setPlanModalOpen(true)}>プランに加入する</Button>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography fontWeight={600}>{sub.plan?.name ?? '-'}</Typography>
            {status && <Chip size="small" label={status.label} color={status.color} />}
            {isBankTransfer && (
              <Chip
                size="small"
                icon={<AccountBalance fontSize="small" />}
                label="銀行振込"
                variant="outlined"
              />
            )}
          </Stack>
          {sub.plan && (
            <Typography variant="body2" color="text.secondary">
              年会費: {formatYen(sub.plan.amount)}（税込）／ 次回更新: {fmtDate(sub.current_period_end)}
            </Typography>
          )}

          <Divider sx={{ my: 1 }} />

          {isBankTransfer ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ sm: 'center' }}
              spacing={1}
            >
              <Typography variant="body2">
                お支払い方法: 銀行振込（手数料はお客様ご負担）
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setBankInfoOpen(true)}>
                振込先を表示
              </Button>
            </Stack>
          ) : (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ sm: 'center' }}
              spacing={1}
            >
              <Typography variant="body2">
                登録カード: {sub.card_brand && sub.card_last4
                  ? `${sub.card_brand} ****${sub.card_last4} (${sub.card_exp_month}/${sub.card_exp_year})`
                  : '未登録'}
              </Typography>
              <Stack direction="row" spacing={1}>
                {(sub.status === 'past_due' || sub.status === 'suspended' || sub.status === 'active') && (
                  <Button size="small" variant="outlined" onClick={() => setCardModalOpen(true)}>カードを更新</Button>
                )}
                {sub.status === 'canceled' && (
                  <Button size="small" variant="contained" onClick={() => setPlanModalOpen(true)}>再加入</Button>
                )}
              </Stack>
            </Stack>
          )}

          {/* 自動更新の停止・再開（F-086）。年会費プラン（単発プラン以外）の有効な契約のみ */}
          {sub.status === 'active' && sub.plan && !sub.plan.duration_days && (
            autoRenewStopped ? (
              <Alert
                severity="info"
                action={<Button color="inherit" size="small" onClick={() => updateAutoRenew(true)} disabled={savingAutoRenew}>自動更新を再開</Button>}
              >
                自動更新を停止しています。{fmtDate(sub.current_period_end)} までご利用いただけます（以降は自動で解約になります）。
              </Alert>
            ) : (
              <Stack direction="row" justifyContent="flex-end">
                <Button size="small" color="inherit" sx={{ color: 'text.secondary' }} onClick={() => setConfirmStopOpen(true)}>
                  自動更新を停止（解約）
                </Button>
              </Stack>
            )
          )}

          {!isBankTransfer && sub.status === 'past_due' && (
            <Alert severity="warning">年会費のお支払いに失敗しました。カード情報を更新してください。</Alert>
          )}
          {!isBankTransfer && sub.status === 'suspended' && (
            <Alert severity="error">アカウントが停止中です。カードを再登録して再課金すると利用を再開できます。</Alert>
          )}
        </Stack>
      )}

      <SubscriptionRegisterModal
        open={cardModalOpen}
        replaceCardOnly
        onClose={() => setCardModalOpen(false)}
        onCompleted={() => { setCardModalOpen(false); load(); }}
      />
      <SubscriptionRegisterModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onCompleted={() => { setPlanModalOpen(false); load(); }}
      />
      <BankTransferInfoModal
        open={bankInfoOpen}
        onClose={() => setBankInfoOpen(false)}
      />
      <Dialog open={confirmStopOpen} onClose={() => !savingAutoRenew && setConfirmStopOpen(false)}>
        <DialogTitle>自動更新を停止しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {fmtDate(sub?.current_period_end ?? null)} まではこれまでどおりご利用いただけます。
            その日以降は年会費の自動更新（再課金）を行わず、解約になります。期間中であれば再開もできます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmStopOpen(false)} disabled={savingAutoRenew}>やめる</Button>
          <Button variant="contained" color="error" onClick={() => updateAutoRenew(false)} disabled={savingAutoRenew}>停止する</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
