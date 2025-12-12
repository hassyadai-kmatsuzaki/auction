import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  InputAdornment,
  Alert,
  FormHelperText,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

export default function AuctionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    event_date: '',
    start_time: '10:00',
    description: '',
    commission_rate: '10',
    buyer_fee_rate: '5',
    min_commission: '500',
    notes: '',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/admin/auctions');
  };

  // 手数料の計算例を表示
  const calculateCommissionExample = (price: number) => {
    const commission = Math.max(
      price * (parseFloat(formData.commission_rate) / 100),
      parseFloat(formData.min_commission) || 0
    );
    return commission;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/auctions')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {isEdit ? 'オークション編集' : 'オークション新規作成'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            オークションの基本情報と手数料を設定します
          </Typography>
        </Box>
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* 基本情報 */}
          <Grid item xs={12} lg={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <EventIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    基本情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      label="オークション名"
                      value={formData.title}
                      onChange={handleChange('title')}
                      placeholder="2025年12月オークション"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="date"
                      label="開催日"
                      value={formData.event_date}
                      onChange={handleChange('event_date')}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="time"
                      label="開始時刻"
                      value={formData.start_time}
                      onChange={handleChange('start_time')}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="説明"
                      value={formData.description}
                      onChange={handleChange('description')}
                      multiline
                      rows={4}
                      placeholder="オークションの説明を入力..."
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* 手数料設定 */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MoneyIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    出品手数料設定
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  この開催回に適用される手数料率を設定します。出品者ごとの個別設定がある場合は、そちらが優先されます。
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    手数料は落札価格に対して計算されます。最低手数料を下回る場合は、最低手数料が適用されます。
                  </Typography>
                </Alert>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      label="出品手数料率"
                      value={formData.commission_rate}
                      onChange={handleChange('commission_rate')}
                      type="number"
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                    />
                    <FormHelperText>出品者から徴収する手数料率</FormHelperText>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="買受者手数料率"
                      value={formData.buyer_fee_rate}
                      onChange={handleChange('buyer_fee_rate')}
                      type="number"
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                    />
                    <FormHelperText>買受者から徴収する手数料率</FormHelperText>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="最低手数料"
                      value={formData.min_commission}
                      onChange={handleChange('min_commission')}
                      type="number"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      inputProps={{ min: 0 }}
                    />
                    <FormHelperText>1点あたりの最低手数料額</FormHelperText>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* 手数料計算例 */}
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  手数料計算例
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[5000, 10000, 30000, 50000].map((price) => (
                    <Box
                      key={price}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 1.5,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2">
                        落札価格 ¥{price.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669' }}>
                        手数料 ¥{calculateCommissionExample(price).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* サイドバー */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ position: 'sticky', top: 80 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  アクション
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<SaveIcon />}
                    fullWidth
                  >
                    {isEdit ? '変更を保存' : 'オークションを作成'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/auctions')}
                    fullWidth
                  >
                    キャンセル
                  </Button>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <InfoIcon sx={{ color: 'text.secondary', fontSize: 18, mt: 0.2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      手数料について
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      ここで設定した手数料率は、このオークション開催回のデフォルト値となります。
                      出品者管理画面で個別に設定された手数料率がある場合は、そちらが優先されます。
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 3 }} />

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="管理者メモ"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  placeholder="内部向けのメモを入力..."
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
