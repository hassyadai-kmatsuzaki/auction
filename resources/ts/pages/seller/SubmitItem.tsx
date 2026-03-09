import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Pets as PetsIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

const steps = ['出品情報', '確認'];

interface AvailableAuction {
  id: number;
  title: string;
  event_date: string;
  status: string;
  upload_deadline: string | null;
}

export default function SubmitItem() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [availableAuctions, setAvailableAuctions] = useState<AvailableAuction[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [formData, setFormData] = useState({
    auction_id: '',
    species_name: '',
    quantity: '',
    quantity_unit: 'fish',
    is_premium: false,
    individual_info: '',
    age_months: '',
  });

  useEffect(() => {
    fetchAvailableAuctions();
  }, []);

  const fetchAvailableAuctions = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get('/api/seller/items/auctions');
      if (response.data.success) {
        setAvailableAuctions(response.data.data.auctions);
      }
    } catch (err) {
      console.error('オークション取得エラー:', err);
      setSnackbar({ open: true, message: 'オークション情報の取得に失敗しました', severity: 'error' });
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (field: string) => (e: any) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // 個体情報をマージ
      const individualInfo = [
        formData.age_months ? `生体月数: ${formData.age_months}` : '',
        formData.individual_info,
      ].filter(Boolean).join('\n');
      
      const response = await axios.post('/api/seller/items', {
        auction_id: parseInt(formData.auction_id),
        species_name: formData.species_name,
        quantity: parseInt(formData.quantity),
        start_price: 0,
        is_premium: formData.is_premium,
        individual_info: individualInfo || null,
        inspection_info: null,
        notes: null,
        unsold_action: 'return', // デフォルト値
      });
      
      if (response.data.success) {
        setSnackbar({ open: true, message: '出品申込を送信しました！管理者の審査をお待ちください。', severity: 'success' });
        setTimeout(() => {
          navigate('/seller/items');
        }, 2000);
      }
    } catch (err: any) {
      console.error('出品申込エラー:', err);
      setSnackbar({ 
        open: true, 
        message: err.response?.data?.message || '出品申込に失敗しました', 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAuction = availableAuctions.find(a => a.id.toString() === formData.auction_id);

  if (fetchLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/seller/dashboard')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            出品申込
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            オークションに出品する生体の情報を入力してください
          </Typography>
        </Box>
      </Box>

      {availableAuctions.length === 0 ? (
        <Alert severity="warning">
          現在、出品可能なオークションがありません。
        </Alert>
      ) : (
        <>
          {/* ステッパー */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stepper activeStep={activeStep}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel
                      sx={{
                        '& .MuiStepLabel-label.Mui-active': { color: '#059669', fontWeight: 600 },
                        '& .MuiStepLabel-label.Mui-completed': { color: '#059669' },
                      }}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          {/* Step 1: 出品情報 */}
          {activeStep === 0 && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PetsIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    出品情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  {/* オークション選択 */}
                  <Grid item xs={12}>
                    <FormControl fullWidth required>
                      <InputLabel>出品するオークション</InputLabel>
                      <Select
                        value={formData.auction_id}
                        label="出品するオークション"
                        onChange={handleChange('auction_id')}
                      >
                        {availableAuctions.map((auction) => (
                          <MenuItem key={auction.id} value={auction.id.toString()}>
                            {auction.title} ({new Date(auction.event_date).toLocaleDateString('ja-JP')})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {selectedAuction && selectedAuction.upload_deadline && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        出品申込締切: {new Date(selectedAuction.upload_deadline).toLocaleString('ja-JP')}
                      </Alert>
                    )}
                  </Grid>

                  {/* 品種名 */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      label="品種名"
                      value={formData.species_name}
                      onChange={handleChange('species_name')}
                      placeholder="例: 紅白ラメ、幹之フルボディ"
                    />
                  </Grid>

                  {/* 数量と単位 */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="数量"
                      value={formData.quantity}
                      onChange={handleChange('quantity')}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>単位</InputLabel>
                      <Select
                        value={formData.quantity_unit}
                        label="単位"
                        onChange={handleChange('quantity_unit')}
                      >
                        <MenuItem value="fish">匹</MenuItem>
                        <MenuItem value="kg">kg</MenuItem>
                        <MenuItem value="bag">袋</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* 生体月数 */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>生体月数</InputLabel>
                      <Select
                        value={formData.age_months}
                        label="生体月数"
                        onChange={handleChange('age_months')}
                      >
                        <MenuItem value="">選択しない</MenuItem>
                        <MenuItem value="2ヶ月未満">2ヶ月未満</MenuItem>
                        <MenuItem value="2~5ヶ月">2~5ヶ月</MenuItem>
                        <MenuItem value="6ヶ月以上">6ヶ月以上</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* プレミアム出品 */}
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.is_premium}
                          onChange={handleChange('is_premium')}
                        />
                      }
                      label="プレミアム出品（個別撮影 +800円）"
                    />
                  </Grid>

                  {/* 個体情報（任意） */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="個体情報（任意）"
                      value={formData.individual_info}
                      onChange={handleChange('individual_info')}
                      placeholder="体長、色、ラメの状態、健康状態など詳しく記入してください"
                      helperText="管理者入力時の参考にいたします"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleNext}
                    disabled={!formData.auction_id || !formData.species_name || !formData.quantity}
                  >
                    確認へ
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Step 2: 確認 */}
          {activeStep === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <CheckCircleIcon sx={{ color: '#059669' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        申込内容の確認
                      </Typography>
                    </Box>

                    <Alert severity="info" sx={{ mb: 3 }}>
                      以下の内容で出品申込を送信します。内容をご確認ください。
                    </Alert>

                    {/* 出品情報 */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#059669' }}>
                        出品情報
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ border: 0, pl: 0, width: '30%', color: 'text.secondary' }}>オークション</TableCell>
                            <TableCell sx={{ border: 0, fontWeight: 500 }}>{selectedAuction?.title}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, pl: 0, color: 'text.secondary' }}>品種名</TableCell>
                            <TableCell sx={{ border: 0, fontWeight: 500 }}>{formData.species_name}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, pl: 0, color: 'text.secondary' }}>数量</TableCell>
                            <TableCell sx={{ border: 0, fontWeight: 500 }}>
                              {formData.quantity}
                              {formData.quantity_unit === 'fish' ? '匹' : 
                               formData.quantity_unit === 'kg' ? 'kg' : '袋'}
                            </TableCell>
                          </TableRow>
                          {formData.age_months && (
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, color: 'text.secondary' }}>生体月数</TableCell>
                              <TableCell sx={{ border: 0, fontWeight: 500 }}>{formData.age_months}</TableCell>
                            </TableRow>
                          )}
                          <TableRow>
                            <TableCell sx={{ border: 0, pl: 0, color: 'text.secondary' }}>プレミアム出品</TableCell>
                            <TableCell sx={{ border: 0, fontWeight: 500 }}>
                              {formData.is_premium ? 'あり（+800円）' : 'なし'}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Paper>

                    {/* 個体情報 */}
                    {formData.individual_info && (
                      <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#3B82F6' }}>
                          個体情報
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {formData.individual_info}
                        </Typography>
                      </Paper>
                    )}

                    <Alert severity="info" sx={{ mb: 3 }}>
                      画像・動画は管理者側で一括撮影いたしますので、アップロードは不要です。
                    </Alert>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Button onClick={handleBack} startIcon={<EditIcon />}>
                        修正する
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckIcon />}
                        onClick={handleSubmit}
                        disabled={loading}
                      >
                        出品申込を送信
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}

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
    </Box>
  );
}
