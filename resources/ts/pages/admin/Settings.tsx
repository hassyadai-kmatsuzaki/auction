import React, { useState } from 'react';
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
} from '@mui/icons-material';

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

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);
  
  // システム設定
  const [systemSettings, setSystemSettings] = useState({
    site_name: 'メダカライブオークション',
    contact_email: 'info@example.com',
    contact_phone: '03-1234-5678',
    business_hours: '平日 10:00-18:00',
  });

  // オークション設定
  const [auctionSettings, setAuctionSettings] = useState({
    price_increment_rate: '10',
    price_increment_min: '50',
    countdown_seconds: '3',
    max_lanes: '6',
    auto_extend_seconds: '10',
  });

  // 料金設定
  const [feeSettings, setFeeSettings] = useState({
    // 出品者向け
    seller_registration_fee: '3000',
    seller_annual_fee: '0',
    base_listing_fee: '500',
    premium_listing_fee: '800',
    seller_commission_rate: '10',
    seller_commission_min: '500',
    // 買受者向け
    buyer_registration_fee: '0',
    buyer_commission_rate: '5',
    buyer_commission_min: '300',
  });

  // 配送・梱包料金
  const [shippingSettings, setShippingSettings] = useState({
    packaging_fee: '500',
    handling_fee: '300',
    insurance_fee_rate: '3',
    cooling_fee_summer: '300',
    heating_fee_winter: '300',
  });

  // 配送料金テーブル
  const [shippingRates, setShippingRates] = useState([
    { region: '関東', size_60: '800', size_80: '1000', size_100: '1200' },
    { region: '関西', size_60: '900', size_80: '1100', size_100: '1300' },
    { region: '北海道', size_60: '1500', size_80: '1800', size_100: '2100' },
    { region: '沖縄', size_60: '1800', size_80: '2200', size_100: '2600' },
    { region: 'その他', size_60: '1000', size_80: '1200', size_100: '1500' },
  ]);

  // 帳票設定
  const [documentSettings, setDocumentSettings] = useState({
    company_name: '株式会社メダカオークション',
    company_address: '東京都渋谷区xxx 1-2-3',
    company_phone: '03-1234-5678',
    company_email: 'info@example.com',
    bank_name: '三菱UFJ銀行',
    bank_branch: '渋谷支店',
    bank_account_type: '普通',
    bank_account_number: '1234567',
    bank_account_holder: 'カ）メダカオークション',
    invoice_prefix: 'INV-',
    payment_notice_prefix: 'PAY-',
    warranty_validity_days: '14',
    auto_generate_invoice: true,
    auto_generate_payment_notice: true,
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('設定を保存しました');
  };

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
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
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
              入札ルール
            </Typography>
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
                  label="最大レーン数"
                  value={auctionSettings.max_lanes}
                  onChange={handleAuctionChange('max_lanes')}
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
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* 料金設定 */}
      <TabPanel value={tabValue} index={2}>
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
                      value={feeSettings.premium_listing_fee}
                      onChange={handleFeeChange('premium_listing_fee')}
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
                      value={feeSettings.seller_commission_rate}
                      onChange={handleFeeChange('seller_commission_rate')}
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
                    地域別配送料金（ヤマト運輸）
                  </Typography>
                  <Button size="small" startIcon={<EditIcon />}>
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
                          <TableCell align="right">¥{parseInt(rate.size_60).toLocaleString()}</TableCell>
                          <TableCell align="right">¥{parseInt(rate.size_80).toLocaleString()}</TableCell>
                          <TableCell align="right">¥{parseInt(rate.size_100).toLocaleString()}</TableCell>
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
    </Box>
  );
}
