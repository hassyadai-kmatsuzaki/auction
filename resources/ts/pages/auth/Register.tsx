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
  CircularProgress,
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import axios from '../../lib/axios';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    trade_name: '',
    company_name: '',
    email: '',
    password: '',
    password_confirmation: '',
    phone: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
  });
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
    // フィールドのエラーをクリア
    if (errors[field]) {
      setErrors({ ...errors, [field]: [] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrors({});

    try {
      await axios.post('/api/auth/register', formData);
      setSuccess(true);
    } catch (err: any) {
      console.error('登録エラー:', err);
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setError(err.response?.data?.message || '登録に失敗しました。');
      }
    } finally {
      setLoading(false);
    }
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="お名前"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  error={!!errors.name}
                  helperText={errors.name?.[0]}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="屋号（任意）"
                  value={formData.trade_name}
                  onChange={handleChange('trade_name')}
                  error={!!errors.trade_name}
                  helperText={errors.trade_name?.[0]}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="法人名（任意）"
                  value={formData.company_name}
                  onChange={handleChange('company_name')}
                  error={!!errors.company_name}
                  helperText={errors.company_name?.[0]}
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
                  error={!!errors.email}
                  helperText={errors.email?.[0]}
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
                  error={!!errors.password}
                  helperText={errors.password?.[0] || '8文字以上'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="パスワード（確認）"
                  type="password"
                  value={formData.password_confirmation}
                  onChange={handleChange('password_confirmation')}
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
                  required
                  error={!!errors.phone}
                  helperText={errors.phone?.[0]}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="郵便番号"
                  value={formData.postal_code}
                  onChange={handleChange('postal_code')}
                  placeholder="123-4567"
                  required
                  error={!!errors.postal_code}
                  helperText={errors.postal_code?.[0]}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="都道府県"
                  value={formData.prefecture}
                  onChange={handleChange('prefecture')}
                  placeholder="東京都"
                  required
                  error={!!errors.prefecture}
                  helperText={errors.prefecture?.[0]}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="市区町村"
                  value={formData.city}
                  onChange={handleChange('city')}
                  placeholder="渋谷区"
                  required
                  error={!!errors.city}
                  helperText={errors.city?.[0]}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="番地"
                  value={formData.address_line1}
                  onChange={handleChange('address_line1')}
                  placeholder="1-2-3"
                  required
                  error={!!errors.address_line1}
                  helperText={errors.address_line1?.[0]}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="建物名・部屋番号（任意）"
                  value={formData.address_line2}
                  onChange={handleChange('address_line2')}
                  placeholder="メダカハイツ101号室"
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '登録申請する'}
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

