import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Grid,
  Divider,
  FormHelperText,
  List,
  ListItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface FormData {
  name: string;
  email: string;
  phone: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string;
  roles: string[];
}

export default function UserCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
    roles: ['participant'],
  });

  // URLパラメータからロールを取得して自動選択
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && ['admin', 'seller', 'participant'].includes(roleParam)) {
      setFormData(prev => ({
        ...prev,
        roles: [roleParam],
      }));
    }
  }, [searchParams]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
  ];

  const availableRoles = [
    { name: 'admin', display_name: '管理者' },
    { name: 'seller', display_name: '出品者' },
    { name: 'participant', display_name: '参加者' },
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = '名前は必須です';
    }

    if (!formData.email) {
      newErrors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '正しいメールアドレスを入力してください';
    }

    if (formData.roles.length === 0) {
      newErrors.roles = '少なくとも1つのロールを選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 空文字列をnullに変換
      const submitData: any = { ...formData };
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          submitData[key] = null;
        }
      });

      const response = await axios.post('/api/admin/users', submitData);
      
      if (response.data.success) {
        setSuccess('ユーザーを作成しました。パスワード設定用のメールを送信しました。');
        setTimeout(() => {
          navigate('/admin/users');
        }, 2000);
      }
    } catch (err: any) {
      console.error('ユーザー作成エラー:', err);
      setError(err.response?.data?.message || 'ユーザーの作成に失敗しました');
      
      // バリデーションエラーを設定
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: string) => {
    const newRoles = formData.roles.includes(role)
      ? formData.roles.filter((r) => r !== role)
      : [...formData.roles, role];
    
    setFormData({ ...formData, roles: newRoles });
    
    // エラーをクリア
    if (newRoles.length > 0 && errors.roles) {
      const newErrors = { ...errors };
      delete newErrors.roles;
      setErrors(newErrors);
    }
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/users')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          新規ユーザー作成
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          {/* 基本情報 */}
          <Typography variant="h6" gutterBottom>
            基本情報
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!errors.name}
                helperText={errors.name}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="メールアドレス"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!errors.email}
                helperText={errors.email || 'パスワード設定用のメールが送信されます'}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="電話番号"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={!!errors.phone}
                helperText={errors.phone}
                placeholder="090-1234-5678"
              />
            </Grid>
          </Grid>

          {/* ロール */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              ロール <span style={{ color: 'red' }}>*</span>
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <FormControl error={!!errors.roles} fullWidth>
              <List>
                {availableRoles.map((role) => (
                  <ListItem key={role.name}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.roles.includes(role.name)}
                          onChange={() => handleRoleToggle(role.name)}
                        />
                      }
                      label={role.display_name}
                    />
                  </ListItem>
                ))}
              </List>
              {errors.roles && (
                <FormHelperText>{errors.roles}</FormHelperText>
              )}
            </FormControl>
          </Box>

          {/* 住所情報 */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              住所情報（任意）
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="郵便番号"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="123-4567"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>都道府県</InputLabel>
                  <Select
                    value={formData.prefecture}
                    onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                    label="都道府県"
                  >
                    <MenuItem value="">選択してください</MenuItem>
                    {prefectures.map((pref) => (
                      <MenuItem key={pref} value={pref}>
                        {pref}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="市区町村"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="渋谷区"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="住所1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="道玄坂1-2-3"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="住所2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  placeholder="〇〇ビル4F"
                />
              </Grid>
            </Grid>
          </Box>

          {/* アクション */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/admin/users')}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
            >
              {loading ? '作成中...' : '作成'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
