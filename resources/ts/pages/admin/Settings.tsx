import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Divider,
  Card,
  CardContent,
  InputAdornment,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Switch,
  FormControlLabel,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  Settings as SettingsIcon,
  AttachMoney as MoneyIcon,
  LocalShipping as ShippingIcon,
  Receipt as ReceiptIcon,
  Gavel as GavelIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
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

interface ShippingRate {
  region: string;
  size_60: number;
  size_80: number;
  size_100: number;
}

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // システム設定
  const [systemSettings, setSystemSettings] = useState({
    site_name: '',
    contact_email: '',
    contact_phone: '',
    business_hours: '',
  });

  // オークション設定
  const [auctionSettings, setAuctionSettings] = useState({
    price_increment_rate: '',
    price_increment_min: '',
    countdown_seconds: '',
    default_lane_count: '',
    auto_extend_seconds: '',
    default_bid_increment: '',
  });

  // 料金設定
  const [feeSettings, setFeeSettings] = useState({
    seller_registration_fee: '',
    seller_annual_fee: '',
    base_listing_fee: '',
    premium_plan_fee: '',
    default_commission_rate: '',
    seller_commission_min: '',
    buyer_registration_fee: '',
    buyer_commission_rate: '',
    buyer_commission_min: '',
  });

  // 配送・梱包料金
  const [shippingSettings, setShippingSettings] = useState({
    packaging_fee: '',
    handling_fee: '',
    insurance_fee_rate: '',
    cooling_fee_summer: '',
    heating_fee_winter: '',
  });

  // 配送料金テーブル
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [editShippingDialog, setEditShippingDialog] = useState(false);

  // 帳票設定
  const [documentSettings, setDocumentSettings] = useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    bank_name: '',
    bank_branch: '',
    bank_account_type: '',
    bank_account_number: '',
    bank_account_holder: '',
    invoice_prefix: '',
    payment_notice_prefix: '',
    warranty_validity_days: '',
    auto_generate_invoice: false,
    auto_generate_payment_notice: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/settings');
      
      if (response.data.success) {
        const data = response.data.data.settings;
        
        // システム設定
        if (data.site) {
          setSystemSettings({
            site_name: data.site.site_name?.value || '',
            contact_email: data.site.contact_email?.value || '',
            contact_phone: data.site.contact_phone?.value || '',
            business_hours: data.site.business_hours?.value || '',
          });
        }
        
        // オークション設定
        if (data.auction) {
          setAuctionSettings({
            price_increment_rate: String(data.auction.price_increment_rate?.value ?? '10'),
            price_increment_min: String(data.auction.price_increment_min?.value ?? '50'),
            countdown_seconds: String(data.auction.countdown_seconds?.value ?? '3'),
            default_lane_count: String(data.auction.default_lane_count?.value ?? '6'),
            auto_extend_seconds: String(data.auction.auto_extend_seconds?.value ?? '10'),
            default_bid_increment: String(data.auction.default_bid_increment?.value ?? '100'),
          });
        }
        
        // 料金設定
        if (data.premium || data.payment) {
          setFeeSettings({
            seller_registration_fee: String(data.payment?.seller_registration_fee?.value ?? '3000'),
            seller_annual_fee: String(data.payment?.seller_annual_fee?.value ?? '0'),
            base_listing_fee: String(data.payment?.base_listing_fee?.value ?? '500'),
            premium_plan_fee: String(data.premium?.premium_plan_fee?.value ?? '300'),
            default_commission_rate: String(data.payment?.default_commission_rate?.value ?? '10'),
            seller_commission_min: String(data.payment?.seller_commission_min?.value ?? '500'),
            buyer_registration_fee: String(data.payment?.buyer_registration_fee?.value ?? '0'),
            buyer_commission_rate: String(data.payment?.buyer_commission_rate?.value ?? '5'),
            buyer_commission_min: String(data.payment?.buyer_commission_min?.value ?? '300'),
          });
        }
        
        // 配送設定
        if (data.shipping) {
          setShippingSettings({
            packaging_fee: String(data.shipping.packaging_fee?.value ?? '500'),
            handling_fee: String(data.shipping.handling_fee?.value ?? '300'),
            insurance_fee_rate: String(data.shipping.insurance_fee_rate?.value ?? '3'),
            cooling_fee_summer: String(data.shipping.cooling_fee_summer?.value ?? '300'),
            heating_fee_winter: String(data.shipping.heating_fee_winter?.value ?? '300'),
          });
          
          if (data.shipping.shipping_rates?.value) {
            setShippingRates(data.shipping.shipping_rates.value);
          }
        }
        
        // 帳票設定
        if (data.document) {
          setDocumentSettings({
            company_name: data.document.company_name?.value || '',
            company_address: data.document.company_address?.value || '',
            company_phone: data.document.company_phone?.value || '',
            company_email: data.document.company_email?.value || '',
            bank_name: data.document.bank_name?.value || '',
            bank_branch: data.document.bank_branch?.value || '',
            bank_account_type: data.document.bank_account_type?.value || '',
            bank_account_number: data.document.bank_account_number?.value || '',
            bank_account_holder: data.document.bank_account_holder?.value || '',
            invoice_prefix: data.document.invoice_prefix?.value || '',
            payment_notice_prefix: data.document.payment_notice_prefix?.value || '',
            warranty_validity_days: String(data.document.warranty_validity_days?.value ?? '14'),
            auto_generate_invoice: data.document.auto_generate_invoice?.value || false,
            auto_generate_payment_notice: data.document.auto_generate_payment_notice?.value || false,
          });
        }
      }
    } catch (err) {
      console.error('設定取得エラー:', err);
      setSnackbar({ open: true, message: '設定の取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      const settings = {
        // システム設定
        site_name: systemSettings.site_name,
        contact_email: systemSettings.contact_email,
        contact_phone: systemSettings.contact_phone,
        business_hours: systemSettings.business_hours,
        // オークション設定
        price_increment_rate: auctionSettings.price_increment_rate,
        price_increment_min: auctionSettings.price_increment_min,
        countdown_seconds: auctionSettings.countdown_seconds,
        default_lane_count: auctionSettings.default_lane_count,
        auto_extend_seconds: auctionSettings.auto_extend_seconds,
        default_bid_increment: auctionSettings.default_bid_increment,
        // 料金設定
        seller_registration_fee: feeSettings.seller_registration_fee,
        seller_annual_fee: feeSettings.seller_annual_fee,
        base_listing_fee: feeSettings.base_listing_fee,
        premium_plan_fee: feeSettings.premium_plan_fee,
        default_commission_rate: feeSettings.default_commission_rate,
        seller_commission_min: feeSettings.seller_commission_min,
        buyer_registration_fee: feeSettings.buyer_registration_fee,
        buyer_commission_rate: feeSettings.buyer_commission_rate,
        buyer_commission_min: feeSettings.buyer_commission_min,
        // 配送設定
        packaging_fee: shippingSettings.packaging_fee,
        handling_fee: shippingSettings.handling_fee,
        insurance_fee_rate: shippingSettings.insurance_fee_rate,
        cooling_fee_summer: shippingSettings.cooling_fee_summer,
        heating_fee_winter: shippingSettings.heating_fee_winter,
        // 帳票設定
        company_name: documentSettings.company_name,
        company_address: documentSettings.company_address,
        company_phone: documentSettings.company_phone,
        company_email: documentSettings.company_email,
        bank_name: documentSettings.bank_name,
        bank_branch: documentSettings.bank_branch,
        bank_account_type: documentSettings.bank_account_type,
        bank_account_number: documentSettings.bank_account_number,
        bank_account_holder: documentSettings.bank_account_holder,
        invoice_prefix: documentSettings.invoice_prefix,
        payment_notice_prefix: documentSettings.payment_notice_prefix,
        warranty_validity_days: documentSettings.warranty_validity_days,
        auto_generate_invoice: documentSettings.auto_generate_invoice,
        auto_generate_payment_notice: documentSettings.auto_generate_payment_notice,
      };
      
      await axios.put('/api/admin/settings', { settings });
      setSnackbar({ open: true, message: '設定を保存しました', severity: 'success' });
    } catch (err) {
      console.error('設定保存エラー:', err);
      setSnackbar({ open: true, message: '設定の保存に失敗しました', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSystemChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSystemSettings({ ...systemSettings, [field]: e.target.value });
  };

  const handleAuctionChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuctionSettings({ ...auctionSettings, [field]: e.target.value });
  };

  const handleFeeChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeeSettings({ ...feeSettings, [field]: e.target.value });
  };

  const handleShippingChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setShippingSettings({ ...shippingSettings, [field]: e.target.value });
  };

  const handleDocumentChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentSettings({ ...documentSettings, [field]: e.target.value });
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            システム設定
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            オークションシステムの各種設定を管理します
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSubmit}
          disabled={saving}
        >
          すべて保存
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<SettingsIcon />} iconPosition="start" label="システム" />
          <Tab icon={<GavelIcon />} iconPosition="start" label="オークション" />
          <Tab icon={<MoneyIcon />} iconPosition="start" label="料金設定" />
          <Tab icon={<ShippingIcon />} iconPosition="start" label="配送・梱包" />
          <Tab icon={<ReceiptIcon />} iconPosition="start" label="帳票" />
        </Tabs>
      </Paper>

      {/* システム設定 */}
      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              基本情報
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="サイト名"
                  value={systemSettings.site_name}
                  onChange={handleSystemChange('site_name')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="連絡先メールアドレス"
                  type="email"
                  value={systemSettings.contact_email}
                  onChange={handleSystemChange('contact_email')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="連絡先電話番号"
                  value={systemSettings.contact_phone}
                  onChange={handleSystemChange('contact_phone')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="営業時間"
                  value={systemSettings.business_hours}
                  onChange={handleSystemChange('business_hours')}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* オークション設定 */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              入札ルール（システムデフォルト）
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              この設定はシステム全体のデフォルト値です。オークション作成時に個別にカスタマイズできます。
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="価格上昇率"
                  value={auctionSettings.price_increment_rate}
                  onChange={handleAuctionChange('price_increment_rate')}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="複数人入札時の価格上昇率"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="最低上昇金額"
                  value={auctionSettings.price_increment_min}
                  onChange={handleAuctionChange('price_increment_min')}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                  helperText="最低でもこの金額は上昇"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="カウントダウン秒数"
                  value={auctionSettings.countdown_seconds}
                  onChange={handleAuctionChange('countdown_seconds')}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                  }}
                  helperText="価格上昇までの待機時間"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="デフォルトレーン数"
                  value={auctionSettings.default_lane_count}
                  onChange={handleAuctionChange('default_lane_count')}
                  helperText="同時進行できるレーン数"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="自動延長秒数"
                  value={auctionSettings.auto_extend_seconds}
                  onChange={handleAuctionChange('auto_extend_seconds')}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                  }}
                  helperText="終了直前の入札で延長"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="デフォルト入札単位"
                  value={auctionSettings.default_bid_increment}
                  onChange={handleAuctionChange('default_bid_increment')}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  }}
                  helperText="価格上昇の単位"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* 料金設定 */}
      <TabPanel value={tabValue} index={2}>
        <Alert severity="info" sx={{ mb: 3 }}>
          この設定はシステム全体のデフォルト値です。オークション作成時に個別にカスタマイズできます。
        </Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#059669' }}>
                  出品者向け料金
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="登録料（初回）"
                      value={feeSettings.seller_registration_fee}
                      onChange={handleFeeChange('seller_registration_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="出品者登録時の初期費用"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="年会費"
                      value={feeSettings.seller_annual_fee}
                      onChange={handleFeeChange('seller_annual_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="年間維持費（0で無料）"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="基本出品料"
                      value={feeSettings.base_listing_fee}
                      onChange={handleFeeChange('base_listing_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="1点あたりの出品料"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="プレミアム出品料"
                      value={feeSettings.premium_plan_fee}
                      onChange={handleFeeChange('premium_plan_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="個別撮影付きの出品料"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="販売手数料率"
                      value={feeSettings.default_commission_rate}
                      onChange={handleFeeChange('default_commission_rate')}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      helperText="落札金額に対する手数料"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="最低手数料"
                      value={feeSettings.seller_commission_min}
                      onChange={handleFeeChange('seller_commission_min')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="1点あたりの最低手数料"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#3B82F6' }}>
                  買受者向け料金
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="登録料"
                      value={feeSettings.buyer_registration_fee}
                      onChange={handleFeeChange('buyer_registration_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="買受者登録時の費用（0で無料）"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="落札手数料率"
                      value={feeSettings.buyer_commission_rate}
                      onChange={handleFeeChange('buyer_commission_rate')}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      helperText="落札金額に対する手数料"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="最低手数料"
                      value={feeSettings.buyer_commission_min}
                      onChange={handleFeeChange('buyer_commission_min')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="1点あたりの最低手数料"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 配送・梱包設定 */}
      <TabPanel value={tabValue} index={3}>
        <Alert severity="info" sx={{ mb: 3 }}>
          この設定はシステム全体のデフォルト値です。オークション作成時に個別にカスタマイズできます。
        </Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  梱包・手数料
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="梱包料金"
                      value={shippingSettings.packaging_fee}
                      onChange={handleShippingChange('packaging_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="1件あたりの梱包費"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="取扱手数料"
                      value={shippingSettings.handling_fee}
                      onChange={handleShippingChange('handling_fee')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="発送事務手数料"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="保険料率"
                      value={shippingSettings.insurance_fee_rate}
                      onChange={handleShippingChange('insurance_fee_rate')}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      helperText="落札金額に対する保険料"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="夏季クール便料金"
                      value={shippingSettings.cooling_fee_summer}
                      onChange={handleShippingChange('cooling_fee_summer')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="6-9月の追加料金"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="冬季保温料金"
                      value={shippingSettings.heating_fee_winter}
                      onChange={handleShippingChange('heating_fee_winter')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="12-2月の追加料金"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    地域別配送料金
                  </Typography>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => setEditShippingDialog(true)}>
                    編集
                  </Button>
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
                      {shippingRates.map((rate, index) => (
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
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  会社情報（帳票に表示）
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="会社名・屋号"
                      value={documentSettings.company_name}
                      onChange={handleDocumentChange('company_name')}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="住所"
                      value={documentSettings.company_address}
                      onChange={handleDocumentChange('company_address')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="電話番号"
                      value={documentSettings.company_phone}
                      onChange={handleDocumentChange('company_phone')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="メールアドレス"
                      value={documentSettings.company_email}
                      onChange={handleDocumentChange('company_email')}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  振込先口座
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="銀行名"
                      value={documentSettings.bank_name}
                      onChange={handleDocumentChange('bank_name')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="支店名"
                      value={documentSettings.bank_branch}
                      onChange={handleDocumentChange('bank_branch')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="口座種別"
                      value={documentSettings.bank_account_type}
                      onChange={handleDocumentChange('bank_account_type')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="口座番号"
                      value={documentSettings.bank_account_number}
                      onChange={handleDocumentChange('bank_account_number')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="口座名義"
                      value={documentSettings.bank_account_holder}
                      onChange={handleDocumentChange('bank_account_holder')}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  帳票番号設定
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="請求書プレフィックス"
                      value={documentSettings.invoice_prefix}
                      onChange={handleDocumentChange('invoice_prefix')}
                      helperText="例: INV-2025-0001"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="支払通知書プレフィックス"
                      value={documentSettings.payment_notice_prefix}
                      onChange={handleDocumentChange('payment_notice_prefix')}
                      helperText="例: PAY-2025-0001"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="保証書有効日数"
                      value={documentSettings.warranty_validity_days}
                      onChange={handleDocumentChange('warranty_validity_days')}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">日</InputAdornment>,
                      }}
                      helperText="到着後の保証期間"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  自動発行設定
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={documentSettings.auto_generate_invoice}
                        onChange={(e) => setDocumentSettings({ ...documentSettings, auto_generate_invoice: e.target.checked })}
                      />
                    }
                    label="請求書を自動発行する"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={documentSettings.auto_generate_payment_notice}
                        onChange={(e) => setDocumentSettings({ ...documentSettings, auto_generate_payment_notice: e.target.checked })}
                      />
                    }
                    label="支払通知書を自動発行する"
                  />
                </Box>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    自動発行を有効にすると、落札確定時に請求書、入金確認時に支払通知書が自動で生成されます。
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

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

      {/* 配送料金編集ダイアログ */}
      <Dialog open={editShippingDialog} onClose={() => setEditShippingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>地域別配送料金の編集</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            配送料金テーブルは現在のバージョンでは編集できません。今後のアップデートで対応予定です。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditShippingDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
