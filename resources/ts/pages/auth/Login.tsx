import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import GoogleLoginButton from '../../features/auth/GoogleLoginButton';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result?.twoFactorRequired) {
        navigate('/auth/two-factor', { state: { userId: result.userId } });
        return;
      }

      const from = (location.state as { from?: Location })?.from;
      if (from) {
        navigate(from.pathname + (from.search || ''), { replace: true });
        return;
      }

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);

        if (user.roles && user.roles.length === 1 && user.roles.some((r: any) => r.name === 'admin')) {
          navigate('/admin', { replace: true });
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
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#fff' }}>
      {/* 左：ビジュアル */}
      <Box
        sx={{
          flex: { md: '1 1 50%' },
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/img/medaka/04.png)',
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
        <Box
          sx={{
            position: 'absolute',
            bottom: 56,
            left: 48,
            right: 48,
            color: '#fff',
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { md: '2rem', lg: '2.5rem' },
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            }}
          >
            一匹との出会いを、<br />
            もっと鮮やかに。
          </Typography>
        </Box>
      </Box>

      {/* 右：フォーム */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 6 },
          py: { xs: 5, md: 6 },
          position: 'relative',
        }}
      >
        {/* モバイル用ロゴ */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
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

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.03em',
              fontSize: { xs: '1.875rem', md: '2.25rem' },
              mb: 1.25,
            }}
          >
            おかえりなさい
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 4 }}>
            メールアドレスとパスワードでサインイン
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Box sx={{ mb: 2.5 }}>
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'text.primary',
                  mb: 0.75,
                }}
              >
                メールアドレス
              </Typography>
              <TextField
                fullWidth
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                size="medium"
              />
            </Box>

            <Box sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  mb: 0.75,
                }}
              >
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                  パスワード
                </Typography>
                <Typography
                  data-testid="link-forgot-password"
                  onClick={() => navigate('/auth/forgot-password')}
                  sx={{
                    fontSize: '0.8125rem',
                    color: 'text.secondary',
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  パスワードをお忘れですか？
                </Typography>
              </Box>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                mt: 2,
                fontSize: '0.9375rem',
                fontWeight: 600,
                bgcolor: '#0F172A',
                '&:hover': { bgcolor: '#1E293B' },
              }}
            >
              {loading ? 'サインイン中...' : 'サインイン'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3 }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              または
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
          </Box>

          <GoogleLoginButton />

          <Typography
            sx={{
              textAlign: 'center',
              mt: 4,
              fontSize: '0.875rem',
              color: 'text.secondary',
            }}
          >
            アカウントをお持ちでないですか？{' '}
            <Typography
              component="span"
              data-testid="link-register"
              onClick={() => navigate('/register')}
              sx={{
                cursor: 'pointer',
                color: 'text.primary',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                '&:hover': { color: 'primary.main' },
              }}
            >
              新規登録
            </Typography>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
