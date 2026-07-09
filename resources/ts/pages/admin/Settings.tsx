import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid, Divider,
  Card, CardContent, InputAdornment, Alert, Tabs, Tab, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Switch, FormControlLabel, CircularProgress, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon, Settings as SettingsIcon, AttachMoney as MoneyIcon,
  LocalShipping as ShippingIcon, Receipt as ReceiptIcon, Gavel as GavelIcon,
  Edit as EditIcon, Link as LinkIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';
import { useSettings } from '../../features/settings/hooks/useSettings';
import { useNotificationStore } from '../../stores/notificationStore';
import TestModeCard from '../../features/settings/components/TestModeCard';

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>
);

interface PriceIncrementTier {
  from_price: number;
  to_price: number | null;
  increment_amount: number;
}

interface CountdownTier {
  from_price: number;
  to_price: number | null;
  bid_countdown_seconds: number;
  freeze_countdown_seconds: number;
}

interface SettingsState {
  // システム
  site_name: string; contact_email: string; contact_phone: string; business_hours: string;
  // オークション
  price_increment_rate: string; price_increment_min: string;
  default_lane_count: string;
  show_consent_screen: boolean; venue_open_minutes_before_start: string; item_switch_delay_seconds: string;
  // カウントダウン設定
  freeze_countdown_seconds: string; bid_countdown_seconds: string;
  auction_start_countdown_seconds: string;
  // 料金
  // premium_plan_fee: string; // TODO: プレミアム出品プランを再開する際にコメントを外す
  default_commission_rate: string;
  buyer_commission_rate: string;
  // 配送
  packaging_fee: string; handling_fee: string; insurance_fee_rate: string;
  cooling_fee_summer: string; heating_fee_winter: string;
  // 帳票
  company_name: string; company_address: string; company_phone: string; company_email: string;
  bank_name: string; bank_branch: string; bank_account_type: string; bank_account_number: string;
  bank_account_holder: string; invoice_prefix: string; payment_notice_prefix: string;
  warranty_validity_days: string; auto_generate_invoice: boolean; auto_generate_payment_notice: boolean;
  // 外部連携（E-NE）
  ene_webhook_enabled: boolean; ene_email_field_name: string;
  ene_default_member_type: string; ene_duplicate_behavior: string;
}

const DEFAULT_PRICE_INCREMENT_TIERS: PriceIncrementTier[] = [
  { from_price: 0, to_price: 999, increment_amount: 50 },
  { from_price: 1000, to_price: 4999, increment_amount: 100 },
  { from_price: 5000, to_price: 9999, increment_amount: 500 },
  { from_price: 10000, to_price: 49999, increment_amount: 1000 },
  { from_price: 50000, to_price: null, increment_amount: 5000 },
];

const DEFAULT_COUNTDOWN_TIERS: CountdownTier[] = [
  { from_price: 0, to_price: 999, bid_countdown_seconds: 5, freeze_countdown_seconds: 1 },
  { from_price: 1000, to_price: 4999, bid_countdown_seconds: 5, freeze_countdown_seconds: 1 },
  { from_price: 5000, to_price: 9999, bid_countdown_seconds: 5, freeze_countdown_seconds: 1 },
  { from_price: 10000, to_price: 49999, bid_countdown_seconds: 5, freeze_countdown_seconds: 1 },
  { from_price: 50000, to_price: null, bid_countdown_seconds: 5, freeze_countdown_seconds: 1 },
];

const DEFAULT_SETTINGS: SettingsState = {
  site_name: '', contact_email: '', contact_phone: '', business_hours: '',
  price_increment_rate: '10', price_increment_min: '50',
  default_lane_count: '6',
  show_consent_screen: false, venue_open_minutes_before_start: '30', item_switch_delay_seconds: '5',
  freeze_countdown_seconds: '1', bid_countdown_seconds: '5',
  auction_start_countdown_seconds: '10',
  default_commission_rate: '10',
  buyer_commission_rate: '10',
  packaging_fee: '500', handling_fee: '300', insurance_fee_rate: '3',
  cooling_fee_summer: '300', heating_fee_winter: '300',
  company_name: '', company_address: '', company_phone: '', company_email: '',
  bank_name: '', bank_branch: '', bank_account_type: '', bank_account_number: '', bank_account_holder: '',
  invoice_prefix: '', payment_notice_prefix: '', warranty_validity_days: '14',
  auto_generate_invoice: false, auto_generate_payment_notice: false,
  ene_webhook_enabled: false, ene_email_field_name: 'email',
  ene_default_member_type: 'buyer', ene_duplicate_behavior: 'skip',
};

export default function AdminSettings() {
  const [tabValue, setTabValue] = useState(0);
  const [s, setS]               = useState<SettingsState>(DEFAULT_SETTINGS);
  const [shippingRates, setShippingRates]             = useState<any[]>([]);
  const [editShippingDialog, setEditShippingDialog]   = useState(false);
  const [shippingMaster, setShippingMaster]           = useState<Record<string, Record<number, number>>>({});
  const [editingRates, setEditingRates]               = useState<Record<string, Record<number, number>>>({});
  const [packingMaterials, setPackingMaterials]        = useState<any[]>([]);
  const [shippingMasterLoading, setShippingMasterLoading] = useState(false);
  const [savingRates, setSavingRates]                 = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as const });
  const [incrementTiers, setIncrementTiers]           = useState<PriceIncrementTier[]>(DEFAULT_PRICE_INCREMENT_TIERS);
  const [countdownTiers, setCountdownTiers]           = useState<CountdownTier[]>(DEFAULT_COUNTDOWN_TIERS);

  const { rawSettings, isLoading, isSaving, save } = useSettings();

  // rawSettings が取得できたらフォームに反映
  useEffect(() => {
    if (!rawSettings) return;
    const d = rawSettings;
    setS({
      site_name:                      d.site?.site_name?.value ?? '',
      contact_email:                  d.site?.contact_email?.value ?? '',
      contact_phone:                  d.site?.contact_phone?.value ?? '',
      business_hours:                 d.site?.business_hours?.value ?? '',
      price_increment_rate:           String(d.auction?.price_increment_rate?.value ?? '10'),
      price_increment_min:            String(d.auction?.price_increment_min?.value ?? '50'),
      default_lane_count:             String(d.auction?.default_lane_count?.value ?? '6'),
      show_consent_screen:            d.auction?.show_consent_screen?.value ?? false,
      venue_open_minutes_before_start:String(d.auction?.venue_open_minutes_before_start?.value ?? '30'),
      item_switch_delay_seconds:      String(d.auction?.item_switch_delay_seconds?.value ?? '5'),
      freeze_countdown_seconds:       String(d.auction?.freeze_countdown_seconds?.value ?? '1'),
      bid_countdown_seconds:          String(d.auction?.bid_countdown_seconds?.value ?? '5'),
      auction_start_countdown_seconds:String(d.auction?.auction_start_countdown_seconds?.value ?? '10'),
      // premium_plan_fee:            String(d.premium?.premium_plan_fee?.value ?? '300'), // TODO: プレミアム出品プラン再開時にコメントを外す
      default_commission_rate:        String(d.payment?.default_commission_rate?.value ?? '10'),
      buyer_commission_rate:          String(d.payment?.buyer_commission_rate?.value ?? '10'),
      packaging_fee:                  String(d.shipping?.packaging_fee?.value ?? '500'),
      handling_fee:                   String(d.shipping?.handling_fee?.value ?? '300'),
      insurance_fee_rate:             String(d.shipping?.insurance_fee_rate?.value ?? '3'),
      cooling_fee_summer:             String(d.shipping?.cooling_fee_summer?.value ?? '300'),
      heating_fee_winter:             String(d.shipping?.heating_fee_winter?.value ?? '300'),
      company_name:                   d.document?.company_name?.value ?? '',
      company_address:                d.document?.company_address?.value ?? '',
      company_phone:                  d.document?.company_phone?.value ?? '',
      company_email:                  d.document?.company_email?.value ?? '',
      bank_name:                      d.document?.bank_name?.value ?? '',
      bank_branch:                    d.document?.bank_branch?.value ?? '',
      bank_account_type:              d.document?.bank_account_type?.value ?? '',
      bank_account_number:            d.document?.bank_account_number?.value ?? '',
      bank_account_holder:            d.document?.bank_account_holder?.value ?? '',
      invoice_prefix:                 d.document?.invoice_prefix?.value ?? '',
      payment_notice_prefix:          d.document?.payment_notice_prefix?.value ?? '',
      warranty_validity_days:         String(d.document?.warranty_validity_days?.value ?? '14'),
      auto_generate_invoice:          d.document?.auto_generate_invoice?.value ?? false,
      auto_generate_payment_notice:   d.document?.auto_generate_payment_notice?.value ?? false,
      ene_webhook_enabled:            d.external_integration?.ene_webhook_enabled?.value ?? false,
      ene_email_field_name:           d.external_integration?.ene_email_field_name?.value ?? 'email',
      ene_default_member_type:        String(d.external_integration?.ene_default_member_type?.value ?? 'buyer'),
      ene_duplicate_behavior:         String(d.external_integration?.ene_duplicate_behavior?.value ?? 'skip'),
    });
    if (d.shipping?.shipping_rates?.value) setShippingRates(d.shipping.shipping_rates.value);
    if (d.auction?.default_price_increment_tiers?.value) setIncrementTiers(d.auction.default_price_increment_tiers.value);
    if (d.auction?.default_countdown_tiers?.value) setCountdownTiers(d.auction.default_countdown_tiers.value);
  }, [rawSettings]);

  const handleSubmit = () => {
    save({
      ...s,
      show_consent_screen:          s.show_consent_screen,
      auto_generate_invoice:        s.auto_generate_invoice,
      auto_generate_payment_notice: s.auto_generate_payment_notice,
      default_price_increment_tiers: incrementTiers,
      default_countdown_tiers: countdownTiers,
    });
  };

  const fetchShippingMaster = async () => {
    setShippingMasterLoading(true);
    try {
      const res = await axios.get('/api/admin/shipping-master');
      if (res.data.success) {
        setShippingMaster(res.data.data.shipping_rates);
        setPackingMaterials(res.data.data.packing_materials);
      }
    } catch { /* silent */ }
    setShippingMasterLoading(false);
  };

  const handleOpenEditShipping = () => {
    setEditingRates(JSON.parse(JSON.stringify(shippingMaster)));
    fetchShippingMaster().then(() => setEditShippingDialog(true));
  };

  const handleSaveShippingRates = async () => {
    setSavingRates(true);
    try {
      const rates: { region: string; box_size: number; rate: number }[] = [];
      for (const [region, sizes] of Object.entries(editingRates)) {
        for (const [size, rate] of Object.entries(sizes)) {
          rates.push({ region, box_size: Number(size), rate: Number(rate) });
        }
      }
      await axios.put('/api/admin/shipping-master/rates', { rates });
      setSnackbar({ open: true, message: '配送料金を更新しました', severity: 'success' });
      setEditShippingDialog(false);
      fetchShippingMaster();
    } catch {
      setSnackbar({ open: true, message: '更新に失敗しました', severity: 'error' as any });
    }
    setSavingRates(false);
  };

  useEffect(() => { fetchShippingMaster(); }, []);

  const str = (k: keyof SettingsState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS((p) => ({ ...p, [k]: e.target.value }));
  const bool = (k: keyof SettingsState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS((p) => ({ ...p, [k]: e.target.checked }));

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>システム設定</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>オークションシステムの各種設定を管理します</Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSubmit} disabled={isSaving}>すべて保存</Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<SettingsIcon />} iconPosition="start" label="システム" />
          <Tab icon={<GavelIcon />}    iconPosition="start" label="オークション" />
          <Tab icon={<MoneyIcon />}    iconPosition="start" label="料金設定" />
          <Tab icon={<ShippingIcon />} iconPosition="start" label="配送・梱包" />
          <Tab icon={<ReceiptIcon />}  iconPosition="start" label="帳票" />
          <Tab icon={<LinkIcon />}     iconPosition="start" label="外部連携" />
        </Tabs>
      </Paper>

      {/* システム設定 */}
      <TabPanel value={tabValue} index={0}>
        <TestModeCard />

        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>基本情報</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="サイト名" value={s.site_name} onChange={str('site_name')} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="連絡先メールアドレス" type="email" value={s.contact_email} onChange={str('contact_email')} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="連絡先電話番号" value={s.contact_phone} onChange={str('contact_phone')} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="営業時間" value={s.business_hours} onChange={str('business_hours')} /></Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* オークション設定 */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>入札ルール（システムデフォルト）</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>この設定はシステム全体のデフォルト値です。オークション作成時に個別にカスタマイズできます。</Alert>
            <Grid container spacing={3}>
              {[
                { label: '価格上昇率（フォールバック）', k: 'price_increment_rate' as const, unit: '%', helper: '金額帯テーブル未設定時のフォールバック' },
                { label: '最低上昇金額（フォールバック）', k: 'price_increment_min' as const, unit: '¥', prefix: true, helper: '金額帯テーブル未設定時のフォールバック' },
                { label: 'デフォルトレーン数', k: 'default_lane_count' as const, helper: '同時進行できるレーン数' },
              ].map(({ label, k, unit, prefix, step, helper }) => (
                <Grid item xs={12} sm={6} md={4} key={k}>
                  <TextField fullWidth type="number" label={label} value={s[k]} onChange={str(k)} helperText={helper}
                    InputProps={prefix ? { startAdornment: <InputAdornment position="start">¥</InputAdornment> }
                      : unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : {}}
                    inputProps={step ? { step } : {}} />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>金額帯別上昇幅テーブル</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>現在の価格に応じて上昇金額が変わります。オークションごとにカスタム設定も可能です。</Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>下限金額</TableCell>
                    <TableCell>上限金額</TableCell>
                    <TableCell>上昇金額</TableCell>
                    <TableCell width={80} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incrementTiers.map((tier, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.from_price}
                          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                          onChange={(e) => {
                            const next = [...incrementTiers];
                            next[idx] = { ...next[idx], from_price: parseInt(e.target.value) || 0 };
                            setIncrementTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.to_price ?? ''}
                          placeholder="上限なし"
                          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                          onChange={(e) => {
                            const next = [...incrementTiers];
                            const val = e.target.value === '' ? null : parseInt(e.target.value);
                            next[idx] = { ...next[idx], to_price: val };
                            setIncrementTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.increment_amount}
                          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                          onChange={(e) => {
                            const next = [...incrementTiers];
                            next[idx] = { ...next[idx], increment_amount: parseInt(e.target.value) || 0 };
                            setIncrementTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => {
                          setIncrementTiers(incrementTiers.filter((_, i) => i !== idx));
                        }}>×</IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button size="small" sx={{ mt: 1 }} onClick={() => {
              const last = incrementTiers[incrementTiers.length - 1];
              setIncrementTiers([...incrementTiers, {
                from_price: last ? (last.to_price ?? last.from_price) + 1 : 0,
                to_price: null,
                increment_amount: last?.increment_amount ?? 100,
              }]);
            }}>+ 行を追加</Button>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>カウントダウン設定</Typography>
            <Grid container spacing={3}>
              {[
                { label: 'オークション開始待機時間', k: 'auction_start_countdown_seconds' as const, unit: '秒', step: 1, helper: '開始前のカウントダウン（0〜3600秒）' },
                { label: 'フリーズ（誤タップ防止）カウント', k: 'freeze_countdown_seconds' as const, unit: '秒', step: 0.1, helper: '入札直後の誤タップ防止（0.1〜10秒）' },
                { label: '落札カウント', k: 'bid_countdown_seconds' as const, unit: '秒', step: 0.5, helper: '入札受付カウントダウン（0.5〜10秒）' },
                { label: '商品開始毎カウント', k: 'item_switch_delay_seconds' as const, unit: '秒', step: 0.5, helper: '次の商品表示後の待機（0.5〜10秒）' },
              ].map(({ label, k, unit, step, helper }) => (
                <Grid item xs={12} sm={6} md={4} key={k}>
                  <TextField fullWidth type="number" label={label} value={s[k]} onChange={str(k)} helperText={helper}
                    InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                    inputProps={{ step, min: 0 }} />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>金額帯別カウントダウン秒数テーブル</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>現在の価格に応じてカウントダウン秒数が変わります。空の場合は上記の単一値設定が使用されます。</Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>下限金額</TableCell>
                    <TableCell>上限金額</TableCell>
                    <TableCell>落札カウント（秒）</TableCell>
                    <TableCell>フリーズ（秒）</TableCell>
                    <TableCell width={80} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {countdownTiers.map((tier, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.from_price}
                          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                          onChange={(e) => {
                            const next = [...countdownTiers];
                            next[idx] = { ...next[idx], from_price: parseInt(e.target.value) || 0 };
                            setCountdownTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.to_price ?? ''} placeholder="上限なし"
                          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                          onChange={(e) => {
                            const next = [...countdownTiers];
                            const val = e.target.value === '' ? null : parseInt(e.target.value);
                            next[idx] = { ...next[idx], to_price: val };
                            setCountdownTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.bid_countdown_seconds}
                          InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                          inputProps={{ step: 0.5, min: 0.5 }}
                          onChange={(e) => {
                            const next = [...countdownTiers];
                            next[idx] = { ...next[idx], bid_countdown_seconds: parseFloat(e.target.value) || 5 };
                            setCountdownTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={tier.freeze_countdown_seconds}
                          InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                          inputProps={{ step: 0.1, min: 0.1 }}
                          onChange={(e) => {
                            const next = [...countdownTiers];
                            next[idx] = { ...next[idx], freeze_countdown_seconds: parseFloat(e.target.value) || 1 };
                            setCountdownTiers(next);
                          }} />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => {
                          setCountdownTiers(countdownTiers.filter((_, i) => i !== idx));
                        }}>×</IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button size="small" sx={{ mt: 1 }} onClick={() => {
              const last = countdownTiers[countdownTiers.length - 1];
              setCountdownTiers([...countdownTiers, {
                from_price: last ? (last.to_price ?? last.from_price) + 1 : 0,
                to_price: null,
                bid_countdown_seconds: last?.bid_countdown_seconds ?? 5,
                freeze_countdown_seconds: last?.freeze_countdown_seconds ?? 1,
              }]);
            }}>+ 行を追加</Button>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>会場・レーン設定</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="会場入室可能開始" value={s.venue_open_minutes_before_start} onChange={str('venue_open_minutes_before_start')}
                  InputProps={{ endAdornment: <InputAdornment position="end">分前</InputAdornment> }}
                  helperText="オークション開始の何分前から入室可能か" />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>同意画面設定</Typography>
            <FormControlLabel control={<Switch checked={s.show_consent_screen} onChange={bool('show_consent_screen')} />}
              label="オークション開始時に同意画面を表示する" />
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">オンにすると「画像は同じ品種のイメージ画像です。実際の映像は詳細ボタンよりご確認ください。」という同意画面が表示されます。</Typography>
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      {/* 料金設定 */}
      <TabPanel value={tabValue} index={2}>
        <Alert severity="info" sx={{ mb: 3 }}>この設定はシステム全体のデフォルト値です。</Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#059669' }}>出品者向け料金</Typography>
                <Grid container spacing={3}>
                  {/* TODO: プレミアム出品プランを再開する際にコメントを外す
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth type="number" label="プレミアム出品料" value={s.premium_plan_fee} onChange={str('premium_plan_fee')}
                      helperText="個別撮影付きの出品料"
                      InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }} />
                  </Grid>
                  */}
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth type="number" label="販売手数料率" value={s.default_commission_rate} onChange={str('default_commission_rate')}
                      helperText="落札金額に対する手数料"
                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#3B82F6' }}>買受者向け料金</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth type="number" label="落札手数料率" value={s.buyer_commission_rate} onChange={str('buyer_commission_rate')}
                      helperText="落札金額に対する手数料"
                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 配送・梱包設定 */}
      <TabPanel value={tabValue} index={3}>
        <Alert severity="info" sx={{ mb: 3 }}>この設定はシステム全体のデフォルト値です。</Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>梱包・手数料</Typography>
                <Grid container spacing={3}>
                  {[
                    { label: '梱包料金', k: 'packaging_fee' as const, helper: '1件あたりの梱包費' },
                    { label: '取扱手数料', k: 'handling_fee' as const, helper: '発送事務手数料' },
                    { label: '保険料率', k: 'insurance_fee_rate' as const, unit: '%', helper: '落札金額に対する保険料' },
                    { label: '夏季クール便料金', k: 'cooling_fee_summer' as const, helper: '6-9月の追加料金' },
                    { label: '冬季保温料金', k: 'heating_fee_winter' as const, helper: '12-2月の追加料金' },
                  ].map(({ label, k, unit, helper }) => (
                    <Grid item xs={12} sm={6} key={k}>
                      <TextField fullWidth type="number" label={label} value={s[k]} onChange={str(k)} helperText={helper}
                        InputProps={unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }
                          : { startAdornment: <InputAdornment position="start">¥</InputAdornment> }} />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>ヤマト法人送料（地域×箱サイズ）</Typography>
                  <Button size="small" startIcon={<EditIcon />} onClick={handleOpenEditShipping}>編集</Button>
                </Box>
                {shippingMasterLoading ? <CircularProgress size={24} /> : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>地域</TableCell>
                          <TableCell align="right">80</TableCell>
                          <TableCell align="right">100</TableCell>
                          <TableCell align="right">120</TableCell>
                          <TableCell align="right">140</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(shippingMaster).map(([region, sizes]) => (
                          <TableRow key={region}>
                            <TableCell>{region}</TableCell>
                            {[80, 100, 120, 140].map((sz) => (
                              <TableCell key={sz} align="right">¥{formatYen(sizes[sz] ?? 0)}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                {packingMaterials.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>梱包資材費</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>箱サイズ</TableCell>
                          <TableCell align="right">発泡スチロール</TableCell>
                          <TableCell align="right">袋資材</TableCell>
                          <TableCell align="right">保冷剤</TableCell>
                          <TableCell align="right">合計</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {packingMaterials.map((m: any) => (
                          <TableRow key={m.box_size}>
                            <TableCell>{m.box_size}サイズ</TableCell>
                            <TableCell align="right">¥{formatYen(m.styrofoam_cost)}</TableCell>
                            <TableCell align="right">¥{formatYen(m.bag_material_cost)}</TableCell>
                            <TableCell align="right">¥{formatYen(m.coolant_cost)}</TableCell>
                            <TableCell align="right">¥{formatYen(m.total_cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 帳票設定 */}
      <TabPanel value={tabValue} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>会社情報（帳票に表示）</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}><TextField fullWidth label="会社名・屋号" value={s.company_name} onChange={str('company_name')} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="住所" value={s.company_address} onChange={str('company_address')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="電話番号" value={s.company_phone} onChange={str('company_phone')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="メールアドレス" value={s.company_email} onChange={str('company_email')} /></Grid>
                </Grid>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>振込先口座</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="銀行名" value={s.bank_name} onChange={str('bank_name')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="支店名" value={s.bank_branch} onChange={str('bank_branch')} /></Grid>
                  <Grid item xs={12} sm={4}><TextField fullWidth label="口座種別" value={s.bank_account_type} onChange={str('bank_account_type')} /></Grid>
                  <Grid item xs={12} sm={4}><TextField fullWidth label="口座番号" value={s.bank_account_number} onChange={str('bank_account_number')} /></Grid>
                  <Grid item xs={12} sm={4}><TextField fullWidth label="口座名義" value={s.bank_account_holder} onChange={str('bank_account_holder')} /></Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>帳票番号設定</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="請求書プレフィックス" value={s.invoice_prefix} onChange={str('invoice_prefix')} helperText="例: INV-2025-0001" /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="支払通知書プレフィックス" value={s.payment_notice_prefix} onChange={str('payment_notice_prefix')} helperText="例: PAY-2025-0001" /></Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth type="number" label="保証書有効日数" value={s.warranty_validity_days} onChange={str('warranty_validity_days')}
                      InputProps={{ endAdornment: <InputAdornment position="end">日</InputAdornment> }} helperText="到着後の保証期間" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>自動発行設定</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel control={<Switch checked={s.auto_generate_invoice} onChange={bool('auto_generate_invoice')} />} label="請求書を自動発行する" />
                  <FormControlLabel control={<Switch checked={s.auto_generate_payment_notice} onChange={bool('auto_generate_payment_notice')} />} label="支払通知書を自動発行する" />
                </Box>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">自動発行を有効にすると、落札確定時に請求書、入金確認時に支払通知書が自動で生成されます。</Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 外部連携（E-NE） */}
      <TabPanel value={tabValue} index={5}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>E-NE 連携（契約締結で会員自動作成）</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              E-NE の契約締結Webhookを受けて<strong>承認済み会員</strong>を自動作成します。共有シークレット（whsec_…）はサーバーの <code>.env</code>（ENE_WEBHOOK_SECRET）で管理し、この画面には表示しません。
            </Alert>
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={<Switch checked={s.ene_webhook_enabled} onChange={bool('ene_webhook_enabled')} />}
                label="E-NE連携を有効にする" />
              <Typography variant="body2" color="text.secondary">
                OFFの間はWebhookを受信しても会員作成をスキップします（疎通確認用）。
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="メールアドレスのフィールド名"
                  value={s.ene_email_field_name} onChange={str('ene_email_field_name')}
                  helperText="E-NEのCRMでメールを持つ項目のシステム名（crm_fields[].name）" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth label="既定の会員種別"
                  value={s.ene_default_member_type} onChange={str('ene_default_member_type')}
                  helperText="ペイロードに種別があればそちらを優先">
                  <MenuItem value="buyer">買受者（participant）</MenuItem>
                  <MenuItem value="seller">買受者＆出品者（participant + seller）</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth label="メール重複時の挙動"
                  value={s.ene_duplicate_behavior} onChange={str('ene_duplicate_behavior')}>
                  <MenuItem value="skip">スキップ（何もしない）</MenuItem>
                  <MenuItem value="promote">既存を承認済みに昇格</MenuItem>
                  <MenuItem value="error">失敗として記録</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* スナックバー */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>

      {/* 配送料金編集ダイアログ */}
      <Dialog open={editShippingDialog} onClose={() => setEditShippingDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>ヤマト法人送料の編集</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>変更は全注文に即座に反映されます。慎重に入力してください。</Alert>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>地域</TableCell>
                  {[80, 100, 120, 140].map((sz) => (
                    <TableCell key={sz} align="center">{sz}サイズ</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(editingRates).map(([region, sizes]) => (
                  <TableRow key={region}>
                    <TableCell sx={{ fontWeight: 600 }}>{region}</TableCell>
                    {[80, 100, 120, 140].map((sz) => (
                      <TableCell key={sz}>
                        <TextField
                          size="small"
                          type="number"
                          value={sizes[sz] ?? 0}
                          onChange={(e) => {
                            setEditingRates((prev) => ({
                              ...prev,
                              [region]: { ...prev[region], [sz]: Number(e.target.value) },
                            }));
                          }}
                          InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                          sx={{ width: 130 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditShippingDialog(false)} disabled={savingRates}>キャンセル</Button>
          <Button variant="contained" onClick={handleSaveShippingRates} disabled={savingRates}>
            {savingRates ? <CircularProgress size={20} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
