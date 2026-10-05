import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography,
} from '@mui/material';
import axios from '../../lib/axios';

/**
 * Google ログインの戻り先。URL の使い切りコードをトークンに交換する（トークン自体は URL に載せない）。
 * 通常ログインと同じく、2FA が有効なら2段階目へ、他端末でログイン中なら確認してから続行する
 */
export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const started = useRef(false);

  const exchange = async (forceLogoutOthers: boolean) => {
    try {
      const res = await axios.post(
        '/api/auth/google/exchange',
        { code, force_logout_others: forceLogoutOthers },
        { silent: true },
      );
      const data = res.data.data;

      if (data.two_factor_required) {
        navigate('/auth/two-factor', {
          replace: true,
          state: { userId: data.user_id, twoFactorToken: data.two_factor_token, forceLogoutOthers },
        });
        return;
      }

      localStorage.setItem('auth_token', data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      const me = await axios.get('/api/auth/me');
      const user = me.data.data.user;
      localStorage.setItem('user', JSON.stringify(user));
      const isAdmin = user.roles?.length === 1 && user.roles.some((r: { name: string }) => r.name === 'admin');
      window.location.href = isAdmin ? '/admin' : '/participant/home';
    } catch (err: any) {
      if (err?.response?.status === 409 && err.response.data?.code === 'ALREADY_LOGGED_IN') {
        setConfirmOpen(true);
        return;
      }
      const message = err?.response?.data?.message || '認証に失敗しました';
      window.location.href = `/login?error=${encodeURIComponent(message)}`;
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!code) {
      window.location.href = '/login';
      return;
    }
    exchange(false);
  }, [code]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CircularProgress sx={{ mb: 2 }} />
      <Typography>ログイン中...</Typography>

      <Dialog open={confirmOpen} onClose={() => { window.location.href = '/login'; }}>
        <DialogTitle>他の端末でログイン中です</DialogTitle>
        <DialogContent>
          <DialogContentText>
            このアカウントは別の端末でログインしています。続行すると、他の端末はログアウトされます。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { window.location.href = '/login'; }}>やめる</Button>
          <Button variant="contained" onClick={() => { setConfirmOpen(false); exchange(true); }}>
            強制ログアウトして続行
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
