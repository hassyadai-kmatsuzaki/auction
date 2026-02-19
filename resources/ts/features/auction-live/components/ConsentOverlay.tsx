import React from 'react';
import { Box, Paper, Typography, Button, Divider } from '@mui/material';

interface Props {
  onAgree: () => void;
}

export const ConsentOverlay = React.memo(({ onAgree }: Props) => (
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
      sx={{ position: 'relative', zIndex: 1, maxWidth: 480, mx: 2, p: 4, borderRadius: 3, textAlign: 'center' }}
    >
      <Typography variant="h5" fontWeight="bold" gutterBottom>ご確認ください</Typography>
      <Divider sx={{ my: 2 }} />
      <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
        画像は同じ品種のイメージ画像です。実際の映像は詳細ボタンよりご確認ください。
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
