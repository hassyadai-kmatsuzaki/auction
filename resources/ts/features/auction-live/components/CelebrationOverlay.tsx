import React, { useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import confetti from 'canvas-confetti';

interface Props {
  speciesName: string;
  winningPrice: number;
}

export const CelebrationOverlay = React.memo(({ speciesName, winningPrice }: Props) => {
  useEffect(() => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff', '#9900ff', '#ff69b4'];

    // canvas-confettiが生成するcanvasをオーバーレイより上に表示
    const fixCanvasZIndex = () => {
      document.querySelectorAll('canvas').forEach(c => {
        if (c.style.position === 'fixed' && c.style.pointerEvents === 'none') {
          c.style.zIndex = '1501';
        }
      });
    };

    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      fixCanvasZIndex();
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    confetti({ particleCount: 150, spread: 100, origin: { x: 0.5, y: 0.5 }, colors });
    fixCanvasZIndex();
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={12}
        sx={{
          p: 4, borderRadius: 3, textAlign: 'center',
          bgcolor: 'rgba(255,255,255,0.95)', border: '3px solid', borderColor: 'warning.main',
          animation: 'celebrationPop 0.5s ease-out',
          '@keyframes celebrationPop': {
            '0%': { transform: 'scale(0.5)', opacity: 0 },
            '50%': { transform: 'scale(1.1)' },
            '100%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
      >
        <Typography variant="h2" sx={{ mb: 1 }}>🎉</Typography>
        <Typography variant="h5" fontWeight="bold" color="warning.dark" gutterBottom>
          落札おめでとうございます！
        </Typography>
        <Typography variant="h6" gutterBottom>{speciesName}</Typography>
        <Typography variant="h4" color="primary.main" fontWeight="bold">
          ¥{Math.floor(winningPrice).toLocaleString()}
        </Typography>
      </Paper>
    </Box>
  );
});

CelebrationOverlay.displayName = 'CelebrationOverlay';
