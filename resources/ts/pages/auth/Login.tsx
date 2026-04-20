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
  EmailOutlined,
  LockOutlined,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import GoogleLoginButton from '../../features/auth/GoogleLoginButton';

const BG_IMAGE = '/img/regist-bg.avif?v=1';

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

  const inputSx = {
    '& .MuiInput-root': {
      color: '#000',
      fontSize: '1rem',
      '&:before': { borderBottomColor: 'rgba(0,0,0,0.35)' },
      '&:hover:not(.Mui-disabled):before': { borderBottomColor: 'rgba(0,0,0,0.6)' },
      '&.Mui-focused:after': { borderBottomColor: '#000' },
    },
    '& .MuiInputLabel-root': {
      color: '#000',
      '&.Mui-focused': { color: '#000' },
    },
    '& input:-webkit-autofill': {
      WebkitTextFillColor: '#000',
      WebkitBoxShadow: '0 0 0 1000px transparent inset',
      transition: 'background-color 5000s ease-in-out 0s',
      caretColor: '#000',
    },
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        isolation: 'isolate',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
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
          maxWidth: 440,
          position: 'relative',
          zIndex: 1,
          borderRadius: 4,
          p: { xs: 3.5, sm: 5 },
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(10px) saturate(160%)',
          WebkitBackdropFilter: 'blur(10px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 30px 60px -15px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)',
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
            ログイン
          </Typography>
          <Typography sx={{ color: '#000', fontSize: '0.875rem' }}>
            アカウントにサインインして参加する
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2.5,
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
          <TextField
            fullWidth
            variant="standard"
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <EmailOutlined sx={{ color: '#000', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{ ...inputSx, mb: 3 }}
          />

          <TextField
            fullWidth
            variant="standard"
            label="パスワード"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    size="small"
                    aria-label="toggle password visibility"
                    sx={{ color: '#000', mr: -0.5 }}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <LockOutlined fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ ...inputSx, mb: 2 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Typography
              data-testid="link-forgot-password"
              onClick={() => navigate('/auth/forgot-password')}
              sx={{
                fontSize: '0.8125rem',
                color: '#000',
                cursor: 'pointer',
                '&:hover': { color: '#000' },
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
            sx={{
              py: 1.5,
              fontSize: '0.9375rem',
              fontWeight: 600,
              bgcolor: 'rgba(15, 23, 42, 0.95)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
              '&:hover': {
                bgcolor: 'rgba(30, 41, 59, 0.95)',
                boxShadow: '0 10px 28px -8px rgba(0,0,0,0.7)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(15, 23, 42, 0.6)',
                color: 'rgba(255,255,255,0.5)',
              },
            }}
          >
            {loading ? 'サインイン中...' : 'ログイン'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2.5 }}>
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.18)' }} />
          <Typography sx={{ fontSize: '0.75rem', color: '#000' }}>
            OR
          </Typography>
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.18)' }} />
        </Box>

        <Box
          sx={{
            '& .MuiButton-root': {
              bgcolor: 'rgba(255,255,255,0.95)',
              color: '#000',
              borderColor: 'transparent',
              '&:hover': {
                bgcolor: '#fff',
                borderColor: 'transparent',
              },
            },
          }}
        >
          <GoogleLoginButton />
        </Box>

        <Typography
          sx={{
            textAlign: 'center',
            mt: 3,
            fontSize: '0.875rem',
            color: '#000',
          }}
        >
          アカウントをお持ちでない方は{' '}
          <Typography
            component="span"
            data-testid="link-register"
            onClick={() => navigate('/register')}
            sx={{
              cursor: 'pointer',
              color: '#000',
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              '&:hover': { opacity: 0.85 },
            }}
          >
            新規登録
          </Typography>
        </Typography>
      </Box>
    </Box>
  );
}
