/**
 * オークション完了後の落札者管理ガイド
 * 落札物の確認、通知設定、設定ページの説明を含む
 * ガイド付きデモ用のステップバイステップ説明 & ガイドなしデモ用の管理画面
 */
import { useState } from 'react';
import {
  Box, Container, Typography, Button, Paper, Grid, Tabs, Tab,
  Card, CardContent, CardMedia, Chip, Stepper, Step, StepLabel,
  TextField, Avatar, Switch, FormControlLabel, Divider, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Alert,
  Snackbar, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Save as SaveIcon,
  Send as SendIcon,
  LocalShipping as LocalShippingIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  Event as EventIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { WonEntry, MockWonItem } from './mockData';
import {
  getPaymentStatusLabel, getPaymentStatusColor,
  getDeliveryStatusLabel, getDeliveryStepIndex,
} from './mockData';

// ====================================================================
// タブ定義
// ====================================================================


interface PostAuctionGuideProps {
  /** デモで落札したアイテム一覧 */
  wonItems: WonEntry[];
  /** トップに戻るコールバック */
  onBackToTop: () => void;
  /** 初期表示タブ */
  initialTab?: string;
  /** 外部制御のタブ値（設定されている場合、内部状態より優先） */
  controlledTab?: string;
  /** タブが変更された際のコールバック */
  onTabChange?: (tab: string) => void;
  /** 設定タブ内のサブタブ制御（0=プロフィール、1=通知設定） */
  controlledSettingsSubTab?: number;
  /** 設定サブタブが変更された際のコールバック */
  onSettingsSubTabChange?: (subTab: number) => void;
}

/**
 * 落札者管理画面（統一UI）
 * ガイド付きもガイドなしも同じ画面構成。
 * ガイド付きの場合はステッパーとナビゲーションボタンが追加される。
 */
export function PostAuctionGuide({ wonItems, initialTab, controlledTab, onTabChange, controlledSettingsSubTab, onSettingsSubTabChange }: PostAuctionGuideProps) {
  const [internalTab, setInternalTab] = useState(initialTab || 'won-items');
  const currentTab = controlledTab ?? internalTab;
  const setCurrentTab = (tab: string) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  // 未使用だがインターフェースの互換性のため setCurrentTab を保持
  void setCurrentTab;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {currentTab === 'won-items' ? (
        <>
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
          <Container maxWidth="lg" sx={{ pt: 1 }}>
            <StepWonItemManagement wonItems={wonItems} />
          </Container>
        </>
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <StepAccountSettings controlledSubTab={controlledSettingsSubTab} onSubTabChange={onSettingsSubTabChange} />
        </Container>
      )}
    </Box>
  );
}

// ====================================================================
// 落札管理画面（実際の WonItems.tsx と同一デザイン）
// ====================================================================

function StepWonItemManagement({ wonItems }: { wonItems: WonEntry[] }) {
  const [activeTab, setActiveTab] = useState('all');
  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MockWonItem | null>(null);
  const shippingAddress = '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101';
  const shippingCalculated = false; // デモでは送料未計算
  const MOCK_SHIPPING_FEE = 1500;
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Generate mock data from actual won items
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const paymentDeadline = tomorrow.toISOString().split('T')[0];

  const auctionTitle = '2026年春季メダカオークション';
  const auctionDate = new Date().toISOString().split('T')[0];
  const allItems: MockWonItem[] = wonItems.map((w, i) => ({
    id: i + 1,
    item: {
      id: i + 1,
      item_number: i + 1,
      species_name: w.species_name,
      quantity: w.quantity,
      thumbnail_path: '/img/noimage.png',
      auction: { id: 1, title: '2026年春季メダカオークション', event_date: new Date().toISOString().split('T')[0] },
    },
    winning_price: w.winning_price,
    quantity: w.quantity,
    total_amount: w.total_amount,
    commission_amount: Math.floor(w.winning_price * w.quantity * 0.1),
    payment_status: 'pending' as const,
    payment_deadline: paymentDeadline,
    delivery_status: 'pending' as const,
    shipping_address: '未設定',
  }));

  const summary = {
    total_amount: allItems.reduce((s, w) => s + w.total_amount, 0),
    paid_amount: allItems.filter(w => w.payment_status !== 'pending').reduce((s, w) => s + w.total_amount, 0),
    pending_amount: allItems.filter(w => w.payment_status === 'pending').reduce((s, w) => s + w.total_amount, 0),
    item_count: allItems.length,
    auction_count: 1,
  };

  const allPaid = allItems.every(i => i.payment_status !== 'pending');
  const anyPending = allItems.some(i => i.payment_status === 'pending');

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'payment_pending': return allItems.filter(i => i.payment_status === 'pending');
      case 'shipping_pending': return allItems.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status));
      case 'shipped': return allItems.filter(i => i.delivery_status === 'shipped');
      case 'completed': return allItems.filter(i => i.delivery_status === 'completed');
      default: return allItems;
    }
  };

  const filteredItems = getFilteredItems();
  const tabCounts = {
    all: allItems.length,
    payment_pending: allItems.filter(i => i.payment_status === 'pending').length,
    shipping_pending: allItems.filter(i => ['paid', 'confirmed'].includes(i.payment_status) && ['pending', 'preparing'].includes(i.delivery_status)).length,
    shipped: allItems.filter(i => i.delivery_status === 'shipped').length,
    completed: allItems.filter(i => i.delivery_status === 'completed').length,
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setSnackbar({ open: true, message: 'コピーしました', severity: 'success' });
  };

  if (wonItems.length === 0) {
    return (
      <Box>
        <Typography data-tour-target="won-items-header" variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          落札管理
        </Typography>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <TrophyIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            落札した商品はまだありません
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            オークションで商品を落札すると、ここに表示されます。
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー — 実際の WonItems.tsx と同じ */}
      <Typography data-tour-target="won-items-header" variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        落札管理
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        落札した商品の支払い状況と配送状況を確認できます
      </Typography>

      {/* サマリー — 実際の WonItems.tsx と同じ4カラム */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>合計落札金額</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>¥{summary.total_amount.toLocaleString()}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {summary.auction_count}件のオークション / {summary.item_count}品
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2.5, bgcolor: '#ECFDF5' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>入金確認済み</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>¥{summary.paid_amount.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2.5, bgcolor: '#FEF3C7' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>支払い待ち</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>¥{summary.pending_amount.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>配送料金合計</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#64748B' }}>¥{shippingCalculated ? MOCK_SHIPPING_FEE.toLocaleString() : 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* タブフィルター — 実際と同じ */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`すべて (${tabCounts.all})`} value="all" />
          <Tab label={`支払い待ち (${tabCounts.payment_pending})`} value="payment_pending" />
          <Tab label={`発送待ち (${tabCounts.shipping_pending})`} value="shipping_pending" />
          <Tab label={`配送中 (${tabCounts.shipped})`} value="shipped" />
          <Tab label={`配達完了 (${tabCounts.completed})`} value="completed" />
        </Tabs>
      </Paper>

      {/* オークション別アコーディオン — 実際と同じ */}
      {filteredItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {activeTab === 'all' ? '落札した商品はまだありません。' : '該当する商品はありません。'}
          </Typography>
        </Paper>
      ) : (
        <Accordion defaultExpanded sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2, flexWrap: 'wrap' }}>
              <EventIcon sx={{ color: 'text.secondary' }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{auctionTitle}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {auctionDate} / {filteredItems.length}品落札
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                ¥{filteredItems.reduce((s, w) => s + w.total_amount, 0).toLocaleString()}
              </Typography>
              {allPaid ? (
                <Chip label="入金済み" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600 }} />
              ) : anyPending ? (
                <Chip label="支払い待ち" size="small" sx={{ bgcolor: '#FEF3C7', color: '#F59E0B', fontWeight: 600 }} />
              ) : null}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {/* 配送先（オークション単位）— 実際と同じ */}
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>配送先:</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{shippingAddress}</Typography>
              {shippingCalculated && (
                <Chip label="送料計算済み" size="small" sx={{ bgcolor: '#ECFDF5', color: '#059669', fontWeight: 600, ml: 'auto' }} />
              )}
            </Box>

            {/* アクションボタン — 実際と同じ */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={() => setSnackbar({ open: true, message: 'デモのため請求書のダウンロードはスキップされます', severity: 'success' })}>
                請求書ダウンロード
              </Button>
              {allPaid && (
                <Button variant="outlined" size="small" color="success" startIcon={<DownloadIcon />}
                  onClick={() => setSnackbar({ open: true, message: 'デモのため領収書のダウンロードはスキップされます', severity: 'success' })}>
                  領収書ダウンロード
                </Button>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* 落札商品リスト — 実際の WonItems.tsx と同一レイアウト */}
            {filteredItems.map((wonItem, idx) => (
              <Card key={wonItem.id} variant="outlined" data-tour-target={idx === 0 ? 'won-first-item' : undefined} sx={{ mb: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={2}>
                      <CardMedia
                        component="img"
                        image={wonItem.item.thumbnail_path || '/img/noimage.png'}
                        alt={wonItem.item.species_name}
                        sx={{ borderRadius: 1, aspectRatio: '3/2', objectFit: 'cover', width: '100%' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={10}>
                      {/* ヘッダー */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          No.{wonItem.item.item_number}
                        </Typography>
                        <Chip
                          label={getPaymentStatusLabel(wonItem.payment_status)}
                          size="small"
                          sx={{ ...getPaymentStatusColor(wonItem.payment_status), fontWeight: 600, fontSize: '0.7rem' }}
                        />
                        <Chip
                          label={getDeliveryStatusLabel(wonItem.delivery_status)}
                          size="small"
                          sx={{ bgcolor: '#DBEAFE', color: '#3B82F6', fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      </Box>

                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {wonItem.item.species_name}
                      </Typography>

                      {/* 金額情報 */}
                      <Box sx={{ display: 'flex', gap: 3, mb: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          ¥{wonItem.winning_price.toLocaleString()} × {wonItem.quantity}匹
                          = <strong>¥{wonItem.total_amount.toLocaleString()}</strong>
                        </Typography>
                        {wonItem.payment_deadline && wonItem.payment_status === 'pending' && (
                          <Typography variant="body2" sx={{ color: 'error.main' }}>
                            支払期限: {new Date(wonItem.payment_deadline).toLocaleDateString('ja-JP')}
                          </Typography>
                        )}
                      </Box>

                      {/* 配送情報 */}
                      {wonItem.tracking_number && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                          <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
                          <Typography variant="body2">{wonItem.shipping_company}:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {wonItem.tracking_number}
                          </Typography>
                          <Tooltip title="コピー">
                            <IconButton size="small" onClick={() => handleCopy(wonItem.tracking_number!)}>
                              <CopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                          {wonItem.shipping_company && (
                            <Button size="small" variant="text" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              onClick={() => { setSelectedItem(wonItem); setTrackingDetailOpen(true); }}
                              sx={{ fontSize: '0.75rem' }}>
                              追跡
                            </Button>
                          )}
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}

            {/* オークション合計 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, pt: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                商品小計: ¥{summary.total_amount.toLocaleString()}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#059669' }}>
                合計: ¥{summary.total_amount.toLocaleString()}
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 配送詳細ダイアログ — 実際と同じ */}
      <Dialog open={trackingDetailOpen} onClose={() => setTrackingDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送状況詳細</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedItem.item.species_name}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Stepper activeStep={getDeliveryStepIndex(selectedItem.delivery_status)} sx={{ mb: 3 }}>
                <Step><StepLabel>発送準備中</StepLabel></Step>
                <Step><StepLabel>配送中</StepLabel></Step>
                <Step><StepLabel>配達完了</StepLabel></Step>
              </Stepper>
              {selectedItem.tracking_number && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>伝票番号</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>{selectedItem.tracking_number}</Typography>
                    <IconButton size="small" onClick={() => handleCopy(selectedItem.tracking_number!)}>
                      <CopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {selectedItem.shipping_company}
                  </Typography>
                </Box>
              )}
              {selectedItem.tracking_number && selectedItem.shipping_company && (
                <Button fullWidth variant="contained" endIcon={<OpenInNewIcon />}
                  onClick={() => setSnackbar({ open: true, message: 'デモのため追跡ページは開きません', severity: 'success' })}>
                  {selectedItem.shipping_company}の配送状況ページを開く
                </Button>
              )}
            </>
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
// 設定ページ — 実際の Settings.tsx と同一デザイン
// ====================================================================

function StepAccountSettings({ controlledSubTab, onSubTabChange }: { controlledSubTab?: number; onSubTabChange?: (subTab: number) => void }) {
  const [internalTabValue, setInternalTabValue] = useState(0);
  const tabValue = controlledSubTab ?? internalTabValue;
  const setTabValue = (v: number) => setInternalTabValue(v);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [profile, setProfile] = useState({
    name: 'デモ ユーザー', email: 'demo@example.com', phone: '090-1234-5678',
    postal_code: '150-0001', prefecture: '東京都', city: '渋谷区',
    address_line1: '神宮前1-2-3', address_line2: 'メダカハイツ101',
  });
  const [notifications, setNotifications] = useState({
    email_won_item: true, email_payment_confirmed: true, email_shipping: true,
    email_new_auction: true, email_auction_start: true,
  });

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>アカウント設定</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>プロフィールと通知設定を管理します</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* 左側：プロフィールカード */}
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

        {/* 右側：タブ */}
        <Grid item xs={12} md={9}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => { setTabValue(v); onSubTabChange?.(v); }}>
                <Tab icon={<PersonIcon />} label="プロフィール" iconPosition="start" />
                <Tab icon={<NotificationsIcon />} label="通知設定" iconPosition="start"
                  data-tour-target="notification-sub-tab" />
              </Tabs>
            </Box>

            {/* プロフィールタブ */}
            {tabValue === 0 && (
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>基本情報</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth required label="お名前" value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="メールアドレス" value={profile.email}
                      disabled helperText="メールアドレスは変更できません" />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="電話番号" value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <SettingsIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>配送先住所（デフォルト）</Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  落札時の配送先として使用されます。落札ごとに変更することも可能です。
                </Alert>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <TextField fullWidth label="郵便番号" value={profile.postal_code} placeholder="123-4567"
                      onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField fullWidth label="都道府県" value={profile.prefecture}
                      onChange={(e) => setProfile({ ...profile, prefecture: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="市区町村" value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="住所1" value={profile.address_line1} placeholder="番地・丁目"
                      onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="住所2（建物名など）" value={profile.address_line2} placeholder="マンション名・部屋番号"
                      onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })} />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button variant="contained" size="large" startIcon={<SaveIcon />}
                    onClick={() => setSnackbar({ open: true, message: 'プロフィールを保存しました。' })}>
                    変更を保存
                  </Button>
                </Box>
              </CardContent>
            )}

            {/* 通知設定タブ — 実際の Settings.tsx と同一 */}
            {tabValue === 1 && (
              <CardContent data-tour-target="notification-section" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <NotificationsIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>メール通知設定</Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  受け取りたいメール通知を選択してください。重要なお知らせ（落札確定など）は設定に関わらず送信されます。
                </Alert>

                {/* 取引に関する通知 */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#059669' }}>
                    取引に関する通知
                  </Typography>

                  {[
                    { key: 'email_won_item', label: '落札通知', desc: '商品を落札した際にメールでお知らせします' },
                    { key: 'email_payment_confirmed', label: '入金確認通知', desc: '入金が確認された際にメールでお知らせします' },
                    { key: 'email_shipping', label: '発送通知', desc: '商品が発送された際にメールでお知らせします' },
                  ].map(item => (
                    <Box key={item.key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch checked={notifications[item.key as keyof typeof notifications]}
                              onChange={(e) => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                          }
                          label={item.label}
                        />
                        <Button size="small" variant="outlined" startIcon={<SendIcon />}
                          onClick={() => setSnackbar({ open: true, message: 'テストメールを送信しました。受信をご確認ください。' })}>
                          テスト送信
                        </Button>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                        {item.desc}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* オークションに関する通知 */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#3B82F6' }}>
                    オークションに関する通知
                  </Typography>

                  {[
                    { key: 'email_new_auction', label: '新規オークション通知', desc: '新しいオークションが開催される際にメールでお知らせします' },
                    { key: 'email_auction_start', label: 'オークション開始通知', desc: 'オークションが開始された際にメールでお知らせします' },
                  ].map(item => (
                    <Box key={item.key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch checked={notifications[item.key as keyof typeof notifications]}
                              onChange={(e) => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                          }
                          label={item.label}
                        />
                        <Button size="small" variant="outlined" startIcon={<SendIcon />}
                          onClick={() => setSnackbar({ open: true, message: 'テストメールを送信しました。受信をご確認ください。' })}>
                          テスト送信
                        </Button>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6, mb: 2 }}>
                        {item.desc}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                  <Button variant="contained" size="large" startIcon={<SaveIcon />}
                    onClick={() => setSnackbar({ open: true, message: '通知設定を保存しました。' })}>
                    通知設定を保存
                  </Button>
                </Box>
              </CardContent>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* LINE連携セクション — 実際と同じ位置（カード外） */}
      <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>LINE連携</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              LINEアカウントを連携すると、メール通知に加えてLINEでも通知を受け取れます。
            </Typography>
            <Button variant="outlined" color="success" disabled>
              LINEアカウントを連携する（デモ）
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={2000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
