import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  Avatar,
  Chip,
  CircularProgress,
  Snackbar,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  Instagram as InstagramIcon,
  Language as WebIcon,
  AccountBalance as BankIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import NotificationPreferencesPanel, {
  NotificationRow,
} from '@/features/notifications/NotificationPreferencesPanel';

const SELLER_NOTIFICATION_ROWS: NotificationRow[] = [
  {
    category: 'auction',
    label: '新規オークション開催のお知らせ',
    description: '新しいオークションが開催される際にお知らせ',
    emailKey: 'email_new_auction',
    emailTestType: 'new_auction',
    lineType: 'new_auction',
  },
  {
    category: 'transaction',
    label: '出品商品の落札通知',
    description: '出品した商品が落札された際にお知らせ',
    emailKey: 'email_item_sold',
    emailTestType: 'item_sold',
    lineType: 'item_sold',
  },
  {
    category: 'transaction',
    label: '入金確認通知',
    description: '落札者からの入金が確認された際にお知らせ',
    emailKey: 'email_payment_received',
    emailTestType: 'payment_received',
    lineType: 'payment_received',
  },
  {
    category: 'reminder',
    label: '発送リマインダー',
    description: '発送期限が近づいた際にリマインド',
    emailKey: 'email_shipping_reminder',
    emailTestType: 'shipping_reminder',
  },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface SellerProfile {
  id: number;
  seller_code: string;
  seller_name: string;
  profile_image_path: string | null;
  profile_image_url: string | null;
  corporate_name: string | null;
  business_type: string | null;
  business_registration_number: string | null;
  contact_name: string;
  email: string;
  phone: string;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
  website: string | null;
  other_sns: string | null;
  sales_channels: string | null;
  event_history: string | null;
  event_hosting: string | null;
  shop_address: string | null;
  notes: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  notification_settings: {
    email_new_auction?: boolean;
    email_item_sold?: boolean;
    email_payment_received?: boolean;
    email_shipping_reminder?: boolean;
  } | null;
  display_settings: {
    show_sns?: boolean;
    show_sales_channels?: boolean;
    show_event_history?: boolean;
  } | null;
}

export default function SellerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // LINE連携コールバック結果のトースト表示
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const line = params.get('line');
    if (line === 'success') {
      setSnackbar({ open: true, message: 'LINE連携が完了しました', severity: 'success' });
      params.delete('line');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (line === 'error') {
      setSnackbar({ open: true, message: 'LINE連携に失敗しました', severity: 'error' });
      params.delete('line');
      params.delete('reason');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [formData, setFormData] = useState({
    seller_name: '',
    corporate_name: '',
    business_type: '',
    business_registration_number: '',
    contact_name: '',
    email: '',
    phone: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
    instagram: '',
    twitter: '',
    youtube: '',
    website: '',
    other_sns: '',
    sales_channels: '',
    event_history: '',
    event_hosting: '',
    shop_address: '',
    notes: '',
  });

  const [bankData, setBankData] = useState({
    bank_name: '',
    bank_branch: '',
    account_type: 'savings',
    account_number: '',
    account_holder: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    email_new_auction: true,
    email_item_sold: true,
    email_payment_received: true,
    email_shipping_reminder: true,
  });

  const [displaySettings, setDisplaySettings] = useState({
    show_sns: true,
    show_sales_channels: true,
    show_event_history: true,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/seller/profile');
      if (response.data.success) {
        const p = response.data.data.profile;
        setProfile(p);
        setFormData({
          seller_name: p.seller_name || '',
          corporate_name: p.corporate_name || '',
          business_type: p.business_type || '',
          business_registration_number: p.business_registration_number || '',
          contact_name: p.contact_name || '',
          email: p.email || '',
          phone: p.phone || '',
          postal_code: p.postal_code || '',
          prefecture: p.prefecture || '',
          city: p.city || '',
          address_line1: p.address_line1 || '',
          address_line2: p.address_line2 || '',
          instagram: p.instagram || '',
          twitter: p.twitter || '',
          youtube: p.youtube || '',
          website: p.website || '',
          other_sns: p.other_sns || '',
          sales_channels: p.sales_channels || '',
          event_history: p.event_history || '',
          event_hosting: p.event_hosting || '',
          shop_address: p.shop_address || '',
          notes: p.notes || '',
        });
        setBankData({
          bank_name: p.bank_name || '',
          bank_branch: p.bank_branch || '',
          account_type: p.account_type || 'savings',
          account_number: p.account_number || '',
          account_holder: p.account_holder || '',
        });
        if (p.notification_settings) {
          setNotificationSettings({
            email_new_auction: p.notification_settings.email_new_auction ?? true,
            email_item_sold: p.notification_settings.email_item_sold ?? true,
            email_payment_received: p.notification_settings.email_payment_received ?? true,
            email_shipping_reminder: p.notification_settings.email_shipping_reminder ?? true,
          });
        }
        if (p.display_settings) {
          setDisplaySettings({
            show_sns: p.display_settings.show_sns ?? true,
            show_sales_channels: p.display_settings.show_sales_channels ?? true,
            show_event_history: p.display_settings.show_event_history ?? true,
          });
        }
      }
    } catch (err: any) {
      console.error('プロフィール取得エラー:', err);
      setSnackbar({ open: true, message: 'プロフィールの取得に失敗しました。', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleBankChange = (field: string) => (e: any) => {
    setBankData({ ...bankData, [field]: e.target.value });
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await axios.put('/api/seller/profile', formData);
      setSnackbar({ open: true, message: 'プロフィールを保存しました。', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '保存に失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBank = async () => {
    try {
      setSaving(true);
      await axios.put('/api/seller/profile/bank', bankData);
      setSnackbar({ open: true, message: '口座情報を保存しました。', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '保存に失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({ open: true, message: '画像サイズは5MB以下にしてください。', severity: 'error' });
      return;
    }
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('image', file);
      const response = await axios.post('/api/seller/profile/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        const { profile_image_path, profile_image_url } = response.data.data;
        setProfile((prev) => prev ? { ...prev, profile_image_path, profile_image_url } : prev);
        setSnackbar({ open: true, message: 'プロフィール画像をアップロードしました。', severity: 'success' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '画像のアップロードに失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileImageDelete = async () => {
    try {
      setSaving(true);
      await axios.delete('/api/seller/profile/image');
      setProfile((prev) => prev ? { ...prev, profile_image_path: null, profile_image_url: null } : prev);
      setSnackbar({ open: true, message: 'プロフィール画像を削除しました。', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '削除に失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDisplay = async () => {
    try {
      setSaving(true);
      await axios.put('/api/seller/profile/display', displaySettings);
      setSnackbar({ open: true, message: '表示設定を保存しました。', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '保存に失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          出品者情報・設定
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          出品者として表示される情報と各種設定を管理します
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* 左側：プロフィールカード */}
        <Grid item xs={12} lg={3}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                <Avatar
                  src={profile?.profile_image_url || undefined}
                  sx={{
                    width: 96,
                    height: 96,
                    bgcolor: '#059669',
                    fontSize: '2.25rem',
                    mx: 'auto',
                  }}
                >
                  {!profile?.profile_image_url && formData.seller_name.charAt(0)}
                </Avatar>
                <IconButton
                  component="label"
                  size="small"
                  disabled={saving}
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    bgcolor: '#059669',
                    color: 'white',
                    '&:hover': { bgcolor: '#047857' },
                    width: 32,
                    height: 32,
                  }}
                >
                  <PhotoCameraIcon sx={{ fontSize: 18 }} />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleProfileImageChange}
                  />
                </IconButton>
              </Box>
              {profile?.profile_image_url && (
                <Box sx={{ mb: 1.5 }}>
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                    onClick={handleProfileImageDelete}
                    disabled={saving}
                    sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
                  >
                    画像を削除
                  </Button>
                </Box>
              )}
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {formData.seller_name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {formData.contact_name}
              </Typography>
              <Chip label={profile?.seller_code || ''} size="small" sx={{ bgcolor: '#F0FDF4', color: '#059669' }} />
            </CardContent>
          </Card>

          {(formData.instagram || formData.website) && (
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
          )}
        </Grid>

        {/* 右側：タブ */}
        <Grid item xs={12} lg={9}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
                <Tab icon={<StoreIcon />} label="基本情報" iconPosition="start" />
                <Tab icon={<InstagramIcon />} label="任意情報" iconPosition="start" />
                <Tab icon={<BankIcon />} label="口座情報" iconPosition="start" />
                <Tab icon={<SettingsIcon />} label="設定" iconPosition="start" />
              </Tabs>
            </Box>

            {/* 基本情報タブ */}
            <TabPanel value={tabValue} index={0}>
              <CardContent sx={{ p: 3 }}>
                {/* 基本情報 */}
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
                      value={formData.seller_name}
                      onChange={handleChange('seller_name')}
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
                      value={formData.contact_name}
                      onChange={handleChange('contact_name')}
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

                <Divider sx={{ my: 4 }} />

                {/* 連絡先 */}
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
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="郵便番号"
                      value={formData.postal_code}
                      onChange={handleChange('postal_code')}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="都道府県"
                      value={formData.prefecture}
                      onChange={handleChange('prefecture')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="市区町村"
                      value={formData.city}
                      onChange={handleChange('city')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="住所1"
                      value={formData.address_line1}
                      onChange={handleChange('address_line1')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="住所2（建物名など）"
                      value={formData.address_line2}
                      onChange={handleChange('address_line2')}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                {/* 事業者情報 */}
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
                      label="事業者登録番号"
                      value={formData.business_registration_number}
                      onChange={handleChange('business_registration_number')}
                      helperText="動物取扱業登録番号など"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    変更を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>

            {/* 任意情報タブ */}
            <TabPanel value={tabValue} index={1}>
              <CardContent sx={{ p: 3 }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  任意入力項目です。入力すると出品者プロフィールに表示されます。
                </Alert>

                {/* SNS・Web */}
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

                <Divider sx={{ my: 4 }} />

                {/* その他の任意情報 */}
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  活動・店舗情報
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="販売チャネル"
                      value={formData.sales_channels}
                      onChange={handleChange('sales_channels')}
                      placeholder="ヤフオク、メルカリ、自社ECなど"
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
                    />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    変更を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>

            {/* 口座情報タブ */}
            <TabPanel value={tabValue} index={2}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <BankIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    振込先口座情報
                  </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  落札代金の振込先として使用されます。正確にご入力ください。
                </Alert>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="銀行名"
                      value={bankData.bank_name}
                      onChange={handleBankChange('bank_name')}
                      placeholder="○○銀行"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="支店名"
                      value={bankData.bank_branch}
                      onChange={handleBankChange('bank_branch')}
                      placeholder="○○支店"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth required>
                      <InputLabel>口座種別</InputLabel>
                      <Select
                        value={bankData.account_type}
                        label="口座種別"
                        onChange={handleBankChange('account_type')}
                      >
                        <MenuItem value="savings">普通</MenuItem>
                        <MenuItem value="checking">当座</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      required
                      label="口座番号"
                      value={bankData.account_number}
                      onChange={handleBankChange('account_number')}
                      placeholder="1234567"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      required
                      label="口座名義（カナ）"
                      value={bankData.account_holder}
                      onChange={handleBankChange('account_holder')}
                      placeholder="タナカ タロウ"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveBank}
                    disabled={saving}
                  >
                    口座情報を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>

            {/* 設定タブ */}
            <TabPanel value={tabValue} index={3}>
              <CardContent sx={{ p: 3 }}>
                {/* 通知設定 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <NotificationsIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    通知設定
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  メールとLINEの通知をまとめて管理できます。LINE連携後はLINE列のトグルも有効になります。
                </Typography>

                <NotificationPreferencesPanel
                  role="seller"
                  rows={SELLER_NOTIFICATION_ROWS}
                  emailSettings={notificationSettings as unknown as Record<string, boolean>}
                  emailUpdateUrl="/api/seller/profile/notifications"
                  emailTestUrl="/api/seller/profile/notifications/test"
                  onSaved={(next) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      ...(next as typeof notificationSettings),
                    })
                  }
                  onNotify={(message, severity) => setSnackbar({ open: true, message, severity })}
                />

                <Divider sx={{ my: 4 }} />

                {/* 表示設定 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <SettingsIcon sx={{ color: '#8B5CF6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    プロフィール表示設定
                  </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={displaySettings.show_sns}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, show_sns: e.target.checked })}
                      />
                    }
                    label="SNS情報を公開する"
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                    Instagram、Twitter等のSNS情報を出品者プロフィールに表示します
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={displaySettings.show_sales_channels}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, show_sales_channels: e.target.checked })}
                      />
                    }
                    label="販売チャネルを公開する"
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                    他の販売チャネル情報を出品者プロフィールに表示します
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={displaySettings.show_event_history}
                        onChange={(e) => setDisplaySettings({ ...displaySettings, show_event_history: e.target.checked })}
                      />
                    }
                    label="イベント履歴を公開する"
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6 }}>
                    イベント出店・開催歴を出品者プロフィールに表示します
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                    onClick={handleSaveDisplay}
                    disabled={saving}
                  >
                    表示設定を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>
          </Card>
        </Grid>
      </Grid>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
