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
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  ShoppingCart as CartIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';

// Mock データ
const buyerData = {
  id: 1,
  name: '山田一郎',
  nickname: 'やまちゃん',
  email: 'yamada@example.com',
  phone: '090-1111-2222',
  address: '東京都渋谷区xxx 1-2-3',
  postal_code: '150-0001',
  status: 'approved',
  total_purchases: 15,
  total_amount: 380000,
  notes: 'リピーターの優良顧客。迅速な入金対応。',
  created_at: '2025-09-10T10:00:00Z',
};

// 落札履歴
const purchaseHistory = [
  { id: 1, auction: '2025年11月オークション', item: '紅白ラメ 3ペア', price: 35000, seller: '田中養魚場', date: '2025-11-12', status: 'paid' },
  { id: 2, auction: '2025年11月オークション', item: '幹之フルボディ 5匹', price: 28000, seller: 'メダカの佐藤', date: '2025-11-12', status: 'paid' },
  { id: 3, auction: '2025年10月オークション', item: '三色ラメ 2ペア', price: 42000, seller: '鈴木メダカファーム', date: '2025-10-15', status: 'paid' },
  { id: 4, auction: '2025年10月オークション', item: 'オロチ 3匹', price: 18000, seller: '田中養魚場', date: '2025-10-15', status: 'paid' },
];

export default function BuyerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = location.pathname.includes('/edit');

  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState(buyerData);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/admin/buyers/${id}`);
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

  const getPaymentStatusChip = (status: string) => {
    const config = {
      paid: { label: '入金済', color: '#059669', bgcolor: '#ECFDF5' },
      pending: { label: '未入金', color: '#F59E0B', bgcolor: '#FEF3C7' },
      overdue: { label: '未払い', color: '#DC2626', bgcolor: '#FEF2F2' },
    }[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };

    return (
      <Chip
        size="small"
        label={config.label}
        sx={{
          bgcolor: config.bgcolor,
          color: config.color,
          fontWeight: 600,
          fontSize: '0.7rem',
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
            onClick={() => navigate('/admin/buyers')}
          >
            戻る
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {isEditMode ? '買受者情報編集' : '買受者詳細'}
          </Typography>
        </Box>
        {!isEditMode && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/buyers/${id}/edit`)}
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
                    bgcolor: '#EFF6FF',
                    color: '#3B82F6',
                    fontSize: '2rem',
                    mb: 2,
                  }}
                >
                  {formData.name.charAt(0)}
                </Avatar>
                <Typography variant="h5" sx={{ fontWeight: 600, textAlign: 'center' }}>
                  {formData.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  @{formData.nickname}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1 }}>
                  ID: {formData.id}
                </Typography>
                {getStatusChip(formData.status)}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    <CartIcon sx={{ color: '#3B82F6', fontSize: 20 }} />
                    <Typography variant="body2">落札数</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formData.total_purchases}件
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon sx={{ color: '#059669', fontSize: 20 }} />
                    <Typography variant="body2">総購入額</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    ¥{formData.total_amount.toLocaleString()}
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
                  買受者情報
                </Typography>
                <Box component="form" onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="氏名"
                        value={formData.name}
                        onChange={handleChange('name')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="ニックネーム"
                        value={formData.nickname}
                        onChange={handleChange('nickname')}
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
                        <Button onClick={() => navigate(`/admin/buyers/${id}`)}>
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
                    <Tab label="落札履歴" />
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
                            <TableCell>落札品</TableCell>
                            <TableCell>出品者</TableCell>
                            <TableCell align="right">落札価格</TableCell>
                            <TableCell align="center">入金状況</TableCell>
                            <TableCell>日付</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {purchaseHistory.map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell>{item.auction}</TableCell>
                              <TableCell>{item.item}</TableCell>
                              <TableCell>{item.seller}</TableCell>
                              <TableCell align="right">¥{item.price.toLocaleString()}</TableCell>
                              <TableCell align="center">{getPaymentStatusChip(item.status)}</TableCell>
                              <TableCell>{item.date}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
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

