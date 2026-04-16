import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container, Paper, Typography, TextField, Button, Alert, Box, Link,
} from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import axios from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const userId = (location.state as { userId?: number })?.userId;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  if (!userId) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/two-factor/verify', {
        user_id: userId,
        code,
      });

      const { token, user } = res.data.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // AuthContext を更新するため再読み込み
      window.location.href = user.roles.some((r: { name: string }) => r.name === 'admin')
        ? '/admin' : '/participant/home';
    } catch (err: any) {
      setError(err.response?.data?.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
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
    </Container>
  );
}
