/**
 * デモ用待機室コンポーネント
 * 入室まで3秒 → 入室後に3秒カウントダウン → オークション開始
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Paper, LinearProgress, Chip,
} from '@mui/material';
import {
  MeetingRoom as MeetingRoomIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';

interface DemoWaitingRoomProps {
  auctionTitle: string;
  onAuctionStart: () => void;
}

type Phase = 'entering' | 'entered' | 'starting';

export function DemoWaitingRoom({ auctionTitle, onAuctionStart }: DemoWaitingRoomProps) {
  const [phase, setPhase] = useState<Phase>('entering');
  const [countdown, setCountdown] = useState(3);

  const startEnteredCountdown = useCallback(() => {
    setPhase('entered');
    setCountdown(3);
  }, []);

  // Phase 1: 入室カウントダウン (3秒)
  useEffect(() => {
    if (phase !== 'entering') return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          startEnteredCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, startEnteredCountdown]);

  // Phase 2: 開始カウントダウン (3秒)
  useEffect(() => {
    if (phase !== 'entered') return;
    const timer = setInterval(() => {
      setCountdown(prev => {
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

  // Phase 3: オークション開始
  useEffect(() => {
    if (phase !== 'starting') return;
    const timer = setTimeout(onAuctionStart, 500);
    return () => clearTimeout(timer);
  }, [phase, onAuctionStart]);

  const totalSeconds = 3;
  const progress = phase === 'entering'
    ? ((totalSeconds - countdown) / totalSeconds) * 50
    : phase === 'entered'
      ? 50 + ((totalSeconds - countdown) / totalSeconds) * 50
      : 100;

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #1565c0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Container maxWidth="sm">
        <Paper sx={{
          p: { xs: 4, md: 6 }, textAlign: 'center',
          borderRadius: 3, bgcolor: 'rgba(255,255,255,0.97)',
        }}>
          {/* アイコン */}
          <Box sx={{
            width: 80, height: 80, borderRadius: '50%',
            bgcolor: phase === 'entering' ? 'primary.50' : phase === 'entered' ? 'success.50' : 'warning.50',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 3,
            transition: 'background-color 0.3s',
          }}>
            {phase === 'entering' ? (
              <MeetingRoomIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            ) : (
              <TimerIcon sx={{ fontSize: 40, color: phase === 'entered' ? 'success.main' : 'warning.main' }} />
            )}
          </Box>

          {/* タイトル */}
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
            {auctionTitle}
          </Typography>

          {/* 状態表示 */}
          <Chip
            label={
              phase === 'entering' ? '待機室に入室中...'
              : phase === 'entered' ? '入室完了！オークション開始準備中'
              : 'オークション開始！'
            }
            color={phase === 'entering' ? 'primary' : phase === 'entered' ? 'success' : 'warning'}
            sx={{ mb: 3, fontWeight: 700 }}
          />

          {/* カウントダウン */}
          {phase !== 'starting' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h1" fontWeight="bold" sx={{
                fontSize: '5rem', color: phase === 'entering' ? 'primary.main' : 'success.main',
                lineHeight: 1,
                animation: 'pulse 1s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                },
              }}>
                {countdown}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {phase === 'entering' ? '入室まで' : 'オークション開始まで'}
              </Typography>
            </Box>
          )}

          {phase === 'starting' && (
            <Typography variant="h4" fontWeight="bold" color="warning.main" sx={{
              mb: 3,
              animation: 'fadeIn 0.5s',
              '@keyframes fadeIn': { from: { opacity: 0, transform: 'scale(0.8)' }, to: { opacity: 1, transform: 'scale(1)' } },
            }}>
              START!
            </Typography>
          )}

          {/* プログレスバー */}
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8, borderRadius: 4,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': { borderRadius: 4, transition: 'transform 0.5s ease' },
            }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            {phase === 'entering' && '待機室への入室処理中です...'}
            {phase === 'entered' && '他の参加者も続々入室しています'}
            {phase === 'starting' && 'オークション会場に移動します'}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
