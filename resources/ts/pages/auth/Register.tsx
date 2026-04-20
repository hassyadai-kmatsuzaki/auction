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
  InputAdornment,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import {
  PersonOutline,
  BusinessOutlined,
  StorefrontOutlined,
  EmailOutlined,
  LockOutlined,
  PhoneOutlined,
  MarkunreadMailboxOutlined,
  LocationCityOutlined,
  HomeOutlined,
  ApartmentOutlined,
  ArrowForwardRounded,
  CheckCircleRounded,
  VerifiedUserRounded,
  BoltRounded,
  ShieldOutlined,
} from '@mui/icons-material';
import axios from '../../lib/axios';

const STEPS = [
  { n: 1, label: 'フォーム入力' },
  { n: 2, label: '管理者承認' },
  { n: 3, label: '利用開始' },
];

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
          bgcolor: '#F8FAFC',
          px: 3,
          py: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.18), rgba(16,185,129,0) 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'relative',
            maxWidth: 520,
            width: '100%',
            bgcolor: '#fff',
            borderRadius: 4,
            p: { xs: 4, sm: 6 },
            textAlign: 'center',
            border: '1px solid #E2E8F0',
            boxShadow: '0px 25px 50px -12px rgba(15, 23, 42, 0.1)',
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              mb: 3,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(16,185,129,0.1)',
              color: 'secondary.main',
            }}
          >
            <CheckCircleRounded sx={{ fontSize: 48 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: '-0.02em' }}>
            登録申請を受け付けました
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            ご登録ありがとうございます。<br />
            管理者の承認が完了次第、<br />
            ご登録のメールアドレスに通知が届きます。
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRounded />}
            onClick={() => navigate('/login')}
            sx={{
              py: 1.5,
              px: 4,
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              boxShadow: '0px 10px 30px -10px rgba(15, 23, 42, 0.5)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
              },
            }}
          >
            ログイン画面へ戻る
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#F8FAFC' }}>
      {/* 左パネル：ブランド */}
      <Box
        sx={{
          flex: { lg: '0 0 42%' },
          display: { xs: 'none', lg: 'flex' },
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #020617 0%, #0F172A 50%, #064E3B 100%)',
          color: '#fff',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '-15%',
            right: '-20%',
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.35), rgba(16,185,129,0) 70%)',
            filter: 'blur(20px)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            bottom: '-25%',
            left: '-20%',
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.25), rgba(59,130,246,0) 70%)',
            filter: 'blur(20px)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/img/logo.png?v=1"
              alt="logo"
              sx={{
                height: 48,
                width: 48,
                borderRadius: 2,
                objectFit: 'cover',
                bgcolor: 'rgba(255,255,255,0.08)',
                p: 0.5,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
                Medaka Live
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.7, letterSpacing: '0.08em' }}>
                AUCTION PLATFORM
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          <Chip
            label="START YOUR JOURNEY"
            size="small"
            sx={{
              bgcolor: 'rgba(16,185,129,0.18)',
              color: '#6EE7B7',
              fontWeight: 600,
              letterSpacing: '0.08em',
              border: '1px solid rgba(16,185,129,0.3)',
              mb: 3,
            }}
          />
          <Typography
            sx={{
              fontSize: '2.25rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              mb: 2,
            }}
          >
            3ステップで、<br />
            ライブ入札デビュー。
          </Typography>
          <Typography sx={{ fontSize: '0.95rem', opacity: 0.75, lineHeight: 1.7, mb: 4 }}>
            申請は数分で完了。管理者の承認後、すぐにオークションにご参加いただけます。
          </Typography>

          <Stack spacing={2.5}>
            {STEPS.map((s, i) => (
              <Box key={s.n} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    bgcolor: i === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                    color: i === 0 ? '#6EE7B7' : 'rgba(255,255,255,0.6)',
                    border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  }}
                >
                  {s.n}
                </Box>
                <Typography
                  sx={{
                    fontSize: '1rem',
                    fontWeight: i === 0 ? 600 : 400,
                    color: i === 0 ? '#fff' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
            {[
              { icon: <ShieldOutlined />, label: '承認制' },
              { icon: <VerifiedUserRounded />, label: '安全な取引' },
              { icon: <BoltRounded />, label: '即時参加' },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: '#6EE7B7',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', opacity: 0.85 }}>{item.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.5 }}>
            © {new Date().getFullYear()} Medaka Live Auction. All rights reserved.
          </Typography>
        </Box>
      </Box>

      {/* 右パネル：フォーム */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          px: { xs: 3, sm: 6, lg: 8 },
          py: { xs: 4, md: 6 },
        }}
      >
        {/* モバイル/タブレット用ロゴヘッダー */}
        <Box
          sx={{
            display: { xs: 'flex', lg: 'none' },
            alignItems: 'center',
            gap: 1.5,
            mb: 4,
            alignSelf: 'flex-start',
          }}
        >
          <Box
            component="img"
            src="/img/logo.png?v=1"
            alt="logo"
            sx={{ height: 44, width: 44, borderRadius: 1.5, objectFit: 'cover' }}
          />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Medaka Live</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              AUCTION PLATFORM
            </Typography>
          </Box>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 640 }}>
          <Chip
            label="新規登録申請"
            size="small"
            sx={{
              bgcolor: 'rgba(16,185,129,0.1)',
              color: 'secondary.dark',
              fontWeight: 600,
              letterSpacing: '0.05em',
              mb: 2,
            }}
          />
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 1 }}>
            アカウントを作成
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            必要な情報をご入力ください。登録後、管理者の承認を経てご利用いただけます。
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            {/* セクション1: アカウント情報 */}
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                fontWeight: 700,
                color: 'text.secondary',
                letterSpacing: '0.1em',
                mb: 1.5,
              }}
            >
              アカウント情報
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="お名前"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  error={!!errors.name}
                  helperText={errors.name?.[0]}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutline sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <StorefrontOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            {/* セクション2: 連絡先 */}
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                fontWeight: 700,
                color: 'text.secondary',
                letterSpacing: '0.1em',
                mb: 1.5,
              }}
            >
              連絡先・お届け先
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MarkunreadMailboxOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationCityOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationCityOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
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
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <HomeOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="建物名・部屋番号（任意）"
                  value={formData.address_line2}
                  onChange={handleChange('address_line2')}
                  placeholder="メダカハイツ101号室"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ApartmentOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Alert
              severity="info"
              icon={<ShieldOutlined />}
              sx={{
                mb: 3,
                borderRadius: 2,
                bgcolor: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.15)',
                '& .MuiAlert-icon': { color: 'info.main' },
              }}
            >
              登録後、管理者の承認が必要です。承認完了までログインはできません。
            </Alert>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              endIcon={!loading && <ArrowForwardRounded />}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                boxShadow: '0px 10px 30px -10px rgba(15, 23, 42, 0.5)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
                  boxShadow: '0px 15px 35px -10px rgba(15, 23, 42, 0.6)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '登録を申請する'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                すでにアカウントをお持ちですか？{' '}
                <Typography
                  component="span"
                  onClick={() => navigate('/login')}
                  sx={{
                    cursor: 'pointer',
                    color: 'secondary.main',
                    fontWeight: 600,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  ログイン
                </Typography>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
