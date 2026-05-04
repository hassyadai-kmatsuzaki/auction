import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Stack, Paper, CircularProgress, Alert, Chip, RadioGroup, Radio, FormControlLabel,
  Divider,
} from '@mui/material';
import { CreditCard, AccountBalance } from '@mui/icons-material';
import axios from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    Square?: any;
  }
}

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  amount: number;
  allows_bid: boolean;
  allows_sell: boolean;
  is_active: boolean;
}

interface SquarePublic {
  application_id: string;
  location_id: string;
  environment: string;
}

interface Subscription {
  id: number;
  status: string;
  plan: Plan | null;
  card_brand: string | null;
  card_last4: string | null;
  current_period_end: string | null;
}

type PaymentMethod = 'card' | 'bank_transfer';

interface Props {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  /** カード再登録モードの場合 true（プラン選択はスキップ） */
  replaceCardOnly?: boolean;
}

const formatYen = (n: number) => '¥' + new Intl.NumberFormat('ja-JP').format(n);

const SQUARE_SDK_URL_PROD    = 'https://web.squarecdn.com/v1/square.js';
const SQUARE_SDK_URL_SANDBOX = 'https://sandbox.web.squarecdn.com/v1/square.js';

function loadSquareSdk(env: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Square) return resolve();
    const src = env === 'production' ? SQUARE_SDK_URL_PROD : SQUARE_SDK_URL_SANDBOX;
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Square SDK 読み込み失敗')));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Square SDK 読み込み失敗'));
    document.head.appendChild(s);
  });
}

export default function SubscriptionRegisterModal({ open, onClose, onCompleted, replaceCardOnly = false }: Props) {
  const { hasRole, refreshUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [squarePublic, setSquarePublic] = useState<SquarePublic | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const cardInstanceRef = useRef<any>(null);
  const paymentsInstanceRef = useRef<any>(null);

  const isSeller = hasRole('seller');

  // ロール別プラン: 出品者は allows_sell=true のプランのみ、落札者は allows_sell=false のプランのみ
  const visiblePlans = useMemo(() => {
    const active = plans.filter((p) => p.is_active);
    return isSeller
      ? active.filter((p) => p.allows_sell)
      : active.filter((p) => !p.allows_sell);
  }, [plans, isSeller]);

  // 初期ロード: 自分のサブスク情報 + プラン + Square 公開情報
  const fetchInit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/me/subscription');
      const d = res.data.data;
      setPlans(d.plans as Plan[]);
      setSubscription(d.subscription);
      setSquarePublic(d.square_public as SquarePublic);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'プラン情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchInit();
  }, [open, fetchInit]);

  // ロール別プランのデフォルト選択
  useEffect(() => {
    if (replaceCardOnly) return;
    if (visiblePlans.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    if (!selectedPlanId || !visiblePlans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(visiblePlans[0].id);
    }
  }, [visiblePlans, replaceCardOnly, selectedPlanId]);

  // Square Card UI を生成（カード払い時のみ）
  useEffect(() => {
    if (!open || paymentMethod !== 'card' || !squarePublic || !squarePublic.application_id || !squarePublic.location_id) return;

    let cancelled = false;
    (async () => {
      try {
        await loadSquareSdk(squarePublic.environment);
        if (cancelled) return;
        if (!window.Square) {
          setError('Square SDK を読み込めませんでした');
          return;
        }
        const payments = window.Square.payments(squarePublic.application_id, squarePublic.location_id);
        paymentsInstanceRef.current = payments;

        const card = await payments.card();
        if (cancelled) return;
        if (cardContainerRef.current) {
          await card.attach(cardContainerRef.current);
        }
        cardInstanceRef.current = card;
      } catch (e: any) {
        setError('カード入力フォームの初期化に失敗しました: ' + (e?.message ?? ''));
      }
    })();

    return () => {
      cancelled = true;
      if (cardInstanceRef.current) {
        try { cardInstanceRef.current.destroy(); } catch {}
        cardInstanceRef.current = null;
      }
    };
  }, [open, squarePublic, paymentMethod]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // 銀行振込フロー
      if (!replaceCardOnly && paymentMethod === 'bank_transfer') {
        if (!selectedPlanId) throw new Error('プランを選択してください');
        await axios.post('/api/me/subscription', {
          plan_id: selectedPlanId,
          payment_method: 'bank_transfer',
        });
        await refreshUser();
        onCompleted();
        return;
      }

      // カード払い: トークン取得
      if (!cardInstanceRef.current) throw new Error('カード入力が初期化されていません');

      const tokenResult = await cardInstanceRef.current.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const msg = (tokenResult.errors || []).map((e: any) => e.message).join(' / ') || 'カード情報の処理に失敗しました';
        throw new Error(msg);
      }

      // SCA 検証（あれば）
      let verificationToken: string | undefined;
      if (!replaceCardOnly && paymentsInstanceRef.current && selectedPlanId) {
        const plan = plans.find((p) => p.id === selectedPlanId);
        if (plan) {
          try {
            const verify = await paymentsInstanceRef.current.verifyBuyer(tokenResult.token, {
              amount: String(plan.amount),
              billingContact: {},
              currencyCode: 'JPY',
              intent: 'CHARGE',
            });
            verificationToken = verify?.token;
          } catch {
            // SCA 非対応環境では無視
          }
        }
      }

      if (replaceCardOnly) {
        await axios.put('/api/me/subscription/card', {
          source_id: tokenResult.token,
          verification_token: verificationToken,
        });
      } else {
        if (!selectedPlanId) throw new Error('プランを選択してください');
        await axios.post('/api/me/subscription', {
          plan_id: selectedPlanId,
          payment_method: 'card',
          source_id: tokenResult.token,
          verification_token: verificationToken,
        });
      }

      onCompleted();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? '処理に失敗しました';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const disabledSubmit =
    submitting ||
    loading ||
    (!replaceCardOnly && !selectedPlanId) ||
    (!replaceCardOnly && visiblePlans.length === 0);

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        if (submitting) return;
        if (!replaceCardOnly && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
        onClose();
      }}
      fullWidth
      maxWidth="sm"
      disableEscapeKeyDown={submitting || !replaceCardOnly}
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
      <DialogTitle sx={{ pb: 1 }}>
        {replaceCardOnly ? 'カード情報の更新' : '年会費プラン加入'}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2}>
            {!replaceCardOnly && (
              <Typography variant="body2" color="text.secondary">
                {isSeller
                  ? '出品者向けプラン（出品者兼落札者用）への加入が必要です。プランと決済方法を選択してください。'
                  : '落札者用プランへの加入が必要です。プランと決済方法を選択してください。'}
              </Typography>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!replaceCardOnly && (
              <>
                <Typography variant="subtitle1" fontWeight={600}>プランを選択</Typography>
                {visiblePlans.length === 0 ? (
                  <Alert severity="warning">
                    {isSeller
                      ? '現在加入可能な出品者用プランがありません。管理者にお問い合わせください。'
                      : '現在加入可能な落札者用プランがありません。管理者にお問い合わせください。'}
                  </Alert>
                ) : (
                  <RadioGroup value={selectedPlanId ?? ''} onChange={(e) => setSelectedPlanId(Number(e.target.value))}>
                    <Stack spacing={1}>
                      {visiblePlans.map((p) => (
                        <Paper key={p.id} variant="outlined" sx={{ p: 2, cursor: 'pointer',
                          borderColor: selectedPlanId === p.id ? 'primary.main' : 'divider',
                          bgcolor: selectedPlanId === p.id ? 'action.hover' : 'transparent',
                        }} onClick={() => setSelectedPlanId(p.id)}>
                          <FormControlLabel
                            value={p.id}
                            control={<Radio />}
                            sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                            label={
                              <Box sx={{ ml: 1, width: '100%' }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                  <Box>
                                    <Typography fontWeight={600}>{p.name}</Typography>
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                      {p.allows_bid && <Chip size="small" label="落札" color="primary" />}
                                      {p.allows_sell && <Chip size="small" label="出品" color="secondary" />}
                                    </Stack>
                                    {p.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{p.description}</Typography>}
                                  </Box>
                                  <Box textAlign="right">
                                    <Typography variant="h6" fontWeight={700}>{formatYen(p.amount)}</Typography>
                                    <Typography variant="caption" color="text.secondary">/年（税込）</Typography>
                                  </Box>
                                </Stack>
                              </Box>
                            }
                          />
                        </Paper>
                      ))}
                    </Stack>
                  </RadioGroup>
                )}

                <Divider />

                <Typography variant="subtitle1" fontWeight={600}>決済方法を選択</Typography>
                <RadioGroup
                  row
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <FormControlLabel
                    value="card"
                    control={<Radio />}
                    label={
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <CreditCard fontSize="small" />
                        <span>クレジットカード</span>
                      </Stack>
                    }
                    sx={{ mr: 3 }}
                  />
                  <FormControlLabel
                    value="bank_transfer"
                    control={<Radio />}
                    label={
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <AccountBalance fontSize="small" />
                        <span>銀行振込</span>
                      </Stack>
                    }
                  />
                </RadioGroup>
              </>
            )}

            {replaceCardOnly && subscription && (
              <Alert severity="info">
                現在のプラン: <b>{subscription.plan?.name}</b> / 現在のカード: {subscription.card_brand ? `${subscription.card_brand} ****${subscription.card_last4}` : '未登録'}
              </Alert>
            )}

            {(replaceCardOnly || paymentMethod === 'card') && (
              <>
                <Typography variant="subtitle1" fontWeight={600}>カード情報</Typography>
                <Paper variant="outlined" sx={{ p: 2, minHeight: 70 }}>
                  <div ref={cardContainerRef} id="square-card-container" />
                </Paper>
                <Typography variant="caption" color="text.secondary">
                  カード情報は Square に直接送信され、当社サーバーでは保持しません。
                </Typography>
              </>
            )}

            {!replaceCardOnly && paymentMethod === 'bank_transfer' && (
              <Alert severity="info" variant="outlined">
                お申し込み後に振込先情報をご案内します。振込手数料はお客様負担となります。
                <br />
                【銀行振込で申し込む】を押していただけると、すぐに使えるようになります。
                <br />
                5月18日までに指定の口座へお振込ください。
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {!replaceCardOnly ? null : (
          <Button onClick={onClose} disabled={submitting}>キャンセル</Button>
        )}
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disabledSubmit}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          {submitting
            ? '処理中…'
            : replaceCardOnly
              ? 'カードを更新'
              : paymentMethod === 'bank_transfer'
                ? '銀行振込で申し込む'
                : 'プランに加入して支払う'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
