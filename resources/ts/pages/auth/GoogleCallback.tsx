import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import axios from '../../lib/axios';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // ユーザー情報を取得してリダイレクト
      axios.get('/api/auth/me').then(res => {
        const user = res.data.data.user;
        localStorage.setItem('user', JSON.stringify(user));
        const isAdmin = user.roles?.length === 1 && user.roles.some((r: { name: string }) => r.name === 'admin');
        window.location.href = isAdmin ? '/admin' : '/participant/home';
      }).catch(() => {
        window.location.href = '/login?error=認証に失敗しました';
      });
    } else {
      window.location.href = '/login';
    }
  }, [searchParams]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CircularProgress sx={{ mb: 2 }} />
      <Typography>ログイン中...</Typography>
    </Box>
  );
}
