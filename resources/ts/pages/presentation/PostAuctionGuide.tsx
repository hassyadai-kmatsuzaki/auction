/**
 * オークション完了後の落札者管理ガイド
 * 落札物の確認、通知設定、設定ページの説明を含む
 * ガイド付きデモ用のステップバイステップ説明 & ガイドなしデモ用の管理画面
 */
import { useState } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid, Tabs, Tab,
  Card, CardContent, Chip, Stepper, Step, StepLabel,
  TextField, Avatar, Switch, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Alert,
  Snackbar,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Receipt as ReceiptIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  LocalShipping as LocalShippingIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import type { WonEntry, MockWonItem } from './mockData';
import {
  MOCK_WON_ITEMS, getPaymentStatusLabel, getPaymentStatusColor,
  getDeliveryStatusLabel, getDeliveryStepIndex, getTrackingUrl,
} from './mockData';

// ====================================================================
// タブ定義
// ====================================================================

const TAB_ITEMS = [
  { value: 'won-items', label: '落札管理', icon: <ReceiptIcon /> },
  { value: 'notifications', label: '通知設定', icon: <NotificationsIcon /> },
  { value: 'settings', label: '設定', icon: <SettingsIcon /> },
];

interface PostAuctionGuideProps {
  /** デモで落札したアイテム一覧 */
  wonItems: WonEntry[];
  /** ガイドモード（true=ステップバイステップ案内付き、false=自由閲覧） */
  isGuided: boolean;
  /** トップに戻るコールバック */
  onBackToTop: () => void;
}

/**
 * 落札者管理画面（統一UI）
 * ガイド付きもガイドなしも同じ画面構成。
 * ガイド付きの場合はステッパーとナビゲーションボタンが追加される。
 */
export function PostAuctionGuide({ wonItems, isGuided, onBackToTop }: PostAuctionGuideProps) {
  const [currentTab, setCurrentTab] = useState('won-items');

  // ガイド付きの場合のステップ番号（タブ値から算出）
  const currentStepIndex = TAB_ITEMS.findIndex(t => t.value === currentTab);

  const handleGuidedPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentTab(TAB_ITEMS[currentStepIndex - 1].value);
    } else {
      onBackToTop();
    }
  };

  const handleGuidedNext = () => {
    if (currentStepIndex < TAB_ITEMS.length - 1) {
      setCurrentTab(TAB_ITEMS[currentStepIndex + 1].value);
    } else {
      onBackToTop();
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)', color: 'white', py: 3, px: 2 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {isGuided ? '落札者管理ガイド' : 'オークション完了'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isGuided
                  ? 'オークション終了後の操作を一つずつ確認していきましょう'
                  : '落札結果の確認と各種設定ができます'}
              </Typography>
            </Box>
            <Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} onClick={onBackToTop}>
              トップに戻る
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Won items summary */}
      {wonItems.length > 0 && (
        <Container maxWidth="lg" sx={{ pt: 3 }}>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrophyIcon color="warning" />
              <Typography variant="subtitle1" fontWeight="bold">落札おめでとうございます！</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {wonItems.length}点の商品を落札しました。合計: ¥{wonItems.reduce((s, w) => s + w.total_amount, 0).toLocaleString()}
            </Typography>
          </Paper>
        </Container>
      )}

      {/* Stepper（ガイド付きのみ） */}
      {isGuided && (
        <Container maxWidth="lg" sx={{ pt: wonItems.length > 0 ? 1 : 3 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stepper activeStep={currentStepIndex} alternativeLabel>
              {TAB_ITEMS.map((tab, index) => (
                <Step key={tab.value} completed={index < currentStepIndex}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setCurrentTab(tab.value)}>
                  <StepLabel>{tab.label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
        </Container>
      )}

      {/* Tabs */}
      <Container maxWidth="lg" sx={{ pt: isGuided ? 0 : 1 }}>
        <Paper sx={{ mb: 3 }}>
          <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
            {TAB_ITEMS.map(tab => (
              <Tab key={tab.value} value={tab.value} label={tab.label} icon={tab.icon} iconPosition="start" />
            ))}
          </Tabs>
        </Paper>

        {currentTab === 'won-items' && <StepWonItemManagement />}
        {currentTab === 'notifications' && <StepNotificationSettings />}
        {currentTab === 'settings' && <StepAccountSettings />}

        {/* ガイド付きナビゲーション */}
        {isGuided && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, mb: 4 }}>
            <Button
              variant="outlined"
              startIcon={currentStepIndex === 0 ? <HomeIcon /> : <ArrowBackIcon />}
              onClick={handleGuidedPrev}
            >
              {currentStepIndex === 0 ? 'トップに戻る' : '前へ'}
            </Button>
            {currentStepIndex < TAB_ITEMS.length - 1 ? (
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={handleGuidedNext}>
                次へ
              </Button>
            ) : (
              <Button variant="contained" color="success" onClick={onBackToTop}>
                デモ完了！トップに戻る
              </Button>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}

// ====================================================================
// 落札管理画面
// ====================================================================

function StepWonItemManagement() {
  const [activeTab, setActiveTab] = useState('all');
  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MockWonItem | null>(null);
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MockWonItem | null>(null);
  const [addressForm, setAddressForm] = useState({
    shipping_postal_code: '', shipping_prefecture: '', shipping_city: '',
    shipping_address_line1: '', shipping_address_line2: '', shipping_name: '', shipping_phone: '',
  });
  const [wonItemAddresses, setWonItemAddresses] = useState<Record<number, string>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const getWonItemAddress = (item: MockWonItem) => wonItemAddresses[item.id] ?? item.shipping_address;

  const summary = {
    total_amount: MOCK_WON_ITEMS.reduce((s, w) => s + w.total_amount, 0),
    paid_amount: MOCK_WON_ITEMS.filter(w => w.payment_status !== 'pending').reduce((s, w) => s + w.total_amount, 0),
    pending_amount: MOCK_WON_ITEMS.filter(w => w.payment_status === 'pending').reduce((s, w) => s + w.total_amount, 0),
  };

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'payment_pending': return MOCK_WON_ITEMS.filter(i => i.payment_status === 'pending');
      case 'shipping_pending': return MOCK_WON_ITEMS.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status));
      case 'shipped': return MOCK_WON_ITEMS.filter(i => i.delivery_status === 'shipped');
      case 'completed': return MOCK_WON_ITEMS.filter(i => i.delivery_status === 'completed');
      default: return MOCK_WON_ITEMS;
    }
  };

  const filteredItems = getFilteredItems();
  const tabCounts = {
    all: MOCK_WON_ITEMS.length,
    payment_pending: MOCK_WON_ITEMS.filter(i => i.payment_status === 'pending').length,
    shipping_pending: MOCK_WON_ITEMS.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status)).length,
    shipped: MOCK_WON_ITEMS.filter(i => i.delivery_status === 'shipped').length,
    completed: MOCK_WON_ITEMS.filter(i => i.delivery_status === 'completed').length,
  };

  const handleEditAddress = (item: MockWonItem) => {
    setAddressForm({
      shipping_postal_code: '150-0001', shipping_prefecture: '東京都',
      shipping_city: '渋谷区', shipping_address_line1: '神宮前1-2-3',
      shipping_address_line2: 'メダカハイツ101', shipping_name: 'デモ ユーザー', shipping_phone: '090-1234-5678',
    });
    setEditingItem(item);
    setEditAddressOpen(true);
  };

  const handleSaveAddress = () => {
    if (!editingItem) return;
    const addr = `〒${addressForm.shipping_postal_code} ${addressForm.shipping_prefecture}${addressForm.shipping_city}${addressForm.shipping_address_line1} ${addressForm.shipping_address_line2}`;
    setWonItemAddresses(prev => ({ ...prev, [editingItem.id]: addr }));
    setSnackbar({ open: true, message: '配送先を更新しました', severity: 'success' });
    setEditAddressOpen(false);
    setEditingItem(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        落札管理画面では、支払い状況の確認・配送先の設定・配送状況の追跡ができます。
        各タブで状態別に商品をフィルタできます。
      </Alert>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">合計金額</Typography>
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              ¥{summary.total_amount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">支払済み</Typography>
            <Typography variant="h6" fontWeight="bold" color="success.main">
              ¥{summary.paid_amount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">未払い</Typography>
            <Typography variant="h6" fontWeight="bold" color="warning.main">
              ¥{summary.pending_amount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab value="all" label={`全て (${tabCounts.all})`} />
          <Tab value="payment_pending" label={`支払い待ち (${tabCounts.payment_pending})`} />
          <Tab value="shipping_pending" label={`発送待ち (${tabCounts.shipping_pending})`} />
          <Tab value="shipped" label={`配送中 (${tabCounts.shipped})`} />
          <Tab value="completed" label={`完了 (${tabCounts.completed})`} />
        </Tabs>
      </Paper>

      {/* Items */}
      {filteredItems.map(item => (
        <Paper key={item.id} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box sx={{
              width: { xs: '100%', sm: 100 }, height: { xs: 150, sm: 100 },
              borderRadius: 1.5, overflow: 'hidden', bgcolor: 'grey.100', flexShrink: 0,
            }}>
              <img src={item.item.thumbnail_path || '/img/noimage.png'} alt={item.item.species_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                No.{item.item.item_number} {item.item.species_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {item.item.auction.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Chip
                  label={getPaymentStatusLabel(item.payment_status)}
                  size="small"
                  sx={{ ...getPaymentStatusColor(item.payment_status), fontWeight: 600 }}
                />
                <Chip
                  label={getDeliveryStatusLabel(item.delivery_status)}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2">
                  落札額: <strong>¥{item.winning_price.toLocaleString()}</strong> x {item.quantity}匹
                </Typography>
                <Typography variant="body2" color="primary.main" fontWeight="bold">
                  合計: ¥{item.total_amount.toLocaleString()}
                </Typography>
              </Box>

              {/* Delivery tracking */}
              {item.delivery_status !== 'pending' && (
                <Box sx={{ mt: 1.5 }}>
                  <Stepper activeStep={getDeliveryStepIndex(item.delivery_status)} alternativeLabel sx={{ mb: 1 }}>
                    <Step><StepLabel>発送準備</StepLabel></Step>
                    <Step><StepLabel>配送中</StepLabel></Step>
                    <Step><StepLabel>配達完了</StepLabel></Step>
                  </Stepper>
                  {item.tracking_number && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <LocalShippingIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {item.shipping_company}: {item.tracking_number}
                      </Typography>
                      <IconButton size="small" onClick={() => handleCopy(item.tracking_number!)}>
                        <CopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      {item.shipping_company && (
                        <IconButton size="small" onClick={() => {
                          setSelectedItem(item);
                          setTrackingDetailOpen(true);
                        }}>
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Shipping address */}
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  配送先: {getWonItemAddress(item)}
                </Typography>
                <IconButton size="small" onClick={() => handleEditAddress(item)}>
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Paper>
      ))}

      {/* Edit address dialog */}
      <Dialog open={editAddressOpen} onClose={() => setEditAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">配送先の編集</Typography>
            <IconButton onClick={() => setEditAddressOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={6}>
              <TextField fullWidth label="郵便番号" value={addressForm.shipping_postal_code}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_postal_code: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="都道府県" value={addressForm.shipping_prefecture}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_prefecture: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="市区町村" value={addressForm.shipping_city}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_city: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="番地" value={addressForm.shipping_address_line1}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_address_line1: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="建物名・部屋番号" value={addressForm.shipping_address_line2}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_address_line2: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="お名前" value={addressForm.shipping_name}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_name: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="電話番号" value={addressForm.shipping_phone}
                onChange={(e) => setAddressForm({ ...addressForm, shipping_phone: e.target.value })} size="small" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAddressOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSaveAddress}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Tracking URL dialog */}
      <Dialog open={trackingDetailOpen} onClose={() => setTrackingDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送状況の確認</DialogTitle>
        <DialogContent>
          {selectedItem && selectedItem.tracking_number && selectedItem.shipping_company && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedItem.shipping_company}の追跡ページを開きます
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                追跡番号: {selectedItem.tracking_number}
              </Typography>
              <Alert severity="info">
                デモのため、実際の追跡ページは開きません。
                本番では「{getTrackingUrl(selectedItem.tracking_number, selectedItem.shipping_company)}」が開きます。
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDetailOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ====================================================================
// Step 2: 通知設定
// ====================================================================

function StepNotificationSettings() {
  const [notifications, setNotifications] = useState({
    email_won_item: true,
    email_payment_confirmed: true,
    email_shipping: true,
    email_new_auction: true,
    email_auction_start: true,
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const notificationItems = [
    { key: 'email_won_item', label: '落札通知', description: '商品を落札した際にメールでお知らせします' },
    { key: 'email_payment_confirmed', label: '入金確認通知', description: '入金が確認された際にメールでお知らせします' },
    { key: 'email_shipping', label: '発送通知', description: '商品が発送された際にメールでお知らせします' },
    { key: 'email_new_auction', label: '新規オークション通知', description: '新しいオークションが公開された際にメールでお知らせします' },
    { key: 'email_auction_start', label: 'オークション開始通知', description: 'オークション開始時にメールでお知らせします' },
  ];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        通知設定画面では、メールやLINEでの各種通知のオン/オフを切り替えられます。
        オークションの開始や落札結果を見逃さないよう、必要な通知を有効にしておきましょう。
      </Alert>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <EmailIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">メール通知</Typography>
        </Box>

        {notificationItems.map((item, index) => (
          <Box key={item.key}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">{item.description}</Typography>
              </Box>
              <Switch
                checked={notifications[item.key as keyof typeof notifications]}
                onChange={(e) => {
                  setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }));
                  setSnackbar({ open: true, message: `${item.label}を${e.target.checked ? 'オン' : 'オフ'}にしました` });
                }}
              />
            </Box>
            {index < notificationItems.length - 1 && <Divider />}
          </Box>
        ))}

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box component="img" src="/img/line-icon.png" alt="LINE" sx={{ width: 24, height: 24 }}
            onError={(e: any) => { e.target.style.display = 'none'; }} />
          <Typography variant="h6" fontWeight="bold">LINE通知</Typography>
        </Box>
        <Alert severity="warning" sx={{ mb: 2 }}>
          LINE連携を行うと、メール通知に加えてLINEでも通知を受け取れます。
          デモでは連携操作はスキップされます。
        </Alert>
        <Button variant="outlined" color="success" disabled>
          LINEアカウントを連携する（デモ）
        </Button>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={2000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// ====================================================================
// Step 3: 設定ページ
// ====================================================================

function StepAccountSettings() {
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [profile, setProfile] = useState({
    name: 'デモ ユーザー', email: 'demo@example.com', phone: '090-1234-5678',
    postal_code: '150-0001', prefecture: '東京都', city: '渋谷区',
    address_line1: '神宮前1-2-3', address_line2: 'メダカハイツ101',
  });

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        設定ページでは、プロフィール情報の編集と通知設定の管理ができます。
        配送先住所もここで登録・変更できます。
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: '#3B82F6', fontSize: '2rem', mx: 'auto', mb: 2 }}>
                {profile.name.charAt(0)}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{profile.name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{profile.email}</Typography>
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
              </Tabs>
            </Box>

            {tabValue === 0 && (
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>基本情報</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="お名前" value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="メールアドレス" value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="電話番号" value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="郵便番号" value={profile.postal_code}
                      onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="都道府県" value={profile.prefecture}
                      onChange={(e) => setProfile({ ...profile, prefecture: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="市区町村" value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="番地" value={profile.address_line1}
                      onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="建物名・部屋番号" value={profile.address_line2}
                      onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })} />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="contained" onClick={() => setSnackbar({ open: true, message: 'プロフィールを更新しました（デモ）' })}>
                    保存
                  </Button>
                </Box>
              </CardContent>
            )}

            {tabValue === 1 && (
              <CardContent sx={{ p: 3 }}>
                <StepNotificationSettings />
              </CardContent>
            )}
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={2000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
