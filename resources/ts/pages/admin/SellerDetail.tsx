import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Store as StoreIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Pets as PetsIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';

// Mock データ
const sellerData = {
  id: 1,
  name: '田中養魚場',
  representative: '田中太郎',
  email: 'tanaka@example.com',
  phone: '090-1234-5678',
  address: '東京都品川区xxx 1-2-3',
  postal_code: '140-0001',
  bank_name: '三菱UFJ銀行',
  bank_branch: '品川支店',
  bank_account_type: '普通',
  bank_account_number: '1234567',
  bank_account_holder: 'タナカタロウ',
  status: 'approved',
  commission_rate: 10,
  total_items: 45,
  total_sales: 580000,
  notes: '信頼できる出品者です。品質の良いメダカを多数出品。',
  created_at: '2025-08-15T10:00:00Z',
};

// 出品履歴
const itemHistory = [
  { id: 1, auction: '2025年11月オークション', item: '紅白ラメ 3ペア', sold_price: 35000, date: '2025-11-12' },
  { id: 2, auction: '2025年11月オークション', item: '幹之フルボディ 5匹', sold_price: 28000, date: '2025-11-12' },
  { id: 3, auction: '2025年10月オークション', item: '三色ラメ 2ペア', sold_price: 42000, date: '2025-10-15' },
  { id: 4, auction: '2025年10月オークション', item: 'オロチ 3匹', sold_price: 18000, date: '2025-10-15' },
];

export default function SellerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = location.pathname.includes('/edit');

  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState(sellerData);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/admin/sellers/${id}`);
  };

  const getStatusChip = (status: string) => {
    const config = {
      pending: { label: '承認待ち', color: '#F59E0B', bgcolor: '#FEF3C7' },
      approved: { label: '有効', color: '#059669', bgcolor: '#ECFDF5' },
      suspended: { label: '停止中', color: '#DC2626', bgcolor: '#FEF2F2' },
    }[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };

    return (
      <Chip
        label={config.label}
        sx={{
          bgcolor: config.bgcolor,
          color: config.color,
          fontWeight: 600,
        }}
      />
    );
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/sellers')}
          >
            戻る
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {isEditMode ? '出品者情報編集' : '出品者詳細'}
          </Typography>
        </Box>
        {!isEditMode && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/sellers/${id}/edit`)}
          >
            編集
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* 左側：基本情報 */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: '#F0FDF4',
                    color: '#059669',
                    fontSize: '2rem',
                    mb: 2,
                  }}
                >
                  {formData.name.charAt(0)}
                </Avatar>
                <Typography variant="h5" sx={{ fontWeight: 600, textAlign: 'center' }}>
                  {formData.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  ID: {formData.id}
                </Typography>
                {getStatusChip(formData.status)}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <StoreIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      代表者
                    </Typography>
                    <Typography variant="body2">{formData.representative}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      メールアドレス
                    </Typography>
                    <Typography variant="body2">{formData.email}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PhoneIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      電話番号
                    </Typography>
                    <Typography variant="body2">{formData.phone}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <LocationIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      住所
                    </Typography>
                    <Typography variant="body2">〒{formData.postal_code}</Typography>
                    <Typography variant="body2">{formData.address}</Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* 統計 */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                統計情報
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PetsIcon sx={{ color: '#3B82F6', fontSize: 20 }} />
                    <Typography variant="body2">総出品数</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formData.total_items}点
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon sx={{ color: '#059669', fontSize: 20 }} />
                    <Typography variant="body2">総売上</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    ¥{formData.total_sales.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">手数料率</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formData.commission_rate}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 右側：詳細情報 */}
        <Grid item xs={12} lg={8}>
          {isEditMode ? (
            // 編集モード
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  出品者情報
                </Typography>
                <Box component="form" onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="出品者名（屋号）"
                        value={formData.name}
                        onChange={handleChange('name')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="代表者名"
                        value={formData.representative}
                        onChange={handleChange('representative')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        type="email"
                        label="メールアドレス"
                        value={formData.email}
                        onChange={handleChange('email')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="電話番号"
                        value={formData.phone}
                        onChange={handleChange('phone')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        required
                        label="郵便番号"
                        value={formData.postal_code}
                        onChange={handleChange('postal_code')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <TextField
                        fullWidth
                        required
                        label="住所"
                        value={formData.address}
                        onChange={handleChange('address')}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
                        振込先口座情報
                      </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="銀行名"
                        value={formData.bank_name}
                        onChange={handleChange('bank_name')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="支店名"
                        value={formData.bank_branch}
                        onChange={handleChange('bank_branch')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="口座種別"
                        value={formData.bank_account_type}
                        onChange={handleChange('bank_account_type')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="口座番号"
                        value={formData.bank_account_number}
                        onChange={handleChange('bank_account_number')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="口座名義"
                        value={formData.bank_account_holder}
                        onChange={handleChange('bank_account_holder')}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
                        手数料設定
                      </Typography>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="手数料率"
                        value={formData.commission_rate}
                        onChange={handleChange('commission_rate')}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="メモ"
                        value={formData.notes}
                        onChange={handleChange('notes')}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => navigate(`/admin/sellers/${id}`)}>
                          キャンセル
                        </Button>
                        <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
                          保存
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          ) : (
            // 閲覧モード
            <>
              <Card sx={{ mb: 3 }}>
                <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab label="詳細情報" />
                    <Tab label="出品履歴" />
                    <Tab label="振込先情報" />
                  </Tabs>
                </Box>

                <CardContent sx={{ p: 3 }}>
                  {tabValue === 0 && (
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          メモ
                        </Typography>
                        <Typography variant="body2">
                          {formData.notes || '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          登録日
                        </Typography>
                        <Typography variant="body2">
                          {new Date(formData.created_at).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Typography>
                      </Grid>
                    </Grid>
                  )}

                  {tabValue === 1 && (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>オークション</TableCell>
                            <TableCell>出品物</TableCell>
                            <TableCell align="right">落札価格</TableCell>
                            <TableCell>日付</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {itemHistory.map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell>{item.auction}</TableCell>
                              <TableCell>{item.item}</TableCell>
                              <TableCell align="right">¥{item.sold_price.toLocaleString()}</TableCell>
                              <TableCell>{item.date}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {tabValue === 2 && (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          銀行名
                        </Typography>
                        <Typography variant="body2">{formData.bank_name}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          支店名
                        </Typography>
                        <Typography variant="body2">{formData.bank_branch}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          口座種別
                        </Typography>
                        <Typography variant="body2">{formData.bank_account_type}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          口座番号
                        </Typography>
                        <Typography variant="body2">{formData.bank_account_number}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          口座名義
                        </Typography>
                        <Typography variant="body2">{formData.bank_account_holder}</Typography>
                      </Grid>
                    </Grid>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

