import React from 'react';
import {
  Box, Paper, Typography, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Timer as TimerIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { PriceIncrementTier, CountdownTier } from '../../../types';

interface Props {
  onAgree: () => void;
  priceIncrementTiers?: PriceIncrementTier[];
  countdownTiers?: CountdownTier[];
}

const formatPrice = (v: number) => `¥${v.toLocaleString()}`;

export const ConsentOverlay = React.memo(({ onAgree, priceIncrementTiers, countdownTiers }: Props) => (
  <Box
    sx={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'auto', py: 2,
    }}
  >
    <Box
      sx={{
        position: 'fixed', inset: 0,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        bgcolor: 'rgba(0,0,0,0.4)',
      }}
    />
    <Paper
      elevation={8}
      sx={{ position: 'relative', zIndex: 1, maxWidth: 600, mx: 2, p: { xs: 2.5, sm: 4 }, borderRadius: 3, textAlign: 'center' }}
    >
      <Typography variant="h5" fontWeight="bold" gutterBottom>オークションルール確認</Typography>
      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <InfoIcon color="primary" fontSize="small" />
        <Typography variant="body2" color="text.secondary" textAlign="left">
          画像は同じ品種のイメージ画像です。実際の映像は詳細ボタンよりご確認ください。
        </Typography>
      </Box>

      {/* 金額帯別上昇幅テーブル */}
      {priceIncrementTiers && priceIncrementTiers.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
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
                {priceIncrementTiers.map((tier, i) => (
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
      )}

      {/* 金額帯別カウントダウン秒数テーブル */}
      {countdownTiers && countdownTiers.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
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
                {countdownTiers.map((tier, i) => (
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
      )}

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
