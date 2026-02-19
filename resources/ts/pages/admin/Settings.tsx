import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Grid, Divider,
  Card, CardContent, InputAdornment, Alert, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Switch, FormControlLabel, CircularProgress, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon, Settings as SettingsIcon, AttachMoney as MoneyIcon,
  LocalShipping as ShippingIcon, Receipt as ReceiptIcon, Gavel as GavelIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useSettings } from '../../features/settings/hooks/useSettings';
import { useNotificationStore } from '../../stores/notificationStore';

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>
);

interface SettingsState {
  // システム
  site_name: string; contact_email: string; contact_phone: string; business_hours: string;
  // オークション
  price_increment_rate: string; price_increment_min: string; countdown_seconds: string;
  countdown_seconds_default: string; countdown_seconds_competitive: string;
  default_lane_count: string; auto_extend_seconds: string; default_bid_increment: string;
  show_consent_screen: boolean; venue_open_minutes_before_start: string; item_switch_delay_seconds: string;
  // 料金
  seller_registration_fee: string; seller_annual_fee: string; base_listing_fee: string;
  premium_plan_fee: string; default_commission_rate: string; seller_commission_min: string;
  buyer_registration_fee: string; buyer_commission_rate: string; buyer_commission_min: string;
  // 配送
  packaging_fee: string; handling_fee: string; insurance_fee_rate: string;
  cooling_fee_summer: string; heating_fee_winter: string;
  // 帳票
  company_name: string; company_address: string; company_phone: string; company_email: string;
  bank_name: string; bank_branch: string; bank_account_type: string; bank_account_number: string;
  bank_account_holder: string; invoice_prefix: string; payment_notice_prefix: string;
  warranty_validity_days: string; auto_generate_invoice: boolean; auto_generate_payment_notice: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  site_name: '', contact_email: '', contact_phone: '', business_hours: '',
  price_increment_rate: '10', price_increment_min: '50', countdown_seconds: '3',
  countdown_seconds_default: '10', countdown_seconds_competitive: '1',
  default_lane_count: '6', auto_extend_seconds: '10', default_bid_increment: '100',
  show_consent_screen: false, venue_open_minutes_before_start: '30', item_switch_delay_seconds: '5',
  seller_registration_fee: '3000', seller_annual_fee: '0', base_listing_fee: '500',
  premium_plan_fee: '300', default_commission_rate: '10', seller_commission_min: '500',
  buyer_registration_fee: '0', buyer_commission_rate: '5', buyer_commission_min: '300',
  packaging_fee: '500', handling_fee: '300', insurance_fee_rate: '3',
  cooling_fee_summer: '300', heating_fee_winter: '300',
  company_name: '', company_address: '', company_phone: '', company_email: '',
  bank_name: '', bank_branch: '', bank_account_type: '', bank_account_number: '', bank_account_holder: '',
  invoice_prefix: '', payment_notice_prefix: '', warranty_validity_days: '14',
  auto_generate_invoice: false, auto_generate_payment_notice: false,
};

export default function AdminSettings() {
  const [tabValue, setTabValue] = useState(0);
  const [s, setS]               = useState<SettingsState>(DEFAULT_SETTINGS);
  const [shippingRates, setShippingRates]             = useState<any[]>([]);
  const [editShippingDialog, setEditShippingDialog]   = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as const });

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
      countdown_seconds:              String(d.auction?.countdown_seconds?.value ?? '3'),
      countdown_seconds_default:      String(d.auction?.countdown_seconds_default?.value ?? '10'),
      countdown_seconds_competitive:  String(d.auction?.countdown_seconds_competitive?.value ?? '1'),
      default_lane_count:             String(d.auction?.default_lane_count?.value ?? '6'),
      auto_extend_seconds:            String(d.auction?.auto_extend_seconds?.value ?? '10'),
      default_bid_increment:          String(d.auction?.default_bid_increment?.value ?? '100'),
      show_consent_screen:            d.auction?.show_consent_screen?.value ?? false,
      venue_open_minutes_before_start:String(d.auction?.venue_open_minutes_before_start?.value ?? '30'),
      item_switch_delay_seconds:      String(d.auction?.item_switch_delay_seconds?.value ?? '5'),
      seller_registration_fee:        String(d.payment?.seller_registration_fee?.value ?? '3000'),
      seller_annual_fee:              String(d.payment?.seller_annual_fee?.value ?? '0'),
      base_listing_fee:               String(d.payment?.base_listing_fee?.value ?? '500'),
      premium_plan_fee:               String(d.premium?.premium_plan_fee?.value ?? '300'),
      default_commission_rate:        String(d.payment?.default_commission_rate?.value ?? '10'),
      seller_commission_min:          String(d.payment?.seller_commission_min?.value ?? '500'),
      buyer_registration_fee:         String(d.payment?.buyer_registration_fee?.value ?? '0'),
      buyer_commission_rate:          String(d.payment?.buyer_commission_rate?.value ?? '5'),
      buyer_commission_min:           String(d.payment?.buyer_commission_min?.value ?? '300'),
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
    });
    if (d.shipping?.shipping_rates?.value) setShippingRates(d.shipping.shipping_rates.value);
  }, [rawSettings]);

  const handleSubmit = () => {
    save({
      ...s,
      show_consent_screen:          s.show_consent_screen,
      auto_generate_invoice:        s.auto_generate_invoice,
      auto_generate_payment_notice: s.auto_generate_payment_notice,
    });
  };

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
        </Tabs>
      </Paper>

      {/* システム設定 */}
      <TabPanel value={tabValue} index={0}>
        <Card>
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
                { label: '価格上昇率', k: 'price_increment_rate' as const, unit: '%', helper: '複数人入札時の価格上昇率' },
                { label: '最低上昇金額', k: 'price_increment_min' as const, unit: '¥', prefix: true, helper: '最低でもこの金額は上昇' },
                { label: 'カウントダウン秒数（通常）', k: 'countdown_seconds_default' as const, unit: '秒', step: 0.5, helper: '開始時・入札者0〜1人（0.5秒単位）' },
                { label: 'カウントダウン秒数（競合時）', k: 'countdown_seconds_competitive' as const, unit: '秒', step: 0.5, helper: '入札者2人以上（0.5秒単位）' },
                { label: 'デフォルトレーン数', k: 'default_lane_count' as const, helper: '同時進行できるレーン数' },
                { label: '自動延長秒数', k: 'auto_extend_seconds' as const, unit: '秒', helper: '終了直前の入札で延長' },
                { label: 'デフォルト入札単位', k: 'default_bid_increment' as const, unit: '¥', prefix: true, helper: '価格上昇の単位' },
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
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>会場・レーン設定</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="会場入室可能開始" value={s.venue_open_minutes_before_start} onChange={str('venue_open_minutes_before_start')}
                  InputProps={{ endAdornment: <InputAdornment position="end">分前</InputAdornment> }}
                  helperText="オークション開始の何分前から入室可能か" />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="生体切り替え後の入札開始待機" value={s.item_switch_delay_seconds} onChange={str('item_switch_delay_seconds')}
                  InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                  inputProps={{ step: 0.5, min: 0 }} helperText="次の生体表示後の待機秒数（0で待機なし、0.5秒単位）" />
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
                  {[
                    { label: '登録料（初回）', k: 'seller_registration_fee' as const, helper: '出品者登録時の初期費用' },
                    { label: '年会費', k: 'seller_annual_fee' as const, helper: '年間維持費（0で無料）' },
                    { label: '基本出品料', k: 'base_listing_fee' as const, helper: '1点あたりの出品料' },
                    { label: 'プレミアム出品料', k: 'premium_plan_fee' as const, helper: '個別撮影付きの出品料' },
                    { label: '販売手数料率', k: 'default_commission_rate' as const, unit: '%', helper: '落札金額に対する手数料' },
                    { label: '最低手数料', k: 'seller_commission_min' as const, helper: '1点あたりの最低手数料' },
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
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#3B82F6' }}>買受者向け料金</Typography>
                <Grid container spacing={3}>
                  {[
                    { label: '登録料', k: 'buyer_registration_fee' as const, helper: '買受者登録時の費用（0で無料）' },
                    { label: '落札手数料率', k: 'buyer_commission_rate' as const, unit: '%', helper: '落札金額に対する手数料' },
                    { label: '最低手数料', k: 'buyer_commission_min' as const, helper: '1点あたりの最低手数料' },
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
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>地域別配送料金</Typography>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => setEditShippingDialog(true)}>編集</Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>地域</TableCell>
                        <TableCell align="right">60サイズ</TableCell>
                        <TableCell align="right">80サイズ</TableCell>
                        <TableCell align="right">100サイズ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shippingRates.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.region}</TableCell>
                          <TableCell align="right">¥{r.size_60?.toLocaleString()}</TableCell>
                          <TableCell align="right">¥{r.size_80?.toLocaleString()}</TableCell>
                          <TableCell align="right">¥{r.size_100?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
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

      {/* スナックバー */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>

      {/* 配送料金編集ダイアログ */}
      <Dialog open={editShippingDialog} onClose={() => setEditShippingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>地域別配送料金の編集</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>配送料金テーブルは現在のバージョンでは編集できません。今後のアップデートで対応予定です。</Alert>
        </DialogContent>
        <DialogActions><Button onClick={() => setEditShippingDialog(false)}>閉じる</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
