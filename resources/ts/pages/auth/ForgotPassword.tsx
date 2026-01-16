import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
} from '@mui/material';
import axios from '../../lib/axios';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await axios.post('/api/auth/forgot-password', {
        email,
      });

      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'パスワードリセットの申請に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" align="center" gutterBottom>
              パスワードをお忘れの方
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              登録されているメールアドレスを入力してください。
              パスワードリセット用のリンクをお送りします。
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                パスワードリセット用のメールを送信しました。
                メールをご確認ください。
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                {loading ? '送信中...' : 'リセットリンクを送信'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link
                  onClick={() => navigate('/login')}
                  variant="body2"
                  sx={{ cursor: 'pointer' }}
                >
                  ログイン画面に戻る
                </Link>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
