import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Grid,
  CircularProgress,
} from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';
import axios from '../../lib/axios';

const BG_IMAGE = '/img/regist-bg.avif';

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

  const inputSx = {
    '& .MuiInput-root': {
      color: '#000',
      fontSize: '0.9375rem',
      '&:before': { borderBottomColor: 'rgba(0,0,0,0.3)' },
      '&:hover:not(.Mui-disabled):before': { borderBottomColor: 'rgba(0,0,0,0.55)' },
      '&.Mui-focused:after': { borderBottomColor: '#000' },
      '&.Mui-error:after': { borderBottomColor: '#FCA5A5' },
    },
    '& .MuiInputLabel-root': {
      color: '#000',
      fontSize: '0.9375rem',
      '&.Mui-focused': { color: '#000' },
      '&.Mui-error': { color: '#FCA5A5' },
    },
    '& .MuiFormHelperText-root': {
      color: '#000',
      fontSize: '0.75rem',
      '&.Mui-error': { color: '#FCA5A5' },
    },
    '& input:-webkit-autofill': {
      WebkitTextFillColor: '#000',
      WebkitBoxShadow: '0 0 0 1000px transparent inset',
      transition: 'background-color 5000s ease-in-out 0s',
      caretColor: '#000',
    },
    '& input::placeholder, & textarea::placeholder': {
      color: 'rgba(0,0,0,0.4)',
      opacity: 1,
    },
  };

  // 成功画面
  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          position: 'relative',
          isolation: 'isolate',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 6,
          backgroundImage: `url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        <Box
          sx={{
            maxWidth: 480,
            width: '100%',
            position: 'relative',
            zIndex: 1,
            borderRadius: 4,
            p: { xs: 4, sm: 5 },
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(10px) saturate(160%)',
            WebkitBackdropFilter: 'blur(10px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 30px 60px -15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
            color: '#000',
          }}
        >
          <Box
            component="img"
            src="/img/logo.png?v=1"
            alt="MEDAICHI"
            sx={{
              display: 'block',
              mx: 'auto',
              mb: 2.5,
              width: 200,
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
            }}
          />
          <Box
            sx={{
              width: 56,
              height: 56,
              mx: 'auto',
              mb: 2.5,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(16,185,129,0.2)',
              color: '#6EE7B7',
              border: '1px solid rgba(16,185,129,0.35)',
            }}
          >
            <CheckCircleOutlined sx={{ fontSize: 32 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', mb: 1.5 }}>
            申請を受け付けました
          </Typography>
          <Typography sx={{ color: '#000', mb: 4, lineHeight: 1.7, fontSize: '0.9375rem' }}>
            管理者の承認が完了次第、<br />
            ご登録のメールアドレスに通知をお送りします。
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            sx={{
              py: 1.5,
              px: 4,
              bgcolor: 'rgba(15, 23, 42, 0.95)',
              color: '#000',
              border: '1px solid rgba(255,255,255,0.12)',
              '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.95)' },
            }}
          >
            ログイン画面へ戻る
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        isolation: 'isolate',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        px: 2,
        py: { xs: 4, md: 6 },
        backgroundImage: `url(${BG_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ガラスカード */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 620,
          position: 'relative',
          zIndex: 1,
          borderRadius: 4,
          p: { xs: 3.5, sm: 5 },
          background: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(10px) saturate(160%)',
          WebkitBackdropFilter: 'blur(10px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 30px 60px -15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
          color: '#000',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/img/logo.png?v=1"
            alt="MEDAICHI"
            sx={{
              display: 'block',
              mx: 'auto',
              mb: 2.5,
              width: 200,
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
            }}
          />
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.875rem', sm: '2.25rem' },
              letterSpacing: '-0.03em',
              mb: 0.75,
            }}
          >
            新規登録
          </Typography>
          <Typography sx={{ color: '#000', fontSize: '0.875rem' }}>
            必要な情報を入力してください (承認制)
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              borderRadius: 2,
              bgcolor: 'rgba(239, 68, 68, 0.15)',
              color: '#000',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              '& .MuiAlert-icon': { color: '#FCA5A5' },
            }}
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          {/* セクション1 */}
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#000',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              mb: 2.5,
            }}
          >
            アカウント情報
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                variant="standard"
                label="お名前"
                value={formData.name}
                onChange={handleChange('name')}
                required
                error={!!errors.name}
                helperText={errors.name?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="屋号 (任意)"
                value={formData.trade_name}
                onChange={handleChange('trade_name')}
                error={!!errors.trade_name}
                helperText={errors.trade_name?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="法人名 (任意)"
                value={formData.company_name}
                onChange={handleChange('company_name')}
                error={!!errors.company_name}
                helperText={errors.company_name?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                variant="standard"
                label="メールアドレス"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                required
                error={!!errors.email}
                helperText={errors.email?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="パスワード"
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                required
                error={!!errors.password}
                helperText={errors.password?.[0] || '8文字以上'}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="パスワード (確認)"
                type="password"
                value={formData.password_confirmation}
                onChange={handleChange('password_confirmation')}
                required
                sx={inputSx}
              />
            </Grid>
          </Grid>

          {/* セクション2 */}
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#000',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              mb: 2.5,
            }}
          >
            連絡先・お届け先
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="電話番号"
                value={formData.phone}
                onChange={handleChange('phone')}
                placeholder="090-1234-5678"
                required
                error={!!errors.phone}
                helperText={errors.phone?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="郵便番号"
                value={formData.postal_code}
                onChange={handleChange('postal_code')}
                placeholder="123-4567"
                required
                error={!!errors.postal_code}
                helperText={errors.postal_code?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="都道府県"
                value={formData.prefecture}
                onChange={handleChange('prefecture')}
                placeholder="東京都"
                required
                error={!!errors.prefecture}
                helperText={errors.prefecture?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="standard"
                label="市区町村"
                value={formData.city}
                onChange={handleChange('city')}
                placeholder="渋谷区"
                required
                error={!!errors.city}
                helperText={errors.city?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                variant="standard"
                label="番地"
                value={formData.address_line1}
                onChange={handleChange('address_line1')}
                placeholder="1-2-3"
                required
                error={!!errors.address_line1}
                helperText={errors.address_line1?.[0]}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                variant="standard"
                label="建物名・部屋番号 (任意)"
                value={formData.address_line2}
                onChange={handleChange('address_line2')}
                placeholder="〇〇マンション 101号室"
                sx={inputSx}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', color: '#000', lineHeight: 1.6 }}>
              登録後、管理者の承認が必要です。承認完了までログインはできません。
            </Typography>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              py: 1.5,
              fontSize: '0.9375rem',
              fontWeight: 600,
              bgcolor: 'rgba(15, 23, 42, 0.95)',
              color: '#000',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
              '&:hover': {
                bgcolor: 'rgba(30, 41, 59, 0.95)',
                boxShadow: '0 10px 28px -8px rgba(0,0,0,0.7)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(15, 23, 42, 0.6)',
                color: '#000',
              },
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: '#000' }} /> : '登録を申請する'}
          </Button>

          <Typography
            sx={{
              textAlign: 'center',
              mt: 3,
              fontSize: '0.875rem',
              color: '#000',
            }}
          >
            すでにアカウントをお持ちの方は{' '}
            <Typography
              component="span"
              onClick={() => navigate('/login')}
              sx={{
                cursor: 'pointer',
                color: '#000',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                '&:hover': { opacity: 0.85 },
              }}
            >
              ログイン
            </Typography>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
