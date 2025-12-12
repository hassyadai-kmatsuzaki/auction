import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Divider,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

export default function Settings() {
  const [settings, setSettings] = useState({
    site_name: 'メダカライブオークション',
    contact_email: 'info@example.com',
    price_increment_rate: '10',
    price_increment_min: '50',
    countdown_seconds: '3',
    premium_plan_fee: '300',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock: 実際はAPIを呼び出す
    alert('設定を保存しました');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        設定
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            システム設定
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="サイト名"
                value={settings.site_name}
                onChange={handleChange('site_name')}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="連絡先メールアドレス"
                type="email"
                value={settings.contact_email}
                onChange={handleChange('contact_email')}
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            オークション設定
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="価格上昇率（%）"
                value={settings.price_increment_rate}
                onChange={handleChange('price_increment_rate')}
                helperText="複数人入札時の価格上昇率"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="価格上昇の最低金額（円）"
                value={settings.price_increment_min}
                onChange={handleChange('price_increment_min')}
                helperText="最低でもこの金額は上昇します"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="カウントダウン秒数"
                value={settings.countdown_seconds}
                onChange={handleChange('countdown_seconds')}
                helperText="価格上昇までの待機時間"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="プレミアムプラン料金（円）"
                value={settings.premium_plan_fee}
                onChange={handleChange('premium_plan_fee')}
                helperText="個別撮影の追加料金"
              />
            </Grid>
          </Grid>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
          >
            設定を保存
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

