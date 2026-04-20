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

type FieldProps = {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, required, helper, error, children }: FieldProps) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: 'text.primary',
          mb: 0.75,
        }}
      >
        {label}
        {!required && (
          <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem', ml: 0.75 }}>
            (任意)
          </Typography>
        )}
      </Typography>
      {children}
      {(error || helper) && (
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: error ? 'error.main' : 'text.secondary',
            mt: 0.5,
          }}
        >
          {error || helper}
        </Typography>
      )}
    </Box>
  );
}

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

  // 成功画面
  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#fff',
          px: 3,
          py: 6,
        }}
      >
        <Box sx={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 3,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#F0FDF4',
              color: '#059669',
            }}
          >
            <CheckCircleOutlined sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: '-0.02em' }}>
            申請を受け付けました
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.7 }}>
            管理者の承認が完了次第、ご登録のメールアドレスに通知をお送りします。
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            sx={{
              py: 1.5,
              px: 4,
              bgcolor: '#0F172A',
              '&:hover': { bgcolor: '#1E293B' },
            }}
          >
            ログイン画面へ戻る
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#fff' }}>
      {/* 左：ビジュアル（sticky） */}
      <Box
        sx={{
          flex: { lg: '0 0 42%' },
          display: { xs: 'none', lg: 'block' },
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/img/medaka/03.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.25) 0%, rgba(15,23,42,0.1) 40%, rgba(15,23,42,0.65) 100%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 40,
            left: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            color: '#fff',
          }}
        >
          <Box
            component="img"
            src="/img/logo.png?v=1"
            alt="logo"
            sx={{
              height: 40,
              width: 40,
              borderRadius: 1.5,
              objectFit: 'cover',
              bgcolor: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              p: 0.25,
            }}
          />
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            Medaka Live Auction
          </Typography>
        </Box>
        <Box sx={{ position: 'absolute', bottom: 56, left: 48, right: 48, color: '#fff' }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { lg: '2.25rem' },
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            }}
          >
            全国のブリーダーと、<br />
            ライブでつながる。
          </Typography>
        </Box>
      </Box>

      {/* 右：フォーム */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          px: { xs: 3, sm: 6, lg: 8 },
          py: { xs: 5, md: 6, lg: 8 },
        }}
      >
        <Box
          sx={{
            display: { xs: 'flex', lg: 'none' },
            alignItems: 'center',
            gap: 1.5,
            mb: 5,
            alignSelf: 'flex-start',
          }}
        >
          <Box
            component="img"
            src="/img/logo.png?v=1"
            alt="logo"
            sx={{ height: 36, width: 36, borderRadius: 1, objectFit: 'cover' }}
          />
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Medaka Live Auction
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 560 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.03em',
              fontSize: { xs: '1.875rem', md: '2.25rem' },
              mb: 1.25,
            }}
          >
            アカウントを作成
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 5 }}>
            必要な情報を入力してください。管理者の承認後にご利用いただけます。
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            {/* セクション1 */}
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'text.secondary',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 2,
              }}
            >
              アカウント情報
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <Field label="お名前" required error={errors.name?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.name}
                    onChange={handleChange('name')}
                    required
                    error={!!errors.name}
                    placeholder="山田 太郎"
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="屋号" error={errors.trade_name?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.trade_name}
                    onChange={handleChange('trade_name')}
                    error={!!errors.trade_name}
                    placeholder="めだか工房"
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="法人名" error={errors.company_name?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.company_name}
                    onChange={handleChange('company_name')}
                    error={!!errors.company_name}
                    placeholder="株式会社〇〇"
                  />
                </Field>
              </Grid>
              <Grid item xs={12}>
                <Field label="メールアドレス" required error={errors.email?.[0]}>
                  <TextField
                    fullWidth
                    type="email"
                    value={formData.email}
                    onChange={handleChange('email')}
                    required
                    error={!!errors.email}
                    placeholder="you@example.com"
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="パスワード" required helper="8文字以上" error={errors.password?.[0]}>
                  <TextField
                    fullWidth
                    type="password"
                    value={formData.password}
                    onChange={handleChange('password')}
                    required
                    error={!!errors.password}
                    placeholder="••••••••"
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="パスワード(確認)" required>
                  <TextField
                    fullWidth
                    type="password"
                    value={formData.password_confirmation}
                    onChange={handleChange('password_confirmation')}
                    required
                    placeholder="••••••••"
                  />
                </Field>
              </Grid>
            </Grid>

            {/* セクション2 */}
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'text.secondary',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                mb: 2,
              }}
            >
              連絡先・お届け先
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <Field label="電話番号" required error={errors.phone?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.phone}
                    onChange={handleChange('phone')}
                    placeholder="090-1234-5678"
                    required
                    error={!!errors.phone}
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="郵便番号" required error={errors.postal_code?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.postal_code}
                    onChange={handleChange('postal_code')}
                    placeholder="123-4567"
                    required
                    error={!!errors.postal_code}
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="都道府県" required error={errors.prefecture?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.prefecture}
                    onChange={handleChange('prefecture')}
                    placeholder="東京都"
                    required
                    error={!!errors.prefecture}
                  />
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="市区町村" required error={errors.city?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.city}
                    onChange={handleChange('city')}
                    placeholder="渋谷区"
                    required
                    error={!!errors.city}
                  />
                </Field>
              </Grid>
              <Grid item xs={12}>
                <Field label="番地" required error={errors.address_line1?.[0]}>
                  <TextField
                    fullWidth
                    value={formData.address_line1}
                    onChange={handleChange('address_line1')}
                    placeholder="1-2-3"
                    required
                    error={!!errors.address_line1}
                  />
                </Field>
              </Grid>
              <Grid item xs={12}>
                <Field label="建物名・部屋番号">
                  <TextField
                    fullWidth
                    value={formData.address_line2}
                    onChange={handleChange('address_line2')}
                    placeholder="〇〇マンション 101号室"
                  />
                </Field>
              </Grid>
            </Grid>

            <Box
              sx={{
                p: 2,
                mb: 3,
                borderRadius: 2,
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', lineHeight: 1.6 }}>
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
                bgcolor: '#0F172A',
                '&:hover': { bgcolor: '#1E293B' },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : '登録を申請する'}
            </Button>

            <Typography
              sx={{
                textAlign: 'center',
                mt: 3,
                fontSize: '0.875rem',
                color: 'text.secondary',
              }}
            >
              すでにアカウントをお持ちですか？{' '}
              <Typography
                component="span"
                onClick={() => navigate('/login')}
                sx={{
                  cursor: 'pointer',
                  color: 'text.primary',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                ログイン
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
