import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { LockOutlined, VisibilityOff } from '@mui/icons-material';
import axios from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';

const BG_IMAGE = '/img/regist-bg.avif?v=1';

interface OnsiteStatus {
  enabled: boolean;
  code_required: boolean;
}

/**
 * 当日会員登録（会場での電話番号登録）。
 *
 * 名前・電話番号・パスワード（＋受付コード）だけで、承認なし・年会費なしの落札会員を作る。
 * 登録に成功するとサーバーがトークンを返すので、そのままログイン状態にして会場ホームへ進む。
 * 管理画面「ライブ運用」タブの「当日会員登録を受け付ける」が OFF の間は受付停止表示になる。
 */
export default function RegisterOnsite() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [status, setStatus] = useState<OnsiteStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', password: '', code: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    axios
      .get('/api/auth/onsite-register/status', { silent: true })
      .then((res) => setStatus(res.data.data))
      .catch(() => setStatusError(true));
  }, []);

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const res = await axios.post('/api/auth/onsite-register', formData);
      const { token, user } = res.data.data;
      applySession(token, user);
      navigate('/participant/home', { replace: true });
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setError(err.response?.data?.message || '登録に失敗しました。会場スタッフにお声がけください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiInput-root': {
      color: '#000',
      fontSize: '1rem',
      '&:before': { borderBottomColor: 'rgba(0,0,0,0.3)' },
      '&:hover:not(.Mui-disabled):before': { borderBottomColor: 'rgba(0,0,0,0.55)' },
      '&.Mui-focused:after': { borderBottomColor: '#000' },
      '&.Mui-error:after': { borderBottomColor: '#FCA5A5' },
    },
    '& .MuiInputLabel-root': {
      color: '#000',
      '&.Mui-focused': { color: '#000' },
      '&.Mui-error': { color: '#B91C1C' },
    },
    '& .MuiFormHelperText-root': {
      color: '#000',
      fontSize: '0.75rem',
      '&.Mui-error': { color: '#B91C1C' },
    },
    '& input:-webkit-autofill': {
      WebkitTextFillColor: '#000',
      WebkitBoxShadow: '0 0 0 1000px transparent inset',
      transition: 'background-color 5000s ease-in-out 0s',
      caretColor: '#000',
    },
  };

  const primaryButtonSx = {
    py: 1.5,
    fontSize: '0.9375rem',
    fontWeight: 600,
    bgcolor: 'rgba(15, 23, 42, 0.95)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
    '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.95)' },
    '&.Mui-disabled': { bgcolor: 'rgba(15, 23, 42, 0.6)', color: 'rgba(255,255,255,0.5)' },
  };

  const renderBody = () => {
    if (statusError) {
      return <Alert severity="error">受付状況を確認できませんでした。時間をおいて再度お試しください。</Alert>;
    }
    if (!status) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: '#000' }} />
        </Box>
      );
    }
    if (!status.enabled) {
      return (
        <Alert
          severity="info"
          sx={{ borderRadius: 2, bgcolor: 'rgba(59,130,246,0.12)', color: '#000', border: '1px solid rgba(59,130,246,0.3)' }}
        >
          現在、当日会員登録は受け付けていません。会場スタッフにお声がけください。
        </Alert>
      );
    }

    return (
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          variant="standard"
          label="お名前"
          value={formData.name}
          onChange={handleChange('name')}
          required
          autoComplete="name"
          error={!!errors.name?.length}
          helperText={errors.name?.[0]}
          sx={{ ...inputSx, mb: 3 }}
        />
        <TextField
          fullWidth
          variant="standard"
          label="電話番号"
          type="tel"
          inputMode="tel"
          value={formData.phone}
          onChange={handleChange('phone')}
          required
          autoComplete="tel"
          placeholder="090-1234-5678"
          error={!!errors.phone?.length}
          helperText={errors.phone?.[0] || 'ログイン時に使用します（ハイフンはあってもなくても可）'}
          sx={{ ...inputSx, mb: 3 }}
        />
        <TextField
          fullWidth
          variant="standard"
          label="パスワード"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleChange('password')}
          required
          autoComplete="new-password"
          error={!!errors.password?.length}
          helperText={errors.password?.[0] || '8文字以上'}
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
          sx={{ ...inputSx, mb: 3 }}
        />
        {status.code_required && (
          <TextField
            fullWidth
            variant="standard"
            label="受付コード"
            value={formData.code}
            onChange={handleChange('code')}
            required
            autoComplete="off"
            helperText="会場の受付でお伝えしているコードを入力してください"
            sx={{ ...inputSx, mb: 3 }}
          />
        )}

        <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={primaryButtonSx}>
          {loading ? '登録中...' : '登録して参加する'}
        </Button>
      </Box>
    );
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
            src="/img/logo.png?v=2"
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
          <Typography sx={{ fontWeight: 700, fontSize: { xs: '1.75rem', sm: '2rem' }, letterSpacing: '-0.03em', mb: 0.75 }}>
            当日会員登録
          </Typography>
          <Typography sx={{ color: '#000', fontSize: '0.875rem' }}>
            会場にお越しの方向けの登録です。
            <br />
            お名前・電話番号・パスワードだけですぐに参加できます。
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
            }}
          >
            {error}
          </Alert>
        )}

        {renderBody()}

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography
            onClick={() => navigate('/login')}
            sx={{ fontSize: '0.8125rem', color: '#000', cursor: 'pointer', display: 'inline-block' }}
          >
            すでに登録済みの方はログインへ
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
