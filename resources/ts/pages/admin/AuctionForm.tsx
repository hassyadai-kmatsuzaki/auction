import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Grid,
  FormControl, FormControlLabel, Checkbox, CircularProgress,
  Alert, Stack, Divider, InputAdornment, Tabs, Tab,
  Card, CardContent, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem,
  IconButton,
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
import { formatYen } from '../../lib/formatPrice';
import { useAuctionForm } from '../../features/auction-form/hooks/useAuctionForm';
import NumberField from '../../components/NumberField';

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

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<SettingsIcon />} iconPosition="start" label="基本情報" />
          <Tab icon={<GavelIcon />} iconPosition="start" label="カスタム設定" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>{formData.title}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{formData.description}</Typography>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>カスタム設定</Typography>
                <Typography variant="body2" color="text.secondary">このオークション専用の設定（閲覧専用）</Typography>
              </Box>
              <Alert severity={formData.use_custom_settings ? 'success' : 'info'} sx={{ py: 0 }}>
                {formData.use_custom_settings ? 'カスタム設定: ON' : 'カスタム設定: OFF（システムデフォルト使用）'}
              </Alert>
            </Box>
          </CardContent>
        </Card>

        {formData.use_custom_settings && (
          <>
            {/* オークション設定（閲覧） */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <GavelIcon sx={{ color: '#6366F1' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>オークション設定</Typography>
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#6366F1' }}>カウントダウン設定</Typography>
                <Grid container spacing={3}>
                  {[
                    { label: 'オークション開始待機時間', key: 'auction_start_countdown_seconds', unit: '秒' },
                    { label: 'フリーズ（誤タップ防止）', key: 'freeze_countdown_seconds', unit: '秒' },
                    { label: '落札カウント', key: 'bid_countdown_seconds', unit: '秒' },
                    { label: '商品開始毎カウント', key: 'item_switch_delay_seconds', unit: '秒' },
                    { label: '会場入室可能開始', key: 'venue_open_minutes_before_start', unit: '分前' },
                  ].map(({ label, key, unit }) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <TextField fullWidth label={label} value={`${(formData.custom_auction_settings as any)[key]} ${unit}`}
                        InputProps={{ readOnly: true }} variant="filled" />
                    </Grid>
                  ))}
                </Grid>

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#6366F1' }}>金額帯別上昇幅テーブル</Typography>
                {(formData.custom_auction_settings.price_increment_tiers ?? []).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>下限金額</TableCell>
                          <TableCell>上限金額</TableCell>
                          <TableCell>上昇金額</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(formData.custom_auction_settings.price_increment_tiers ?? []).map((tier: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>¥{formatYen(tier.from_price)}</TableCell>
                            <TableCell>{tier.to_price != null ? `¥${formatYen(tier.to_price)}` : '上限なし'}</TableCell>
                            <TableCell>¥{formatYen(tier.increment_amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">設定なし</Typography>
                )}

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#6366F1' }}>金額帯別カウントダウン秒数テーブル</Typography>
                {(formData.custom_auction_settings.countdown_tiers ?? []).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>下限金額</TableCell>
                          <TableCell>上限金額</TableCell>
                          <TableCell>落札カウント（秒）</TableCell>
                          <TableCell>フリーズ（秒）</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(formData.custom_auction_settings.countdown_tiers ?? []).map((tier: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>¥{formatYen(tier.from_price)}</TableCell>
                            <TableCell>{tier.to_price != null ? `¥${formatYen(tier.to_price)}` : '上限なし'}</TableCell>
                            <TableCell>{tier.bid_countdown_seconds}秒</TableCell>
                            <TableCell>{tier.freeze_countdown_seconds}秒</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">設定なし（単一値設定を使用）</Typography>
                )}
              </CardContent>
            </Card>

            {/* 料金設定（閲覧） */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <MoneyIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>料金設定</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12}><Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#059669' }}>出品者向け料金</Typography></Grid>
                  {/* TODO: プレミアム出品プラン再開時にコメントを外す
                  {[{ label: 'プレミアム出品料', key: 'premium_listing_fee', prefix: '¥' }].map(({ label, key, prefix }) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <TextField fullWidth label={label}
                        value={`${prefix ?? ''}${(formData.custom_fee_settings as any)[key]}`}
                        InputProps={{ readOnly: true }} variant="filled" />
                    </Grid>
                  ))}
                  */}
                  {[
                    { label: '販売手数料率', key: 'seller_commission_rate', suffix: '%' },
                  ].map(({ label, key, suffix }) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <TextField fullWidth label={label}
                        value={`${(formData.custom_fee_settings as any)[key]}${suffix ?? ''}`}
                        InputProps={{ readOnly: true }} variant="filled" />
                    </Grid>
                  ))}
                  <Grid item xs={12}><Divider sx={{ my: 1 }} /><Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#3B82F6', mt: 2 }}>買受者向け料金</Typography></Grid>
                  {[
                    { label: '落札手数料率', key: 'buyer_commission_rate', suffix: '%' },
                  ].map(({ label, key, suffix }) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <TextField fullWidth label={label}
                        value={`${(formData.custom_fee_settings as any)[key]}${suffix ?? ''}`}
                        InputProps={{ readOnly: true }} variant="filled" />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* 配送設定（閲覧） */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ShippingIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>配送・梱包設定</Typography>
                </Box>
                <Grid container spacing={3}>
                  {[
                    { label: '梱包料金', key: 'packaging_fee', prefix: '¥' },
                    { label: '取扱手数料', key: 'handling_fee', prefix: '¥' },
                    { label: '保険料率', key: 'insurance_fee_rate', suffix: '%' },
                    { label: '夏季クール便', key: 'cooling_fee_summer', prefix: '¥' },
                    { label: '冬季保温', key: 'heating_fee_winter', prefix: '¥' },
                    { label: '配送料割引率', key: 'shipping_discount_rate', suffix: '%OFF' },
                  ].map(({ label, key, prefix, suffix }) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <TextField fullWidth label={label}
                        value={`${prefix ?? ''}${(formData.custom_shipping_settings as any)[key]}${suffix ?? ''}`}
                        InputProps={{ readOnly: true }} variant="filled" />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
      </TabPanel>
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
                <Typography variant="h6" gutterBottom>期限設定</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <DateTimePicker label="商品アップロード期限" value={formData.upload_deadline}
                    onChange={(d) => setAuction({ upload_deadline: d })}
                    slotProps={{ textField: { fullWidth: true, helperText: '出品者がアップロードできる期限' } }} />
                  <Alert severity="info">
                    落札後の<strong>お支払い期限は「翌水曜 23:59」固定</strong>です（オークション側では変更できません）。<br />
                    例：木曜開催 → 翌週水曜 23:59 まで／金曜開催 → 翌週水曜 23:59 まで。
                  </Alert>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>テスト用オークション</Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.is_test}
                      onChange={(e) => setAuction({ is_test: e.target.checked })}
                    />
                  }
                  label="テスト用オークションとして作成する"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                  ON にすると is_test=true な出品者だけが出品でき、is_test=true な買受者だけに見えます。本番ユーザーからは完全に隠れます。
                </Typography>
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
                    onChange={(e) => {
                      const useCustom = e.target.checked;
                      setAuction({ use_custom_settings: useCustom });
                      if (useCustom && defaults && !isEdit) {
                        setCustomAuction({
                          price_increment_rate: defaults.auction_settings.price_increment_rate ?? 10,
                          price_increment_min: defaults.auction_settings.price_increment_min ?? 50,
                          venue_open_minutes_before_start: defaults.auction_settings.venue_open_minutes_before_start ?? 30,
                          item_switch_delay_seconds: defaults.auction_settings.item_switch_delay_seconds ?? 5,
                          freeze_countdown_seconds: defaults.auction_settings.freeze_countdown_seconds ?? 1,
                          bid_countdown_seconds: defaults.auction_settings.bid_countdown_seconds ?? 5,
                          auction_start_countdown_seconds: defaults.auction_settings.auction_start_countdown_seconds ?? 10,
                          price_increment_tiers: defaults.auction_settings.price_increment_tiers ?? [],
                          countdown_tiers: defaults.auction_settings.countdown_tiers ?? [],
                        } as any);
                        if (defaults.fee_settings) setCustomFee({ ...defaults.fee_settings });
                        if (defaults.shipping_settings) setCustomShipping({ ...defaults.shipping_settings });
                      }
                    }} />}
                  label="カスタム設定" />
              </Box>
              {!formData.use_custom_settings && (
                <Alert severity="info">
                  カスタム設定をONにすると、このオークション専用の設定を使用します。OFFの場合はシステム設定画面のデフォルト値が適用されます。
                </Alert>
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
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#6366F1' }}>カウントダウン設定</Typography>
              <Grid container spacing={3}>
                {[
                  { label: 'オークション開始待機時間', key: 'auction_start_countdown_seconds', unit: '秒', systemKey: 'auction_start_countdown_seconds', step: 1, helper: '0〜3600秒' },
                  { label: 'フリーズ（誤タップ防止）', key: 'freeze_countdown_seconds', unit: '秒', systemKey: 'freeze_countdown_seconds', step: 0.1, helper: '0.1〜10秒' },
                  { label: '落札カウント', key: 'bid_countdown_seconds', unit: '秒', systemKey: 'bid_countdown_seconds', step: 0.5, helper: '0.5〜10秒' },
                  { label: '商品開始毎カウント', key: 'item_switch_delay_seconds', unit: '秒', systemKey: 'item_switch_delay_seconds', step: 0.5, helper: '0.5〜10秒' },
                  { label: '会場入室可能開始', key: 'venue_open_minutes_before_start', unit: '分前', systemKey: 'venue_open_minutes_before_start', step: 1 },
                ].map(({ label, key, unit, systemKey, step, helper }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <NumberField fullWidth label={label}
                      value={(formData.custom_auction_settings as any)[key]}
                      onValueChange={(v) => setCustomAuction({ [key]: parseFloat(v) || 0 })}
                      InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                      inputProps={{ step, min: 0 }}
                      helperText={defaults ? `システム: ${(defaults.auction_settings as any)[systemKey] ?? '-'}${unit}${helper ? `（${helper}）` : ''}` : helper} />
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#6366F1' }}>金額帯別上昇幅テーブル</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>現在の価格に応じて上昇金額が変わります。</Alert>
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
                    {(formData.custom_auction_settings.price_increment_tiers ?? []).map((tier: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <NumberField size="small" value={tier.from_price}
                            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.price_increment_tiers ?? [])];
                              tiers[idx] = { ...tiers[idx], from_price: parseInt(v) || 0 };
                              setCustomAuction({ price_increment_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumberField size="small" value={tier.to_price ?? ''} placeholder="上限なし"
                            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.price_increment_tiers ?? [])];
                              const val = v === '' ? null : parseInt(v);
                              tiers[idx] = { ...tiers[idx], to_price: val };
                              setCustomAuction({ price_increment_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumberField size="small" value={tier.increment_amount}
                            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.price_increment_tiers ?? [])];
                              tiers[idx] = { ...tiers[idx], increment_amount: parseInt(v) || 0 };
                              setCustomAuction({ price_increment_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => {
                            const tiers = (formData.custom_auction_settings.price_increment_tiers ?? []).filter((_: any, i: number) => i !== idx);
                            setCustomAuction({ price_increment_tiers: tiers } as any);
                          }}>×</IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button size="small" sx={{ mt: 1 }} onClick={() => {
                const tiers = [...(formData.custom_auction_settings.price_increment_tiers ?? [])];
                const last = tiers[tiers.length - 1];
                tiers.push({
                  from_price: last ? (last.to_price ?? last.from_price) + 1 : 0,
                  to_price: null,
                  increment_amount: last?.increment_amount ?? 100,
                });
                setCustomAuction({ price_increment_tiers: tiers } as any);
              }}>+ 行を追加</Button>

              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#6366F1' }}>金額帯別カウントダウン秒数テーブル</Typography>
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
                    {(formData.custom_auction_settings.countdown_tiers ?? []).map((tier: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <NumberField size="small" value={tier.from_price}
                            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.countdown_tiers ?? [])];
                              tiers[idx] = { ...tiers[idx], from_price: parseInt(v) || 0 };
                              setCustomAuction({ countdown_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumberField size="small" value={tier.to_price ?? ''} placeholder="上限なし"
                            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.countdown_tiers ?? [])];
                              const val = v === '' ? null : parseInt(v);
                              tiers[idx] = { ...tiers[idx], to_price: val };
                              setCustomAuction({ countdown_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumberField size="small" value={tier.bid_countdown_seconds}
                            InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                            inputProps={{ step: 0.5, min: 0.5 }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.countdown_tiers ?? [])];
                              tiers[idx] = { ...tiers[idx], bid_countdown_seconds: parseFloat(v) || 5 };
                              setCustomAuction({ countdown_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumberField size="small" value={tier.freeze_countdown_seconds}
                            InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                            inputProps={{ step: 0.1, min: 0.1 }}
                            onValueChange={(v) => {
                              const tiers = [...(formData.custom_auction_settings.countdown_tiers ?? [])];
                              tiers[idx] = { ...tiers[idx], freeze_countdown_seconds: parseFloat(v) || 1 };
                              setCustomAuction({ countdown_tiers: tiers } as any);
                            }} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => {
                            const tiers = (formData.custom_auction_settings.countdown_tiers ?? []).filter((_: any, i: number) => i !== idx);
                            setCustomAuction({ countdown_tiers: tiers } as any);
                          }}>×</IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button size="small" sx={{ mt: 1 }} onClick={() => {
                const tiers = [...(formData.custom_auction_settings.countdown_tiers ?? [])];
                const last = tiers[tiers.length - 1];
                tiers.push({
                  from_price: last ? (last.to_price ?? last.from_price) + 1 : 0,
                  to_price: null,
                  bid_countdown_seconds: last?.bid_countdown_seconds ?? 5,
                  freeze_countdown_seconds: last?.freeze_countdown_seconds ?? 1,
                });
                setCustomAuction({ countdown_tiers: tiers } as any);
              }}>+ 行を追加</Button>

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
                {/* TODO: プレミアム出品プラン再開時にコメントを外す
                {[{ label: 'プレミアム出品料', key: 'premium_listing_fee', prefix: true }].map(({ label, key, prefix }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <TextField fullWidth type="number" label={label}
                      value={(formData.custom_fee_settings as any)[key]}
                      onChange={(e) => setCustomFee({ [key]: parseFloat(e.target.value) || 0 })}
                      InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                      helperText={defaults ? `システム: ${(defaults.fee_settings as any)[key]}` : ''} />
                  </Grid>
                ))}
                */}
                {[
                  { label: '販売手数料率', key: 'seller_commission_rate', unit: '%' },
                ].map(({ label, key, unit }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <NumberField fullWidth label={label}
                      value={(formData.custom_fee_settings as any)[key]}
                      onValueChange={(v) => setCustomFee({ [key]: parseFloat(v) || 0 })}
                      InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                      helperText={defaults ? `システム: ${(defaults.fee_settings as any)[key]}` : ''} />
                  </Grid>
                ))}

                <Grid item xs={12}><Divider sx={{ my: 1 }} /><Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#3B82F6', mt: 2 }}>買受者向け料金</Typography></Grid>
                {[
                  { label: '落札手数料率', key: 'buyer_commission_rate', unit: '%' },
                ].map(({ label, key, unit }) => (
                  <Grid item xs={12} sm={6} md={3} key={key}>
                    <NumberField fullWidth label={label}
                      value={(formData.custom_fee_settings as any)[key]}
                      onValueChange={(v) => setCustomFee({ [key]: parseFloat(v) || 0 })}
                      InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
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
                    <NumberField fullWidth label={label}
                      value={(formData.custom_shipping_settings as any)[key]}
                      onValueChange={(v) => setCustomShipping({ [key]: parseFloat(v) || 0 })}
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
