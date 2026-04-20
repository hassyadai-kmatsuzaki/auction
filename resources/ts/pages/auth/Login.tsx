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
  Stack,
  Chip,
} from '@mui/material';
import {
  EmailOutlined,
  LockOutlined,
  Visibility,
  VisibilityOff,
  ArrowForwardRounded,
  BoltRounded,
  VerifiedUserRounded,
  SupportAgentRounded,
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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#F8FAFC',
      }}
    >
      {/* 左パネル：ブランド */}
      <Box
        sx={{
          flex: { md: '1 1 50%', lg: '1 1 55%' },
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #020617 0%, #0F172A 45%, #064E3B 100%)',
          color: '#fff',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: 6, lg: 8 },
        }}
      >
        {/* 装飾的な blob */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '-10%',
            right: '-15%',
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.35), rgba(16,185,129,0) 70%)',
            filter: 'blur(20px)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            bottom: '-20%',
            left: '-10%',
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.25), rgba(59,130,246,0) 70%)',
            filter: 'blur(20px)',
          }}
        />
        {/* グリッドパターン */}
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
                backdropFilter: 'blur(10px)',
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

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
          <Chip
            label="LIVE AUCTION"
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
              fontSize: { md: '2.25rem', lg: '2.75rem' },
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              mb: 2,
            }}
          >
            リアルタイムで繋がる、<br />
            次世代メダカオークション。
          </Typography>
          <Typography sx={{ fontSize: '1rem', opacity: 0.75, lineHeight: 1.7, mb: 4 }}>
            全国のブリーダーと参加者をシームレスに結ぶライブ入札プラットフォーム。
            高解像度の映像と遅延の少ない入札で、会場にいるような臨場感を。
          </Typography>

          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
            {[
              { icon: <BoltRounded />, label: '低遅延ライブ入札' },
              { icon: <VerifiedUserRounded />, label: '承認制で安心' },
              { icon: <SupportAgentRounded />, label: '24h サポート' },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#6EE7B7',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography sx={{ fontSize: '0.875rem', opacity: 0.85 }}>{item.label}</Typography>
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
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 6 },
          py: { xs: 4, md: 6 },
          position: 'relative',
        }}
      >
        {/* モバイル用ロゴ */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            gap: 1.5,
            mb: 4,
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

        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              mb: 1,
            }}
          >
            おかえりなさい
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            アカウントにサインインして、ライブオークションに参加しましょう。
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="パスワード"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
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
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, mb: 2.5 }}>
              <Typography
                data-testid="link-forgot-password"
                onClick={() => navigate('/auth/forgot-password')}
                variant="body2"
                sx={{
                  cursor: 'pointer',
                  color: 'text.secondary',
                  fontWeight: 500,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                パスワードをお忘れですか？
              </Typography>
            </Box>

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
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3 }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
              OR
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
          </Box>

          <GoogleLoginButton />

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              アカウントをお持ちでないですか？{' '}
              <Typography
                component="span"
                data-testid="link-register"
                onClick={() => navigate('/register')}
                sx={{
                  cursor: 'pointer',
                  color: 'secondary.main',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                新規登録
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
