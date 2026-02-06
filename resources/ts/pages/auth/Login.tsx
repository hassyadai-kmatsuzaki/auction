import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
} from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // AuthContextのlogin関数を使用
      await login(email, password);

      // リダイレクト元があればそこに戻る
      const from = (location.state as { from?: Location })?.from;
      if (from) {
        navigate(from.pathname + (from.search || ''), { replace: true });
        return;
      }

      // ロールに応じたデフォルトリダイレクト
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);

        if (user.roles && user.roles.some((r: any) => r.name === 'admin')) {
          navigate('/admin', { replace: true });
        } else if (user.roles && user.roles.some((r: any) => r.name === 'seller')) {
          navigate('/seller', { replace: true });
        } else {
          navigate('/participant/home', { replace: true });
        }
      } else {
        throw new Error('ユーザー情報の取得に失敗しました');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'ログインに失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <LoginIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              メダカライブオークション
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ログインして参加する
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Link
              data-testid="link-register"
              onClick={() => navigate('/register')}
              variant="body2"
              sx={{ cursor: 'pointer' }}
            >
              新規登録
            </Link>
            <Link
              data-testid="link-forgot-password"
              onClick={() => navigate('/auth/forgot-password')}
              variant="body2"
              sx={{ cursor: 'pointer' }}
            >
              パスワードをお忘れの方
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
