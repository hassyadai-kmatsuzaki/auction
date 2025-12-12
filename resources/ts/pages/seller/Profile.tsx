import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Divider,
  Alert,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  Instagram as InstagramIcon,
  Language as WebIcon,
} from '@mui/icons-material';

export default function SellerProfile() {
  const [formData, setFormData] = useState({
    // 基本情報
    seller_id: 'S-0001',
    trade_name: '田中養魚場',
    corporate_name: '',
    representative_name: '田中太郎',
    
    // 連絡先
    email: 'tanaka@example.com',
    phone: '090-1234-5678',
    postal_code: '140-0001',
    address: '東京都品川区xxx 1-2-3',
    
    // SNS・Web
    instagram: '@tanaka_medaka',
    twitter: '',
    youtube: '',
    website: 'https://tanaka-medaka.example.com',
    other_sns: '',
    
    // 事業者情報
    business_registration_number: '12345678901234',
    business_type: '個人事業主',
    
    // 任意情報
    sales_channels: 'ヤフオク、メルカリ、自社EC',
    event_history: '2024年 全国メダカ品評会出展',
    event_hosting: '2023年 東京メダカ交換会主催',
    shop_address: '',
    
    // 備考
    notes: 'まじり無し品質管理徹底。生後6ヶ月以上の成魚のみ出品。',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('プロフィールを保存しました');
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            出品者情報
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            出品者として表示される情報を管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
        >
          保存
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* 左側：プロフィールカード */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: '#059669',
                  fontSize: '2rem',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                {formData.trade_name.charAt(0)}
              </Avatar>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {formData.trade_name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {formData.representative_name}
              </Typography>
              <Chip label={formData.seller_id} size="small" sx={{ bgcolor: '#F0FDF4', color: '#059669' }} />
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                SNS・Webサイト
              </Typography>
              {formData.instagram && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <InstagramIcon sx={{ color: '#E4405F', fontSize: 20 }} />
                  <Typography variant="body2">{formData.instagram}</Typography>
                </Box>
              )}
              {formData.website && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WebIcon sx={{ color: '#64748B', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{formData.website}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 右側：フォーム */}
        <Grid item xs={12} lg={8}>
          <Box component="form" onSubmit={handleSubmit}>
            {/* 基本情報 */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <StoreIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    基本情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="屋号・店舗名"
                      value={formData.trade_name}
                      onChange={handleChange('trade_name')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="法人名（任意）"
                      value={formData.corporate_name}
                      onChange={handleChange('corporate_name')}
                      helperText="法人の場合のみ"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="代表者名"
                      value={formData.representative_name}
                      onChange={handleChange('representative_name')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="事業形態"
                      value={formData.business_type}
                      onChange={handleChange('business_type')}
                      placeholder="個人事業主、株式会社など"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* 連絡先 */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    連絡先情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      type="email"
                      label="メールアドレス"
                      value={formData.email}
                      onChange={handleChange('email')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="電話番号"
                      value={formData.phone}
                      onChange={handleChange('phone')}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      required
                      label="郵便番号"
                      value={formData.postal_code}
                      onChange={handleChange('postal_code')}
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      required
                      label="住所"
                      value={formData.address}
                      onChange={handleChange('address')}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* SNS・Web */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <InstagramIcon sx={{ color: '#E4405F' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    SNS・Webサイト
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Instagram"
                      value={formData.instagram}
                      onChange={handleChange('instagram')}
                      placeholder="@username"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Twitter / X"
                      value={formData.twitter}
                      onChange={handleChange('twitter')}
                      placeholder="@username"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="YouTube"
                      value={formData.youtube}
                      onChange={handleChange('youtube')}
                      placeholder="チャンネルURL"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Webサイト"
                      value={formData.website}
                      onChange={handleChange('website')}
                      placeholder="https://"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="その他SNS"
                      value={formData.other_sns}
                      onChange={handleChange('other_sns')}
                      placeholder="TikTok、Facebookなど"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* 事業者情報 */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  事業者登録情報
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  特定商取引法に基づく表記のために必要な情報です。
                </Alert>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="事業者登録番号"
                      value={formData.business_registration_number}
                      onChange={handleChange('business_registration_number')}
                      helperText="動物取扱業登録番号など"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* 任意情報 */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  任意情報
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  入力すると出品者プロフィールに表示されます
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="販売チャネル"
                      value={formData.sales_channels}
                      onChange={handleChange('sales_channels')}
                      placeholder="ヤフオク、メルカリ、自社ECなど"
                      helperText="他に出品している場所があれば"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="イベント出店歴"
                      value={formData.event_history}
                      onChange={handleChange('event_history')}
                      placeholder="品評会出展、即売会参加など"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="イベント開催歴"
                      value={formData.event_hosting}
                      onChange={handleChange('event_hosting')}
                      placeholder="交換会主催など"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="店舗住所（実店舗がある場合）"
                      value={formData.shop_address}
                      onChange={handleChange('shop_address')}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="備考・特記事項"
                      value={formData.notes}
                      onChange={handleChange('notes')}
                      placeholder="まじり有無、品質管理、出荷時期など"
                      helperText="出品時に参照される情報"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
              >
                変更を保存
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

