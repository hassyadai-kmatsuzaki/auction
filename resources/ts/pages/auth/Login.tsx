import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      console.log('ログイン開始:', email);
      
      // AuthContextのlogin関数を使用
      await login(email, password);
      
      console.log('ログイン成功');

      // ログイン成功後、ユーザー情報を取得してリダイレクト
      const userStr = localStorage.getItem('user');
      console.log('保存されたユーザー情報:', userStr);
      
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('ユーザーロール:', user.roles);
        
        // ロールに応じてリダイレクト
        if (user.roles && user.roles.some((r: any) => r.name === 'admin')) {
          console.log('管理者としてリダイレクト');
          navigate('/admin', { replace: true });
        } else if (user.roles && user.roles.some((r: any) => r.name === 'seller')) {
          console.log('出品者としてリダイレクト');
          navigate('/seller', { replace: true });
        } else {
          console.log('参加者としてリダイレクト');
          navigate('/participant/home', { replace: true });
        }
      } else {
        throw new Error('ユーザー情報の取得に失敗しました');
      }
    } catch (err: any) {
      console.error('ログインエラー:', err);
      console.error('エラーレスポンス:', err.response);
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

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link
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

