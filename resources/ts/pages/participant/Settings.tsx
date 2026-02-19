import React, { useState, useEffect } from 'react';
import { LineConnectionCard } from '../../features/line-settings/components/LineConnectionCard';
import { LineNotificationList } from '../../features/line-settings/components/LineNotificationList';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  Avatar,
  CircularProgress,
  Snackbar,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

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

interface Profile {
  name: string;
  email: string;
  phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
}

interface NotificationSettings {
  email_won_item: boolean;
  email_payment_confirmed: boolean;
  email_shipping: boolean;
  email_new_auction: boolean;
  email_auction_start: boolean;
}

export default function ParticipantSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [testSending, setTestSending] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({
    name: '',
    email: '',
    phone: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_won_item: true,
    email_payment_confirmed: true,
    email_shipping: true,
    email_new_auction: true,
    email_auction_start: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/participant/settings');
      if (response.data.success) {
        const data = response.data.data;
        setProfile({
          name: data.profile.name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          postal_code: data.profile.postal_code || '',
          prefecture: data.profile.prefecture || '',
          city: data.profile.city || '',
          address_line1: data.profile.address_line1 || '',
          address_line2: data.profile.address_line2 || '',
        });
        if (data.notification_settings) {
          setNotificationSettings({
            email_won_item: data.notification_settings.email_won_item ?? true,
            email_payment_confirmed: data.notification_settings.email_payment_confirmed ?? true,
            email_shipping: data.notification_settings.email_shipping ?? true,
            email_new_auction: data.notification_settings.email_new_auction ?? true,
            email_auction_start: data.notification_settings.email_auction_start ?? true,
          });
        }
      }
    } catch (err: any) {
      console.error('設定取得エラー:', err);
      setSnackbar({ open: true, message: '設定の取得に失敗しました。', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [field]: e.target.value });
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const response = await axios.put('/api/participant/settings/profile', profile);
      if (response.data.success) {
        setSnackbar({ open: true, message: 'プロフィールを保存しました。', severity: 'success' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '保存に失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      const response = await axios.put('/api/participant/settings/notifications', notificationSettings);
      if (response.data.success) {
        setSnackbar({ open: true, message: '通知設定を保存しました。', severity: 'success' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '保存に失敗しました。', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMail = async (type: string) => {
    setTestSending(type);
    try {
      const response = await axios.post('/api/participant/settings/notifications/test', { type });
      if (response.data.success) {
        setSnackbar({ open: true, message: 'テストメールを送信しました。受信をご確認ください。', severity: 'success' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'テストメールの送信に失敗しました。', severity: 'error' });
    } finally {
      setTestSending(null);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          アカウント設定
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          プロフィールと通知設定を管理します
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* 左側：プロフィールカード */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: '#3B82F6',
                  fontSize: '2rem',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                {profile.name.charAt(0)}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {profile.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {profile.email}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 右側：タブ */}
        <Grid item xs={12} md={9}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab icon={<PersonIcon />} label="プロフィール" iconPosition="start" />
                <Tab icon={<NotificationsIcon />} label="通知設定" iconPosition="start" />
              </Tabs>
            </Box>

            {/* プロフィールタブ */}
            <TabPanel value={tabValue} index={0}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    基本情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="お名前"
                      value={profile.name}
                      onChange={handleProfileChange('name')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="メールアドレス"
                      value={profile.email}
                      disabled
                      helperText="メールアドレスは変更できません"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="電話番号"
                      value={profile.phone}
                      onChange={handleProfileChange('phone')}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <SettingsIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    配送先住所（デフォルト）
                  </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  落札時の配送先として使用されます。落札ごとに変更することも可能です。
                </Alert>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="郵便番号"
                      value={profile.postal_code}
                      onChange={handleProfileChange('postal_code')}
                      placeholder="123-4567"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="都道府県"
                      value={profile.prefecture}
                      onChange={handleProfileChange('prefecture')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="市区町村"
                      value={profile.city}
                      onChange={handleProfileChange('city')}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="住所1"
                      value={profile.address_line1}
                      onChange={handleProfileChange('address_line1')}
                      placeholder="番地・丁目"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="住所2（建物名など）"
                      value={profile.address_line2}
                      onChange={handleProfileChange('address_line2')}
                      placeholder="マンション名・部屋番号"
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

            {/* 通知設定タブ */}
            <TabPanel value={tabValue} index={1}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <NotificationsIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    メール通知設定
                  </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  受け取りたいメール通知を選択してください。重要なお知らせ（落札確定など）は設定に関わらず送信されます。
                </Alert>

                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#059669' }}>
                    取引に関する通知
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.email_won_item}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, email_won_item: e.target.checked })}
                        />
                      }
                      label="落札通知"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={testSending === 'won_item' ? <CircularProgress size={14} /> : <SendIcon />}
                      onClick={() => handleSendTestMail('won_item')}
                      disabled={testSending !== null}
                    >
                      テスト送信
                    </Button>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                    商品を落札した際にメールでお知らせします
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.email_payment_confirmed}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, email_payment_confirmed: e.target.checked })}
                        />
                      }
                      label="入金確認通知"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={testSending === 'payment_confirmed' ? <CircularProgress size={14} /> : <SendIcon />}
                      onClick={() => handleSendTestMail('payment_confirmed')}
                      disabled={testSending !== null}
                    >
                      テスト送信
                    </Button>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                    入金が確認された際にメールでお知らせします
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.email_shipping}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, email_shipping: e.target.checked })}
                        />
                      }
                      label="発送通知"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={testSending === 'shipping' ? <CircularProgress size={14} /> : <SendIcon />}
                      onClick={() => handleSendTestMail('shipping')}
                      disabled={testSending !== null}
                    >
                      テスト送信
                    </Button>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                    商品が発送された際にメールでお知らせします
                  </Typography>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#3B82F6' }}>
                    オークションに関する通知
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.email_new_auction}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, email_new_auction: e.target.checked })}
                        />
                      }
                      label="新規オークション通知"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={testSending === 'new_auction' ? <CircularProgress size={14} /> : <SendIcon />}
                      onClick={() => handleSendTestMail('new_auction')}
                      disabled={testSending !== null}
                    >
                      テスト送信
                    </Button>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                    新しいオークションが開催される際にメールでお知らせします
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSettings.email_auction_start}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, email_auction_start: e.target.checked })}
                        />
                      }
                      label="オークション開始通知"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={testSending === 'auction_start' ? <CircularProgress size={14} /> : <SendIcon />}
                      onClick={() => handleSendTestMail('auction_start')}
                      disabled={testSending !== null}
                    >
                      テスト送信
                    </Button>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6 }}>
                    オークションが開始された際にメールでお知らせします
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveNotifications}
                    disabled={saving}
                  >
                    通知設定を保存
                  </Button>
                </Box>
              </CardContent>
            </TabPanel>
          </Card>
        </Grid>
      </Grid>

      {/* LINE連携 */}
      <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <LineConnectionCard />
        <LineNotificationList />
      </Box>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
