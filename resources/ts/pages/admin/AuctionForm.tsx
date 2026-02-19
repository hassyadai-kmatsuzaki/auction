import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Grid,
  FormControl, FormControlLabel, Checkbox, CircularProgress,
  Alert, Stack, Divider, InputAdornment, Tabs, Tab,
  Card, CardContent, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem,
} from '@mui/material';
import {
  Save as SaveIcon, ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon, Gavel as GavelIcon,
  AttachMoney as MoneyIcon, LocalShipping as ShippingIcon,
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker, TimePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { useAuctionForm } from '../../features/auction-form/hooks/useAuctionForm';

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>
);

export default function AuctionForm() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const auctionId = id ? Number(id) : undefined;
  const isEdit    = Boolean(id);

  const [tabValue, setTabValue] = useState(0);
  const [error, setError]       = useState<string | null>(null);

  const { formData, setFormData, canEdit, fetchLoading, isSaving, save } = useAuctionForm(auctionId);

  // デフォルト設定
  const { data: defaults } = useQuery({
    queryKey: ['admin-settings-defaults'],
    queryFn: async () => { const r = await axios.get('/api/admin/settings/defaults'); return r.data.data; },
    staleTime: 5 * 60_000,
  });

  const validate = (): string | null => {
    if (!formData.title.trim()) return 'オークション名を入力してください。';
    if (!formData.event_date)   return '開催日を選択してください。';
    if (!formData.start_time)   return '開始時刻を選択してください。';
    if (formData.default_bid_increment < 1) return 'デフォルト入札単位は1円以上を指定してください。';
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    save();
    navigate('/admin/auctions');
  };

  const setAuction = (patch: Partial<typeof formData>) =>
    setFormData((p) => ({ ...p, ...patch }));
  const setCustomAuction = (patch: Partial<typeof formData.custom_auction_settings>) =>
    setFormData((p) => ({ ...p, custom_auction_settings: { ...p.custom_auction_settings, ...patch } }));
  const setCustomFee = (patch: Partial<typeof formData.custom_fee_settings>) =>
    setFormData((p) => ({ ...p, custom_fee_settings: { ...p.custom_fee_settings, ...patch } }));
  const setCustomShipping = (patch: Partial<typeof formData.custom_shipping_settings>) =>
    setFormData((p) => ({ ...p, custom_shipping_settings: { ...p.custom_shipping_settings, ...patch } }));

  if (fetchLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  );

  if (!canEdit && isEdit) return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/auctions')} sx={{ mr: 2 }}>戻る</Button>
        <Typography variant="h4">オークション詳細</Typography>
      </Box>
      <Alert severity="warning" sx={{ mb: 3 }}>このオークションは編集できません。</Alert>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{formData.title}</Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{formData.description}</Typography>
      </Paper>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/auctions')} sx={{ mr: 2 }}>戻る</Button>
          <Typography variant="h4">{isEdit ? 'オークション編集' : 'オークション作成'}</Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab icon={<SettingsIcon />} iconPosition="start" label="基本情報" />
            <Tab icon={<GavelIcon />}    iconPosition="start" label="カスタム設定" />
          </Tabs>
        </Paper>

        {/* 基本情報タブ */}
        <TabPanel value={tabValue} index={0}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={4}>
              <Box>
                <Typography variant="h6" gutterBottom>基本情報</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <TextField label="オークション名" value={formData.title} required fullWidth
                    onChange={(e) => setAuction({ title: e.target.value })}
                    inputProps={{ maxLength: 255 }} helperText={`${formData.title.length}/255文字`} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <DatePicker label="開催日" value={formData.event_date} minDate={new Date()}
                        onChange={(d) => setAuction({ event_date: d })}
                        slotProps={{ textField: { fullWidth: true, required: true } }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TimePicker label="開始時刻" value={formData.start_time}
                        onChange={(t) => setAuction({ start_time: t })}
                        slotProps={{ textField: { fullWidth: true, required: true } }} />
                    </Grid>
                  </Grid>
                  <TextField label="説明" value={formData.description} fullWidth multiline rows={4}
                    onChange={(e) => setAuction({ description: e.target.value })} />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>オークション設定</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField label="デフォルト入札単位" type="number" fullWidth required
                        value={formData.default_bid_increment}
                        onChange={(e) => setAuction({ default_bid_increment: parseInt(e.target.value) || 0 })}
                        InputProps={{ endAdornment: <InputAdornment position="end">円</InputAdornment> }} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField label="カウントダウン秒数" type="number" fullWidth required
                        value={formData.countdown_seconds}
                        onChange={(e) => setAuction({ countdown_seconds: parseInt(e.target.value) || 0 })}
                        InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                        inputProps={{ min: 1, max: 60 }} helperText="1〜60" />
                    </Grid>
                  </Grid>
                  <FormControlLabel control={
                    <Checkbox checked={formData.deposit_required}
                      onChange={(e) => setAuction({ deposit_required: e.target.checked })} />}
                    label="保証金必須" />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>期限設定</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <DateTimePicker label="商品アップロード期限" value={formData.upload_deadline}
                    onChange={(d) => setAuction({ upload_deadline: d })}
                    slotProps={{ textField: { fullWidth: true, helperText: '出品者がアップロードできる期限' } }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField label="入金期限" type="number" fullWidth required
                        value={formData.payment_deadline_hours}
                        onChange={(e) => setAuction({ payment_deadline_hours: parseInt(e.target.value) || 0 })}
                        InputProps={{ endAdornment: <InputAdornment position="end">時間</InputAdornment> }}
                        helperText="落札後の入金期限" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField label="発送期限" type="number" fullWidth required
                        value={formData.shipping_deadline_hours}
                        onChange={(e) => setAuction({ shipping_deadline_hours: parseInt(e.target.value) || 0 })}
                        InputProps={{ endAdornment: <InputAdornment position="end">時間</InputAdornment> }}
                        helperText="入金確認後の発送期限" />
                    </Grid>
                  </Grid>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </TabPanel>

        {/* カスタム設定タブ */}
        <TabPanel value={tabValue} index={1}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>カスタム設定</Typography>
                  <Typography variant="body2" color="text.secondary">このオークション専用の設定</Typography>
                </Box>
                <FormControlLabel control={
                  <Switch checked={formData.use_custom_settings}
                    onChange={(e) => setAuction({ use_custom_settings: e.target.checked })} />}
                  label={formData.use_custom_settings ? 'カスタム' : 'システムデフォルト'} />
              </Box>
              {!formData.use_custom_settings && (
                <Alert severity="info">システムデフォルト設定を使用しています。</Alert>
              )}
            </CardContent>
          </Card>

          {/* オークション設定 */}
          <Card sx={{ mb: 3, opacity: formData.use_custom_settings ? 1 : 0.5,
            pointerEvents: formData.use_custom_settings ? 'auto' : 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <GavelIcon sx={{ color: '#6366F1' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>オークション設定</Typography>
              </Box>
              <Grid container spacing={3}>
                {[
                  { label: '価格上昇率', key: 'price_increment_rate', unit: '%', systemKey: 'price_increment_rate', step: 1 },
                  { label: '最低上昇金額', key: 'price_increment_min', unit: '¥', systemKey: 'price_increment_min', prefix: true, step: 1 },
                  { label: 'カウントダウン（通常）', key: 'countdown_seconds_default', unit: '秒', systemKey: 'countdown_seconds_default', step: 0.5, helper: '0〜1人入札時' },
                  { label: 'カウントダウン（競合時）', key: 'countdown_seconds_competitive', unit: '秒', systemKey: 'countdown_seconds_competitive', step: 0.5, helper: '2人以上入札時' },
                  { label: '自動延長秒数', key: 'auto_extend_seconds', unit: '秒', systemKey: 'auto_extend_seconds', step: 1 },
                  { label: '会場入室可能開始', key: 'venue_open_minutes_before_start', unit: '分前', systemKey: 'venue_open_minutes_before_start', step: 1 },
                  { label: '生体切り替え後の入札開始待機', key: 'item_switch_delay_seconds', unit: '秒', systemKey: 'item_switch_delay_seconds', step: 0.5, helper: '0で待機なし' },
                ].map(({ label, key, unit, systemKey, prefix, step, helper }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <TextField fullWidth type="number" label={label}
                      value={(formData.custom_auction_settings as any)[key]}
                      onChange={(e) => setCustomAuction({ [key]: parseFloat(e.target.value) || 0 })}
                      InputProps={prefix
                        ? { startAdornment: <InputAdornment position="start">¥</InputAdornment> }
                        : { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                      inputProps={{ step, min: 0 }}
                      helperText={defaults ? `システム: ${(defaults.auction_settings as any)[systemKey] ?? '-'}${unit}${helper ? `（${helper}）` : ''}` : helper} />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* 料金設定 */}
          <Card sx={{ mb: 3, opacity: formData.use_custom_settings ? 1 : 0.5,
            pointerEvents: formData.use_custom_settings ? 'auto' : 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <MoneyIcon sx={{ color: '#059669' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>料金設定</Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12}><Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#059669' }}>出品者向け料金</Typography></Grid>
                {[
                  { label: '基本出品料', key: 'base_listing_fee', prefix: true },
                  { label: 'プレミアム出品料', key: 'premium_listing_fee', prefix: true },
                  { label: '販売手数料率', key: 'seller_commission_rate', unit: '%' },
                  { label: '最低手数料', key: 'seller_commission_min', prefix: true },
                ].map(({ label, key, unit, prefix }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <TextField fullWidth type="number" label={label}
                      value={(formData.custom_fee_settings as any)[key]}
                      onChange={(e) => setCustomFee({ [key]: parseFloat(e.target.value) || 0 })}
                      InputProps={prefix ? { startAdornment: <InputAdornment position="start">¥</InputAdornment> }
                        : { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                      helperText={defaults ? `システム: ${(defaults.fee_settings as any)[key]}` : ''} />
                  </Grid>
                ))}

                <Grid item xs={12}><Divider sx={{ my: 1 }} /><Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#3B82F6', mt: 2 }}>買受者向け料金</Typography></Grid>
                {[
                  { label: '落札手数料率', key: 'buyer_commission_rate', unit: '%' },
                  { label: '最低手数料', key: 'buyer_commission_min', prefix: true },
                ].map(({ label, key, unit, prefix }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <TextField fullWidth type="number" label={label}
                      value={(formData.custom_fee_settings as any)[key]}
                      onChange={(e) => setCustomFee({ [key]: parseFloat(e.target.value) || 0 })}
                      InputProps={prefix ? { startAdornment: <InputAdornment position="start">¥</InputAdornment> }
                        : { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                      helperText={defaults ? `システム: ${(defaults.fee_settings as any)[key]}` : ''} />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* 配送設定 */}
          <Card sx={{ mb: 3, opacity: formData.use_custom_settings ? 1 : 0.5,
            pointerEvents: formData.use_custom_settings ? 'auto' : 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <ShippingIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>配送・梱包設定</Typography>
              </Box>
              <Grid container spacing={3}>
                {[
                  { label: '梱包料金', key: 'packaging_fee' },
                  { label: '取扱手数料', key: 'handling_fee' },
                  { label: '保険料率', key: 'insurance_fee_rate', unit: '%' },
                  { label: '夏季クール便', key: 'cooling_fee_summer' },
                  { label: '冬季保温', key: 'heating_fee_winter' },
                  { label: '配送料割引率', key: 'shipping_discount_rate', unit: '%OFF' },
                ].map(({ label, key, unit }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <TextField fullWidth type="number" label={label}
                      value={(formData.custom_shipping_settings as any)[key]}
                      onChange={(e) => setCustomShipping({ [key]: parseFloat(e.target.value) || 0 })}
                      InputProps={unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }
                        : { startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                      helperText={defaults && !unit ? `システム: ¥${(defaults.shipping_settings as any)[key] ?? '-'}` : ''} />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </TabPanel>

        {/* 保存ボタン */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/admin/auctions')}>キャンセル</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}>
            {isEdit ? '更新' : '作成'}
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
