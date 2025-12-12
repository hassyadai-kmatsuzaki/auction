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
  Grid,
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    phone: '',
    postalCode: '',
    address: '',
  });
  const [success, setSuccess] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock: 実際はAPIを呼び出す
    setSuccess(true);
  };

  if (success) {
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
          <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              登録申請を受け付けました
            </Alert>
            <Typography variant="h6" gutterBottom>
              ご登録ありがとうございます
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              管理者の承認をお待ちください。<br />
              承認後、ご登録のメールアドレスに通知が届きます。
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
            >
              ログイン画面へ
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <PersonAddIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              新規登録申請
            </Typography>
            <Typography variant="body2" color="text.secondary">
              参加者として登録申請を行います（承認制）
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="お名前"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="メールアドレス"
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="パスワード"
                  type="password"
                  value={formData.password}
                  onChange={handleChange('password')}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="パスワード（確認）"
                  type="password"
                  value={formData.passwordConfirmation}
                  onChange={handleChange('passwordConfirmation')}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="電話番号"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  placeholder="090-1234-5678"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="郵便番号"
                  value={formData.postalCode}
                  onChange={handleChange('postalCode')}
                  placeholder="123-4567"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="住所"
                  value={formData.address}
                  onChange={handleChange('address')}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
            >
              登録申請する
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2">
              すでにアカウントをお持ちの方は{' '}
              <Link href="/login" sx={{ cursor: 'pointer' }}>
                ログイン
              </Link>
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mt: 3 }}>
            ※ 登録後、管理者の承認が必要です。承認されるまでログインできません。
          </Alert>
        </Paper>
      </Box>
    </Container>
  );
}

