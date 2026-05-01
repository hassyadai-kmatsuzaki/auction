import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container, Paper, Typography, TextField, Button, Alert, Box, Link,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import axios from '../../lib/axios';
export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { userId?: number; forceLogoutOthers?: boolean }) ?? {};
  const userId = navState.userId;
  const initialForce = navState.forceLogoutOthers === true;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [forceLogoutDialogOpen, setForceLogoutDialogOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState('');

  if (!userId) {
    navigate('/login', { replace: true });
    return null;
  }

  const performVerify = async (codeValue: string, forceLogoutOthers: boolean) => {
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(
        '/api/auth/two-factor/verify',
        {
          user_id: userId,
          code: codeValue,
          force_logout_others: forceLogoutOthers,
        },
        { silent: true }
      );

      const { token, user } = res.data.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      window.location.href = user.roles.some((r: { name: string }) => r.name === 'admin')
        ? '/admin' : '/participant/home';
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (status === 409 && code === 'ALREADY_LOGGED_IN') {
        setPendingCode(codeValue);
        setForceLogoutDialogOpen(true);
        return;
      }
      setError(err.response?.data?.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performVerify(code, initialForce);
  };

  const handleConfirmForceLogout = async () => {
    setForceLogoutDialogOpen(false);
    await performVerify(pendingCode || code, true);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <LockOutlined sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          二段階認証
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {useRecovery
            ? 'リカバリーコードを入力してください'
            : '認証アプリに表示されている6桁のコードを入力してください'}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={useRecovery ? 'リカバリーコード' : '認証コード'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={useRecovery ? 'xxxxx-xxxxx' : '000000'}
            inputProps={{
              maxLength: useRecovery ? 11 : 6,
              style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3em' },
            }}
            sx={{ mb: 3 }}
            autoFocus
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || (!useRecovery && code.length !== 6)}
            sx={{ mb: 2 }}
          >
            {loading ? '確認中...' : '認証する'}
          </Button>

          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setCode('');
              setError('');
            }}
          >
            {useRecovery ? '認証アプリのコードを使う' : 'リカバリーコードを使う'}
          </Link>
        </Box>
      </Paper>

      <Dialog
        open={forceLogoutDialogOpen}
        onClose={() => setForceLogoutDialogOpen(false)}
      >
        <DialogTitle>他の端末でログイン中です</DialogTitle>
        <DialogContent>
          <DialogContentText>
            このアカウントは現在、別の端末でログインされています。
            続行すると他の端末は強制的にログアウトされ、対象のメールアドレス宛に通知が送信されます。
            よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForceLogoutDialogOpen(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirmForceLogout}
            variant="contained"
            color="error"
            disabled={loading}
          >
            {loading ? '処理中...' : '強制ログアウトして続行'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
