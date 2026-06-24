import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, CircularProgress, Stack, Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  LockOpen as LockOpenIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

type Mode = 'normal' | 'auction' | 'custom' | 'unknown';

interface ScalingStatus {
  mode: Mode;
  instance_type: string | null;
  instance_state?: string | null;
  is_locked: boolean;
  last_action: {
    direction: 'up' | 'down';
    user_id: number;
    started_at: string;
    status: string;
  } | null;
  error?: string;
}

const MODE_LABEL: Record<Mode, string> = {
  normal: '通常モード',
  auction: 'オークションモード',
  custom: 'カスタム構成',
  unknown: '不明',
};

const MODE_COLOR: Record<Mode, 'success' | 'warning' | 'info' | 'default'> = {
  normal: 'success',
  auction: 'warning',
  custom: 'info',
  unknown: 'default',
};

export default function Scaling() {
  const [status, setStatus] = useState<ScalingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDirection, setDialogDirection] = useState<'up' | 'down' | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/scaling/status');
      setStatus(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const openDialog = (direction: 'up' | 'down') => {
    setDialogDirection(direction);
    setConfirmInput('');
    setDialogOpen(true);
  };

  const handleExecute = async () => {
    if (!dialogDirection) return;
    const endpoint = dialogDirection === 'up' ? '/api/admin/scaling/scale-up' : '/api/admin/scaling/scale-down';
    const confirmValue = dialogDirection === 'up' ? 'SCALE_UP' : 'SCALE_DOWN';

    setExecuting(true);
    try {
      const res = await axios.post(endpoint, { confirm: confirmValue });
      setMessage({ type: 'success', text: res.data.message });
      setDialogOpen(false);
      await fetchStatus();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.message ?? '実行に失敗しました' });
    } finally {
      setExecuting(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!confirm('ロックを解除しますか？実行中のスケーリングがある場合は二重実行の原因になります。')) return;
    try {
      await axios.post('/api/admin/scaling/release-lock');
      setMessage({ type: 'success', text: 'ロックを解除しました' });
      await fetchStatus();
    } catch {
      setMessage({ type: 'error', text: 'ロック解除に失敗しました' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const mode = status?.mode ?? 'unknown';
  const canScaleUp = mode === 'normal' && !status?.is_locked;
  const canScaleDown = mode === 'auction' && !status?.is_locked;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <CloudIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>インフラスケーリング</Typography>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {status?.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          状態取得エラー: {status.error}
        </Alert>
      )}

      {/* 現在のモード */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="caption" color="text.secondary">現在のモード</Typography>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1 }}>
                <Chip
                  label={MODE_LABEL[mode]}
                  color={MODE_COLOR[mode]}
                  sx={{ fontWeight: 600, fontSize: '1rem', py: 2.5 }}
                />
                <Typography variant="body1" color="text.secondary">
                  {status?.instance_type ?? '-'}
                  {status?.instance_state && ` (${status.instance_state})`}
                </Typography>
              </Stack>
            </Box>
            <Button startIcon={<RefreshIcon />} onClick={fetchStatus}>更新</Button>
          </Stack>

          {status?.is_locked && (
            <Alert severity="info" sx={{ mt: 2 }} action={
              <Button size="small" color="inherit" startIcon={<LockOpenIcon />} onClick={handleReleaseLock}>
                ロック解除
              </Button>
            }>
              スケーリング実行中のためロックされています
            </Alert>
          )}

          {status?.last_action && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">最終実行</Typography>
              <Typography variant="body2">
                {status.last_action.direction === 'up' ? 'スケールアップ' : 'スケールダウン'}
                {' / '}
                {new Date(status.last_action.started_at).toLocaleString('ja-JP')}
                {' / '}
                ステータス: {status.last_action.status}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* スケーリング実行 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>スケーリング実行</Typography>

        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TrendingUpIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight={600}>スケールアップ</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    通常モード (t3.small) → オークションモード (c6i.2xlarge) に切り替えます。
                    所要時間: 10〜20分、EC2 再起動あり。
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="warning"
                  disabled={!canScaleUp}
                  onClick={() => openDialog('up')}
                >
                  実行
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TrendingDownIcon color="success" />
                    <Typography variant="subtitle1" fontWeight={600}>スケールダウン</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    オークションモード (c6i.2xlarge) → 通常モード (t3.small) に戻します。
                    所要時間: 10〜20分、EC2 再起動あり。
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!canScaleDown}
                  onClick={() => openDialog('down')}
                >
                  実行
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Alert severity="warning" variant="outlined">
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>実行前の確認事項</Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, m: 0 }}>
            <li>EC2 再起動中は数分間のダウンタイムが発生します</li>
            <li>オークション開催中の実行は避けてください</li>
            <li>スケールアップは開催2日前、スケールダウンは開催2日後の実施を推奨</li>
            <li>実行結果は SNS (auction-alerts) にメール通知されます</li>
          </Typography>
        </Alert>
      </Paper>

      {/* 確認ダイアログ */}
      <Dialog open={dialogOpen} onClose={() => !executing && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogDirection === 'up' ? 'スケールアップの確認' : 'スケールダウンの確認'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {dialogDirection === 'up'
              ? 'EC2 / RDS / ElastiCache をオークションモードにスケールアップします。数分間のダウンタイムが発生します。'
              : 'EC2 / RDS / ElastiCache を通常モードにスケールダウンします。数分間のダウンタイムが発生します。'}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            実行するには下のフィールドに <strong>{dialogDirection === 'up' ? 'SCALE_UP' : 'SCALE_DOWN'}</strong> と入力してください。
          </Typography>
          <TextField
            fullWidth
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={dialogDirection === 'up' ? 'SCALE_UP' : 'SCALE_DOWN'}
            disabled={executing}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={executing}>キャンセル</Button>
          <Button
            variant="contained"
            color={dialogDirection === 'up' ? 'warning' : 'success'}
            disabled={executing || confirmInput !== (dialogDirection === 'up' ? 'SCALE_UP' : 'SCALE_DOWN')}
            onClick={handleExecute}
            startIcon={executing ? <CircularProgress size={16} /> : null}
          >
            {executing ? '実行中...' : '実行'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
