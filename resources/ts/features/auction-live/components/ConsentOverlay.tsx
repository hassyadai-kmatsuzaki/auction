import React from 'react';
import { Box, Paper, Typography, Button, Divider, Chip } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface Props {
  onAgree: () => void;
  countdownSeconds?: number;
  priceIncrementRate?: number;
  priceIncrementMin?: number;
}

export const ConsentOverlay = React.memo(({ onAgree, countdownSeconds, priceIncrementRate, priceIncrementMin }: Props) => (
  <Box
    sx={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <Box
      sx={{
        position: 'absolute', inset: 0,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        bgcolor: 'rgba(0,0,0,0.4)',
      }}
    />
    <Paper
      elevation={8}
      sx={{ position: 'relative', zIndex: 1, maxWidth: 520, mx: 2, p: 4, borderRadius: 3, textAlign: 'center' }}
    >
      <Typography variant="h5" fontWeight="bold" gutterBottom>オークションルール確認</Typography>
      <Divider sx={{ my: 2 }} />

      {/* ルール説明 */}
      <Box sx={{ mb: 3, textAlign: 'left' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoIcon color="primary" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            画像は同じ品種のイメージ画像です。実際の映像は詳細ボタンよりご確認ください。
          </Typography>
        </Box>

        {/* 上がり幅 */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            bgcolor: '#f0f7ff', border: '1px solid', borderColor: 'primary.200',
            borderRadius: 2, p: 2, mb: 1.5,
          }}
        >
          <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">価格上昇幅</Typography>
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              {priceIncrementRate
                ? `現在価格の ${(priceIncrementRate * 100).toFixed(0)}%`
                : '—'}
              {priceIncrementMin
                ? <Chip label={`最低 ¥${priceIncrementMin.toLocaleString()}`} size="small" sx={{ ml: 1, fontWeight: 600 }} />
                : null}
            </Typography>
          </Box>
        </Box>

        {/* カウントダウン秒数 */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            bgcolor: '#fff7ed', border: '1px solid', borderColor: 'warning.200',
            borderRadius: 2, p: 2,
          }}
        >
          <TimerIcon sx={{ color: 'warning.main', fontSize: 28 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">カウントダウン秒数</Typography>
            <Typography variant="h6" fontWeight="bold" color="warning.main">
              {countdownSeconds ? `${countdownSeconds}秒` : '—'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        上記ルールに同意の上、オークションにご参加ください。
      </Typography>

      <Button
        variant="contained" size="large" fullWidth onClick={onAgree}
        sx={{ py: 1.5, fontWeight: 'bold', fontSize: '1rem' }}
      >
        同意してオークションに参加する
      </Button>
    </Paper>
  </Box>
));

ConsentOverlay.displayName = 'ConsentOverlay';
