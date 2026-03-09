import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, CircularProgress, Button } from '@mui/material';
import { Timer as TimerIcon, ListAlt as ListAltIcon } from '@mui/icons-material';

interface WaitingRoomProps {
  title: string;
  auctionId: number;
  startAt?: string;
  venueOpenMinutes?: number;
  message?: string;
}

interface EntranceBlockedProps extends WaitingRoomProps {
  entranceCountdown: string | null;
}

/** 待機室（入室可能・オークション開始待ち） */
export const WaitingRoom = React.memo(({ title, auctionId }: WaitingRoomProps) => {
  const navigate = useNavigate();
  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={6} sx={{ maxWidth: 500, mx: 2, p: 5, textAlign: 'center', borderRadius: 3 }}>
        <TimerIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" fontWeight="bold" gutterBottom>{title}</Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          オークション開始をお待ちください
        </Typography>
        <Box sx={{ bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200', borderRadius: 2, p: 3, mb: 3 }}>
          <CircularProgress size={30} sx={{ mb: 1 }} />
          <Typography variant="body1" color="text.secondary">まもなく開始されます...</Typography>
        </Box>
        <Button
          variant="outlined"
          size="large"
          startIcon={<ListAltIcon />}
          onClick={() => navigate(`/participant/auction/${auctionId}/items`)}
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
});

/** 入室不可画面 */
export const EntranceBlocked = React.memo(
  ({ title, auctionId, startAt, venueOpenMinutes, message, entranceCountdown }: EntranceBlockedProps) => {
    const navigate = useNavigate();
    return (
      <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper elevation={6} sx={{ maxWidth: 500, mx: 2, p: 5, textAlign: 'center', borderRadius: 3 }}>
          <TimerIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
          <Typography variant="h4" fontWeight="bold" gutterBottom>{title}</Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            {message ?? `オークション開始${venueOpenMinutes ?? 30}分前から入室できます`}
          </Typography>
          {entranceCountdown && (
            <Box sx={{ bgcolor: 'warning.50', border: '2px solid', borderColor: 'warning.300', borderRadius: 2, p: 3, mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>入室可能まで</Typography>
              <Typography variant="h3" fontWeight="bold" color="warning.main">{entranceCountdown}</Typography>
            </Box>
          )}
          <Button
            variant="outlined"
            size="large"
            startIcon={<ListAltIcon />}
            onClick={() => navigate(`/participant/auction/${auctionId}/items`)}
            sx={{ fontWeight: 700, mb: 2 }}
          >
            出品一覧を見る
          </Button>
          {startAt && (
            <Typography variant="body2" color="text.secondary">
              オークション開始予定: {new Date(startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
        </Paper>
      </Box>
    );
  }
);

/** 開始カウントダウン画面 */
export const StartingCountdown = React.memo(
  ({ title, count }: { title: string; count: number }) => (
    <Box sx={{ bgcolor: '#1a1a2e', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <Typography variant="h5" sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}>{title}</Typography>
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
  )
);

WaitingRoom.displayName = 'WaitingRoom';
EntranceBlocked.displayName = 'EntranceBlocked';
StartingCountdown.displayName = 'StartingCountdown';
