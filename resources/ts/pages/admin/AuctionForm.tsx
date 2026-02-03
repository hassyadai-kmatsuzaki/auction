import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  InputAdornment,
  Tabs,
  Tab,
  Card,
  CardContent,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  Gavel as GavelIcon,
  AttachMoney as MoneyIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker, TimePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import axios from '../../lib/axios';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface FormData {
  title: string;
  event_date: Date | null;
  start_time: Date | null;
  description: string;
  lane_count: number;
  default_bid_increment: number;
  countdown_seconds: number;
  deposit_required: boolean;
  upload_deadline: Date | null;
  payment_deadline_hours: number;
  shipping_deadline_hours: number;
  // カスタム設定
  use_custom_settings: boolean;
  custom_auction_settings: {
    price_increment_rate: number;
    price_increment_min: number;
    countdown_seconds: number;
    auto_extend_seconds: number;
  };
  custom_fee_settings: {
    seller_commission_rate: number;
    seller_commission_min: number;
    buyer_commission_rate: number;
    buyer_commission_min: number;
    base_listing_fee: number;
    premium_listing_fee: number;
  };
  custom_shipping_settings: {
    packaging_fee: number;
    handling_fee: number;
    insurance_fee_rate: number;
    cooling_fee_summer: number;
    heating_fee_winter: number;
    shipping_discount_rate: number;
  };
}

interface DefaultSettings {
  auction_settings: {
    price_increment_rate: number;
    price_increment_min: number;
    countdown_seconds: number;
    max_lanes: number;
    auto_extend_seconds: number;
  };
  fee_settings: {
    seller_commission_rate: number;
    seller_commission_min: number;
    buyer_commission_rate: number;
    buyer_commission_min: number;
    base_listing_fee: number;
    premium_listing_fee: number;
  };
  shipping_settings: {
    packaging_fee: number;
    handling_fee: number;
    insurance_fee_rate: number;
    cooling_fee_summer: number;
    heating_fee_winter: number;
    shipping_rates: Array<{
      region: string;
      size_60: number;
      size_80: number;
      size_100: number;
    }>;
  };
}

export default function AuctionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    event_date: null,
    start_time: new Date(0, 0, 0, 10, 0),
    description: '',
    lane_count: 6,
    default_bid_increment: 100,
    countdown_seconds: 3,
    deposit_required: false,
    upload_deadline: null,
    payment_deadline_hours: 24,
    shipping_deadline_hours: 48,
    use_custom_settings: false,
    custom_auction_settings: {
      price_increment_rate: 10,
      price_increment_min: 50,
      countdown_seconds: 3,
      auto_extend_seconds: 10,
    },
    custom_fee_settings: {
      seller_commission_rate: 10,
      seller_commission_min: 500,
      buyer_commission_rate: 5,
      buyer_commission_min: 300,
      base_listing_fee: 500,
      premium_listing_fee: 800,
    },
    custom_shipping_settings: {
      packaging_fee: 500,
      handling_fee: 300,
      insurance_fee_rate: 3,
      cooling_fee_summer: 300,
      heating_fee_winter: 300,
      shipping_discount_rate: 0,
    },
  });

  const [defaultSettings, setDefaultSettings] = useState<DefaultSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    fetchDefaultSettings();
    if (isEdit) {
      fetchAuction();
    }
  }, [id]);

  const fetchDefaultSettings = async () => {
    try {
      const response = await axios.get('/api/admin/settings/defaults');
      if (response.data.success) {
        setDefaultSettings(response.data.data);
        // デフォルト設定でフォームを初期化
        if (!isEdit) {
          setFormData(prev => ({
            ...prev,
            custom_auction_settings: {
              price_increment_rate: response.data.data.auction_settings.price_increment_rate,
              price_increment_min: response.data.data.auction_settings.price_increment_min || 50,
              countdown_seconds: response.data.data.auction_settings.countdown_seconds,
              auto_extend_seconds: response.data.data.auction_settings.auto_extend_seconds || 10,
            },
            custom_fee_settings: {
              seller_commission_rate: response.data.data.fee_settings.seller_commission_rate,
              seller_commission_min: response.data.data.fee_settings.seller_commission_min,
              buyer_commission_rate: response.data.data.fee_settings.buyer_commission_rate,
              buyer_commission_min: response.data.data.fee_settings.buyer_commission_min,
              base_listing_fee: response.data.data.fee_settings.base_listing_fee,
              premium_listing_fee: response.data.data.fee_settings.premium_listing_fee,
            },
            custom_shipping_settings: {
              packaging_fee: response.data.data.shipping_settings.packaging_fee,
              handling_fee: response.data.data.shipping_settings.handling_fee,
              insurance_fee_rate: response.data.data.shipping_settings.insurance_fee_rate,
              cooling_fee_summer: response.data.data.shipping_settings.cooling_fee_summer,
              heating_fee_winter: response.data.data.shipping_settings.heating_fee_winter,
              shipping_discount_rate: 0,
            },
          }));
        }
      }
    } catch (err) {
      console.error('デフォルト設定取得エラー:', err);
    }
  };

  const fetchAuction = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get(`/api/admin/auctions/${id}`);
      
      if (response.data.success) {
        const auction = response.data.data.auction;
        
        if (!['preparing', 'scheduled'].includes(auction.status)) {
          setCanEdit(false);
        }
        
        const startTime = new Date(0, 0, 0);
        if (auction.start_time) {
          const [hours, minutes] = auction.start_time.split(':');
          startTime.setHours(parseInt(hours), parseInt(minutes));
        }
        
        setFormData({
          title: auction.title,
          event_date: auction.event_date ? new Date(auction.event_date) : null,
          start_time: startTime,
          description: auction.description || '',
          lane_count: auction.lane_count,
          default_bid_increment: parseFloat(auction.default_bid_increment),
          countdown_seconds: auction.countdown_seconds,
          deposit_required: auction.deposit_required,
          upload_deadline: auction.upload_deadline ? new Date(auction.upload_deadline) : null,
          payment_deadline_hours: auction.payment_deadline_hours,
          shipping_deadline_hours: auction.shipping_deadline_hours,
          use_custom_settings: auction.use_custom_settings || false,
          custom_auction_settings: auction.custom_auction_settings || formData.custom_auction_settings,
          custom_fee_settings: auction.custom_fee_settings || formData.custom_fee_settings,
          custom_shipping_settings: auction.custom_shipping_settings || formData.custom_shipping_settings,
        });
      }
    } catch (err: any) {
      console.error('オークション取得エラー:', err);
      setError(err.response?.data?.message || 'オークションの取得に失敗しました。');
    } finally {
      setFetchLoading(false);
    }
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) return 'オークション名を入力してください。';
    if (formData.title.length > 255) return 'オークション名は255文字以内で入力してください。';
    if (!formData.event_date) return '開催日を選択してください。';
    if (formData.event_date < new Date(new Date().setHours(0, 0, 0, 0))) return '開催日は本日以降を指定してください。';
    if (!formData.start_time) return '開始時刻を選択してください。';
    if (formData.lane_count < 1 || formData.lane_count > 10) return 'レーン数は1〜10の範囲で指定してください。';
    if (formData.default_bid_increment < 1) return 'デフォルト入札単位は1円以上を指定してください。';
    if (formData.countdown_seconds < 1 || formData.countdown_seconds > 60) return 'カウントダウン秒数は1〜60秒の範囲で指定してください。';
    if (formData.payment_deadline_hours < 1) return '入金期限は1時間以上を指定してください。';
    if (formData.shipping_deadline_hours < 1) return '発送期限は1時間以上を指定してください。';
    if (formData.upload_deadline && formData.event_date && formData.upload_deadline >= formData.event_date) {
      return 'アップロード期限は開催日より前に設定してください。';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startTime = formData.start_time
        ? `${formData.start_time.getHours().toString().padStart(2, '0')}:${formData.start_time.getMinutes().toString().padStart(2, '0')}`
        : '10:00';

      // ローカルタイムゾーンの日付を正しく取得（toISOStringはUTCに変換されるため使用しない）
      const formatLocalDate = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const formatLocalDateTime = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      const payload = {
        title: formData.title,
        event_date: formatLocalDate(formData.event_date),
        start_time: startTime,
        description: formData.description,
        lane_count: formData.lane_count,
        default_bid_increment: formData.default_bid_increment,
        countdown_seconds: formData.countdown_seconds,
        deposit_required: formData.deposit_required,
        upload_deadline: formatLocalDateTime(formData.upload_deadline),
        payment_deadline_hours: formData.payment_deadline_hours,
        shipping_deadline_hours: formData.shipping_deadline_hours,
        use_custom_settings: formData.use_custom_settings,
        custom_auction_settings: formData.use_custom_settings ? formData.custom_auction_settings : null,
        custom_fee_settings: formData.use_custom_settings ? formData.custom_fee_settings : null,
        custom_shipping_settings: formData.use_custom_settings ? formData.custom_shipping_settings : null,
      };

      if (isEdit) {
        await axios.put(`/api/admin/auctions/${id}`, payload);
      } else {
        await axios.post('/api/admin/auctions', payload);
      }

      navigate('/admin/auctions');
    } catch (err: any) {
      console.error('保存エラー:', err);
      setError(err.response?.data?.message || '保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!canEdit && isEdit) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/auctions')} sx={{ mr: 2 }}>
            戻る
          </Button>
          <Typography variant="h4">オークション詳細</Typography>
        </Box>
        <Alert severity="warning" sx={{ mb: 3 }}>
          このオークションは編集できません。
        </Alert>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>{formData.title}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{formData.description}</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/auctions')} sx={{ mr: 2 }}>
            戻る
          </Button>
          <Typography variant="h4">
            {isEdit ? 'オークション編集' : 'オークション作成'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab icon={<SettingsIcon />} iconPosition="start" label="基本情報" />
            <Tab icon={<GavelIcon />} iconPosition="start" label="カスタム設定" />
          </Tabs>
        </Paper>

        {/* 基本情報タブ */}
        <TabPanel value={tabValue} index={0}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={4}>
              <Box>
                <Typography variant="h6" gutterBottom>基本情報</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <TextField
                    label="オークション名"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    fullWidth
                    inputProps={{ maxLength: 255 }}
                    helperText={`${formData.title.length}/255文字`}
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <DatePicker
                        label="開催日"
                        value={formData.event_date}
                        onChange={(date) => setFormData({ ...formData, event_date: date })}
                        minDate={new Date()}
                        slotProps={{ textField: { fullWidth: true, required: true } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TimePicker
                        label="開始時刻"
                        value={formData.start_time}
                        onChange={(time) => setFormData({ ...formData, start_time: time })}
                        slotProps={{ textField: { fullWidth: true, required: true } }}
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    label="説明"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    fullWidth
                    multiline
                    rows={4}
                  />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>オークション設定</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="レーン数"
                        type="number"
                        value={formData.lane_count}
                        onChange={(e) => setFormData({ ...formData, lane_count: parseInt(e.target.value) || 0 })}
                        required
                        fullWidth
                        InputProps={{ inputProps: { min: 1, max: 10 } }}
                        helperText="1〜10"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="デフォルト入札単位"
                        type="number"
                        value={formData.default_bid_increment}
                        onChange={(e) => setFormData({ ...formData, default_bid_increment: parseInt(e.target.value) || 0 })}
                        required
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">円</InputAdornment>,
                          inputProps: { min: 1 },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="カウントダウン秒数"
                        type="number"
                        value={formData.countdown_seconds}
                        onChange={(e) => setFormData({ ...formData, countdown_seconds: parseInt(e.target.value) || 0 })}
                        required
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                          inputProps: { min: 1, max: 60 },
                        }}
                        helperText="1〜60"
                      />
                    </Grid>
                  </Grid>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deposit_required}
                        onChange={(e) => setFormData({ ...formData, deposit_required: e.target.checked })}
                      />
                    }
                    label="保証金必須"
                  />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>期限設定</Typography>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <DateTimePicker
                    label="商品アップロード期限"
                    value={formData.upload_deadline}
                    onChange={(date) => setFormData({ ...formData, upload_deadline: date })}
                    maxDateTime={formData.event_date || undefined}
                    slotProps={{
                      textField: { fullWidth: true, helperText: '出品者が生体情報をアップロードできる期限' },
                    }}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="入金期限"
                        type="number"
                        value={formData.payment_deadline_hours}
                        onChange={(e) => setFormData({ ...formData, payment_deadline_hours: parseInt(e.target.value) || 0 })}
                        required
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">時間</InputAdornment>,
                          inputProps: { min: 1 },
                        }}
                        helperText="落札後の入金期限"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="発送期限"
                        type="number"
                        value={formData.shipping_deadline_hours}
                        onChange={(e) => setFormData({ ...formData, shipping_deadline_hours: parseInt(e.target.value) || 0 })}
                        required
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">時間</InputAdornment>,
                          inputProps: { min: 1 },
                        }}
                        helperText="入金確認後の発送期限"
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </TabPanel>

        {/* カスタム設定タブ */}
        <TabPanel value={tabValue} index={1}>
          {/* カスタム設定ON/OFF */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>カスタム設定</Typography>
                  <Typography variant="body2" color="text.secondary">
                    このオークション専用の設定を使用する場合はONにしてください
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.use_custom_settings}
                      onChange={(e) => setFormData({ ...formData, use_custom_settings: e.target.checked })}
                    />
                  }
                  label={formData.use_custom_settings ? 'カスタム' : 'システムデフォルト'}
                />
              </Box>

              {!formData.use_custom_settings && (
                <Alert severity="info">
                  システムデフォルト設定を使用しています。カスタム設定を使用する場合はスイッチをONにしてください。
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* オークション設定セクション */}
          <Card sx={{ mb: 3, opacity: formData.use_custom_settings ? 1 : 0.5, pointerEvents: formData.use_custom_settings ? 'auto' : 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <GavelIcon sx={{ color: '#6366F1' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>オークション設定</Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="価格上昇率"
                    value={formData.custom_auction_settings.price_increment_rate}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_auction_settings: {
                        ...formData.custom_auction_settings,
                        price_increment_rate: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ${defaultSettings.auction_settings.price_increment_rate}%` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="最低上昇金額"
                    value={formData.custom_auction_settings.price_increment_min}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_auction_settings: {
                        ...formData.custom_auction_settings,
                        price_increment_min: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.auction_settings.price_increment_min || 50}` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="カウントダウン秒数"
                    value={formData.custom_auction_settings.countdown_seconds}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_auction_settings: {
                        ...formData.custom_auction_settings,
                        countdown_seconds: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ${defaultSettings.auction_settings.countdown_seconds}秒` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="自動延長秒数"
                    value={formData.custom_auction_settings.auto_extend_seconds}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_auction_settings: {
                        ...formData.custom_auction_settings,
                        auto_extend_seconds: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ${defaultSettings.auction_settings.auto_extend_seconds || 10}秒` : ''}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 料金設定セクション */}
          <Card sx={{ mb: 3, opacity: formData.use_custom_settings ? 1 : 0.5, pointerEvents: formData.use_custom_settings ? 'auto' : 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <MoneyIcon sx={{ color: '#059669' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>料金設定</Typography>
              </Box>
              <Grid container spacing={3}>
                {/* 出品者向け */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#059669', mb: 2 }}>
                    出品者向け料金
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="基本出品料"
                    value={formData.custom_fee_settings.base_listing_fee}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_fee_settings: {
                        ...formData.custom_fee_settings,
                        base_listing_fee: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.fee_settings.base_listing_fee}` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="プレミアム出品料"
                    value={formData.custom_fee_settings.premium_listing_fee}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_fee_settings: {
                        ...formData.custom_fee_settings,
                        premium_listing_fee: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.fee_settings.premium_listing_fee}` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="販売手数料率"
                    value={formData.custom_fee_settings.seller_commission_rate}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_fee_settings: {
                        ...formData.custom_fee_settings,
                        seller_commission_rate: parseFloat(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ${defaultSettings.fee_settings.seller_commission_rate}%` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="最低手数料"
                    value={formData.custom_fee_settings.seller_commission_min}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_fee_settings: {
                        ...formData.custom_fee_settings,
                        seller_commission_min: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.fee_settings.seller_commission_min}` : ''}
                  />
                </Grid>

                {/* 買受者向け */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#3B82F6', mt: 2, mb: 2 }}>
                    買受者向け料金
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="落札手数料率"
                    value={formData.custom_fee_settings.buyer_commission_rate}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_fee_settings: {
                        ...formData.custom_fee_settings,
                        buyer_commission_rate: parseFloat(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ${defaultSettings.fee_settings.buyer_commission_rate}%` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="最低手数料"
                    value={formData.custom_fee_settings.buyer_commission_min}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_fee_settings: {
                        ...formData.custom_fee_settings,
                        buyer_commission_min: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.fee_settings.buyer_commission_min}` : ''}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 配送・梱包設定セクション */}
          <Card sx={{ mb: 3, opacity: formData.use_custom_settings ? 1 : 0.5, pointerEvents: formData.use_custom_settings ? 'auto' : 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <ShippingIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>配送・梱包設定</Typography>
              </Box>
              <Grid container spacing={3}>
                {/* 梱包・手数料 */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 2 }}>
                    梱包・手数料
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="梱包料金"
                    value={formData.custom_shipping_settings.packaging_fee}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_shipping_settings: {
                        ...formData.custom_shipping_settings,
                        packaging_fee: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.shipping_settings.packaging_fee}` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="取扱手数料"
                    value={formData.custom_shipping_settings.handling_fee}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_shipping_settings: {
                        ...formData.custom_shipping_settings,
                        handling_fee: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.shipping_settings.handling_fee}` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="保険料率"
                    value={formData.custom_shipping_settings.insurance_fee_rate}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_shipping_settings: {
                        ...formData.custom_shipping_settings,
                        insurance_fee_rate: parseFloat(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ${defaultSettings.shipping_settings.insurance_fee_rate}%` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="配送料割引率"
                    value={formData.custom_shipping_settings.shipping_discount_rate}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_shipping_settings: {
                        ...formData.custom_shipping_settings,
                        shipping_discount_rate: parseFloat(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ endAdornment: <InputAdornment position="end">%OFF</InputAdornment> }}
                    helperText="このオークション限定の配送料割引"
                  />
                </Grid>

                {/* 季節料金 */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mt: 2, mb: 2 }}>
                    季節料金
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="夏季クール便料金"
                    value={formData.custom_shipping_settings.cooling_fee_summer}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_shipping_settings: {
                        ...formData.custom_shipping_settings,
                        cooling_fee_summer: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.shipping_settings.cooling_fee_summer}（6-9月）` : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="冬季保温料金"
                    value={formData.custom_shipping_settings.heating_fee_winter}
                    onChange={(e) => setFormData({
                      ...formData,
                      custom_shipping_settings: {
                        ...formData.custom_shipping_settings,
                        heating_fee_winter: parseInt(e.target.value) || 0,
                      },
                    })}
                    InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                    helperText={defaultSettings ? `システム: ¥${defaultSettings.shipping_settings.heating_fee_winter}（12-2月）` : ''}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 地域別配送料金（参考情報） */}
          {defaultSettings?.shipping_settings.shipping_rates && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>地域別配送料金（参考）</Typography>
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
                      {defaultSettings.shipping_settings.shipping_rates.map((rate, index) => (
                        <TableRow key={index}>
                          <TableCell>{rate.region}</TableCell>
                          <TableCell align="right">¥{rate.size_60?.toLocaleString()}</TableCell>
                          <TableCell align="right">¥{rate.size_80?.toLocaleString()}</TableCell>
                          <TableCell align="right">¥{rate.size_100?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  ※ 配送料金テーブルはシステム設定で変更できます
                </Typography>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* 保存ボタン */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/admin/auctions')}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {isEdit ? '更新' : '作成'}
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
