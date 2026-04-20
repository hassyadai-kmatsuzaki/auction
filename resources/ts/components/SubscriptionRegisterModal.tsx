import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Stack, Paper, CircularProgress, Alert, Chip, RadioGroup, Radio, FormControlLabel,
} from '@mui/material';
import axios from '../lib/axios';

// window.Square は Square Web Payments SDK から注入される
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [squarePublic, setSquarePublic] = useState<SquarePublic | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const cardInstanceRef = useRef<any>(null);
  const paymentsInstanceRef = useRef<any>(null);

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
      // デフォルト選択
      if (!replaceCardOnly) {
        const activePlans = (d.plans as Plan[]).filter((p) => p.is_active);
        if (activePlans.length > 0) setSelectedPlanId(activePlans[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'プラン情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [replaceCardOnly]);

  useEffect(() => {
    if (open) fetchInit();
  }, [open, fetchInit]);

  // Square Card UI を生成
  useEffect(() => {
    if (!open || !squarePublic || !squarePublic.application_id || !squarePublic.location_id) return;

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
  }, [open, squarePublic]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
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

  const activePlans = plans.filter((p) => p.is_active);
  const disabledSubmit = submitting || loading || (!replaceCardOnly && !selectedPlanId);

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm" disableEscapeKeyDown={submitting}>
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
                サービスをご利用いただくには、年会費プランへの加入とカード登録が必要です。プランを選択して、カード情報を入力してください。
              </Typography>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!replaceCardOnly && (
              <>
                <Typography variant="subtitle1" fontWeight={600}>プランを選択</Typography>
                {activePlans.length === 0 ? (
                  <Alert severity="warning">現在加入可能なプランがありません。管理者にお問い合わせください。</Alert>
                ) : (
                  <RadioGroup value={selectedPlanId ?? ''} onChange={(e) => setSelectedPlanId(Number(e.target.value))}>
                    <Stack spacing={1}>
                      {activePlans.map((p) => (
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
              </>
            )}

            {replaceCardOnly && subscription && (
              <Alert severity="info">
                現在のプラン: <b>{subscription.plan?.name}</b> / 現在のカード: {subscription.card_brand ? `${subscription.card_brand} ****${subscription.card_last4}` : '未登録'}
              </Alert>
            )}

            <Typography variant="subtitle1" fontWeight={600}>カード情報</Typography>
            <Paper variant="outlined" sx={{ p: 2, minHeight: 70 }}>
              <div ref={cardContainerRef} id="square-card-container" />
            </Paper>
            <Typography variant="caption" color="text.secondary">
              カード情報は Square に直接送信され、当社サーバーでは保持しません。
            </Typography>
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
          {submitting ? '処理中…' : (replaceCardOnly ? 'カードを更新' : 'プランに加入して支払う')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
