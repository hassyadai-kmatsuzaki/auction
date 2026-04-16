import React, { useState, useEffect } from 'react';
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
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import TwoFactorSettings from '../../features/settings/TwoFactorSettings';
import NotificationPreferencesPanel, {
  NotificationRow,
} from '@/features/notifications/NotificationPreferencesPanel';

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

const NOTIFICATION_ROWS: NotificationRow[] = [
  {
    category: 'transaction',
    label: '落札通知',
    description: '商品を落札した際にお知らせ',
    emailKey: 'email_won_item',
    emailTestType: 'won_item',
    lineType: 'won_item',
  },
  {
    category: 'transaction',
    label: '入金確認通知',
    description: '入金が確認された際にお知らせ',
    emailKey: 'email_payment_confirmed',
    emailTestType: 'payment_confirmed',
  },
  {
    category: 'transaction',
    label: '発送通知',
    description: '商品が発送された際にお知らせ',
    emailKey: 'email_shipping',
    emailTestType: 'shipping',
    lineType: 'shipping_completed',
  },
  {
    category: 'auction',
    label: '新規オークション通知',
    description: '新しいオークションの開催案内',
    emailKey: 'email_new_auction',
    emailTestType: 'new_auction',
    lineType: 'new_auction',
  },
  {
    category: 'auction',
    label: 'オークション開始通知',
    description: 'オークション開始時にお知らせ',
    emailKey: 'email_auction_start',
    emailTestType: 'auction_start',
    lineType: 'auction_start',
  },
  {
    category: 'auction',
    label: 'オークション予告（前日）',
    description: '開催前日にLINEでリマインド',
    lineType: 'auction_preview',
  },
  {
    category: 'reminder',
    label: '指値発動通知',
    description: '指値が発動・更新された際にお知らせ',
    lineType: 'bid_limit_reached',
  },
  {
    category: 'reminder',
    label: 'お気に入り順番接近通知',
    description: 'お気に入り商品の出番が近づいたら通知',
    lineType: 'favorite_approaching',
  },
  {
    category: 'reminder',
    label: '入金催促',
    description: '支払い期限が近い場合にリマインド',
    lineType: 'payment_reminder',
  },
];

export default function ParticipantSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

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

  // LINE連携コールバックの結果をトースト表示
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
      setSnackbar({
        open: true,
        message: err.response?.data?.message || '保存に失敗しました。',
        severity: 'error',
      });
    } finally {
      setSaving(false);
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          アカウント設定
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          プロフィールと通知設定を管理します
        </Typography>
      </Box>

      <Grid container spacing={3}>
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  mt: 1,
                }}
              >
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {profile.email}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={9}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab icon={<PersonIcon />} label="プロフィール" iconPosition="start" />
                <Tab icon={<NotificationsIcon />} label="通知設定" iconPosition="start" />
                <Tab icon={<SecurityIcon />} label="セキュリティ" iconPosition="start" />
              </Tabs>
            </Box>

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

            <TabPanel value={tabValue} index={1}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <NotificationsIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    通知設定
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  メールとLINEの通知をまとめて管理できます。LINE連携後はLINE列のトグルも有効になります。
                </Typography>

                <NotificationPreferencesPanel
                  role="participant"
                  rows={NOTIFICATION_ROWS}
                  emailSettings={notificationSettings as unknown as Record<string, boolean>}
                  emailUpdateUrl="/api/participant/settings/notifications"
                  emailTestUrl="/api/participant/settings/notifications/test"
                  onSaved={(next) =>
                    setNotificationSettings({ ...(next as unknown as NotificationSettings) })
                  }
                  onNotify={(message, severity) => setSnackbar({ open: true, message, severity })}
                />
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <CardContent sx={{ p: 3 }}>
                <TwoFactorSettings />
              </CardContent>
            </TabPanel>
          </Card>
        </Grid>
      </Grid>

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
