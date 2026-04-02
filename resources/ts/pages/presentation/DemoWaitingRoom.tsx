/**
 * デモ用待機室コンポーネント
 * Phase 1 (3秒): WaitingRoom デザイン（実物と同一）
 * Phase 2 (3秒): StartingCountdown デザイン（実物と同一）
 * → onAuctionStart
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, CircularProgress, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Timer as TimerIcon,
  ListAlt as ListAltIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

interface DemoWaitingRoomProps {
  auctionTitle: string;
  onAuctionStart: () => void;
}

type Phase = 'waiting' | 'countdown' | 'starting';

const formatPrice = (v: number) => `¥${v.toLocaleString()}`;

const PRICE_INCREMENT_TIERS = [
  { from_price: 0, to_price: 999, increment_amount: 100 },
  { from_price: 1000, to_price: 4999, increment_amount: 200 },
  { from_price: 5000, to_price: 9999, increment_amount: 500 },
  { from_price: 10000, to_price: null as number | null, increment_amount: 1000 },
];

const COUNTDOWN_TIERS = [
  { from_price: 0, to_price: 999, bid_countdown_seconds: 10, freeze_countdown_seconds: 3 },
  { from_price: 1000, to_price: 4999, bid_countdown_seconds: 12, freeze_countdown_seconds: 3 },
  { from_price: 5000, to_price: null as number | null, bid_countdown_seconds: 15, freeze_countdown_seconds: 3 },
];

export function DemoWaitingRoom({ auctionTitle, onAuctionStart }: DemoWaitingRoomProps) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [count, setCount] = useState(3);

  const startCountdownPhase = useCallback(() => {
    setPhase('countdown');
    setCount(3);
  }, []);

  // Phase 1: WaitingRoom (3 seconds)
  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setTimeout(() => {
      startCountdownPhase();
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, startCountdownPhase]);

  // Phase 2: StartingCountdown (3, 2, 1)
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('starting');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Phase 3: transition to auction
  useEffect(() => {
    if (phase !== 'starting') return;
    const timer = setTimeout(onAuctionStart, 500);
    return () => clearTimeout(timer);
  }, [phase, onAuctionStart]);

  // ─── StartingCountdown phase ───
  if (phase === 'countdown' || phase === 'starting') {
    return (
      <Box sx={{ bgcolor: '#1a1a2e', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography variant="h5" sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}>{auctionTitle}</Typography>
        <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)', mb: 4 }}>オークションが間もなく開始されます</Typography>
        <Box
          sx={{
            width: 180, height: 180, borderRadius: '50%', border: '6px solid',
            borderColor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 4, animation: 'pulse 1s infinite',
            '@keyframes pulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.5)' },
              '70%': { boxShadow: '0 0 0 30px rgba(25, 118, 210, 0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
            },
          }}
        >
          <Typography variant="h1" sx={{ color: 'white', fontWeight: 'bold', fontSize: '5rem' }}>{count}</Typography>
        </Box>
      </Box>
    );
  }

  // ─── WaitingRoom phase ───
  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
      <Paper elevation={6} sx={{ maxWidth: 600, mx: 2, p: { xs: 3, sm: 5 }, textAlign: 'center', borderRadius: 3 }}>
        <TimerIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" fontWeight="bold" gutterBottom>{auctionTitle}</Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          オークション開始をお待ちください
        </Typography>

        {/* 金額帯別上昇幅テーブル */}
        <Box sx={{ mb: 2.5, textAlign: 'left' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
              金額帯別上昇幅テーブル
            </Typography>
          </Box>
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f0f7ff' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>下限金額</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>上限金額</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>上昇幅</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {PRICE_INCREMENT_TIERS.map((tier, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{formatPrice(tier.from_price)}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{tier.to_price !== null ? formatPrice(tier.to_price) : '上限なし'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatPrice(tier.increment_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* 金額帯別カウントダウン秒数テーブル */}
        <Box sx={{ mb: 2.5, textAlign: 'left' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TimerIcon sx={{ color: 'warning.main', fontSize: 22 }} />
            <Typography variant="subtitle2" fontWeight="bold" color="warning.main">
              金額帯別カウントダウン秒数テーブル
            </Typography>
          </Box>
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#fff7ed' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>下限金額</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>上限金額</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>落札カウント（秒）</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>フリーズ（秒）</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {COUNTDOWN_TIERS.map((tier, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{formatPrice(tier.from_price)}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{tier.to_price !== null ? formatPrice(tier.to_price) : '上限なし'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{tier.bid_countdown_seconds}秒</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{tier.freeze_countdown_seconds}秒</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Box sx={{ bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200', borderRadius: 2, p: 3, mb: 3 }}>
          <CircularProgress size={30} sx={{ mb: 1 }} />
          <Typography variant="body1" color="text.secondary">まもなく開始されます...</Typography>
        </Box>
        <Button
          variant="outlined"
          size="large"
          startIcon={<ListAltIcon />}
          onClick={() => {}}
          sx={{ fontWeight: 700, mb: 2 }}
        >
          出品一覧を見る
        </Button>
        <Typography variant="caption" color="text.secondary" display="block">
          開始されると自動的に画面が切り替わります
        </Typography>
      </Paper>
    </Box>
  );
}
