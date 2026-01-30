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

const steps = ['基本情報', '個体情報', '確認'];

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
    start_price: '',
    estimated_price: '',
    is_premium: false,
    individual_info: '',
    inspection_info: '',
    notes: '',
    unsold_action: 'return',
    has_pedigree: false,
    is_original_breed: false,
    body_length: '',
    age_months: '',
    health_status: 'good',
    color_description: '',
    pattern_description: '',
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
        formData.body_length ? `体長: ${formData.body_length}` : '',
        formData.age_months ? `生後: ${formData.age_months}` : '',
        formData.health_status ? `健康状態: ${formData.health_status === 'excellent' ? '非常に良好' : formData.health_status === 'good' ? '良好' : '普通'}` : '',
        formData.color_description ? `色彩: ${formData.color_description}` : '',
        formData.pattern_description ? `模様: ${formData.pattern_description}` : '',
        formData.individual_info,
      ].filter(Boolean).join('\n');
      
      // 審査情報をマージ
      const inspectionInfo = [
        formData.has_pedigree ? '血統書あり' : '',
        formData.is_original_breed ? '自社オリジナル品種' : '',
      ].filter(Boolean).join(', ');
      
      const quantity = formData.quantity_unit === 'pair' 
        ? parseInt(formData.quantity) * 2 
        : parseInt(formData.quantity);
      
      const response = await axios.post('/api/seller/items', {
        auction_id: parseInt(formData.auction_id),
        species_name: formData.species_name,
        quantity: quantity,
        start_price: parseFloat(formData.start_price),
        estimated_price: formData.estimated_price ? parseFloat(formData.estimated_price) : null,
        is_premium: formData.is_premium,
        individual_info: individualInfo,
        inspection_info: inspectionInfo || null,
        notes: formData.notes || null,
        unsold_action: formData.unsold_action,
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

          {/* Step 1: 基本情報 */}
          {activeStep === 0 && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PetsIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    基本情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
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

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="品種名"
                      value={formData.species_name}
                      onChange={handleChange('species_name')}
                      placeholder="例: 紅白ラメ、幹之フルボディ"
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="数量"
                      value={formData.quantity}
                      onChange={handleChange('quantity')}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>単位</InputLabel>
                      <Select
                        value={formData.quantity_unit}
                        label="単位"
                        onChange={handleChange('quantity_unit')}
                      >
                        <MenuItem value="fish">匹</MenuItem>
                        <MenuItem value="pair">ペア</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="希望開始価格"
                      value={formData.start_price}
                      onChange={handleChange('start_price')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="最終的な開始価格は審査後に決定されます"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="落札想定価格（任意）"
                      value={formData.estimated_price}
                      onChange={handleChange('estimated_price')}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                      }}
                      helperText="目安として入力してください"
                    />
                  </Grid>

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

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>未落札時の対応</InputLabel>
                      <Select
                        value={formData.unsold_action}
                        label="未落札時の対応"
                        onChange={handleChange('unsold_action')}
                      >
                        <MenuItem value="return">返却</MenuItem>
                        <MenuItem value="free_pickup">無料引取</MenuItem>
                        <MenuItem value="relist">次回再出品</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleNext}
                    disabled={!formData.auction_id || !formData.species_name || !formData.quantity || !formData.start_price}
                  >
                    次へ：個体情報
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Step 2: 個体情報 */}
          {activeStep === 1 && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <InfoIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    個体情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="体長"
                      value={formData.body_length}
                      onChange={handleChange('body_length')}
                      placeholder="例: 約3cm"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="生後月数"
                      value={formData.age_months}
                      onChange={handleChange('age_months')}
                      placeholder="例: 約6ヶ月"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>健康状態</InputLabel>
                      <Select
                        value={formData.health_status}
                        label="健康状態"
                        onChange={handleChange('health_status')}
                      >
                        <MenuItem value="excellent">非常に良好</MenuItem>
                        <MenuItem value="good">良好</MenuItem>
                        <MenuItem value="normal">普通</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="色彩の特徴"
                      value={formData.color_description}
                      onChange={handleChange('color_description')}
                      placeholder="例: 背中の光沢が強い、青白い輝き"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="模様の特徴"
                      value={formData.pattern_description}
                      onChange={handleChange('pattern_description')}
                      placeholder="例: フルボディタイプ、頭部から尾部まで光"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      multiline
                      rows={4}
                      label="個体情報・詳細説明"
                      value={formData.individual_info}
                      onChange={handleChange('individual_info')}
                      placeholder="体長、色、ラメの状態、健康状態など詳しく記入してください"
                      helperText="管理者入力時の参考にいたします"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, mt: 2 }}>
                      保証オプション
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.has_pedigree}
                          onChange={handleChange('has_pedigree')}
                        />
                      }
                      label="血統書あり"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.is_original_breed}
                          onChange={handleChange('is_original_breed')}
                        />
                      }
                      label="自社オリジナル品種"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="その他備考"
                      value={formData.notes}
                      onChange={handleChange('notes')}
                      placeholder="発送対応、死着保証、まじり有無など"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Button onClick={handleBack}>戻る</Button>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleNext}
                    disabled={!formData.individual_info}
                  >
                    確認へ
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Step 3: 確認 */}
          {activeStep === 2 && (
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

                    {/* 基本情報 */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#059669' }}>
                        基本情報
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
                              {formData.quantity}{formData.quantity_unit === 'fish' ? '匹' : 'ペア'}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, pl: 0, color: 'text.secondary' }}>希望開始価格</TableCell>
                            <TableCell sx={{ border: 0, fontWeight: 500 }}>
                              ¥{parseInt(formData.start_price || '0').toLocaleString()}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ border: 0, pl: 0, color: 'text.secondary' }}>未落札時の対応</TableCell>
                            <TableCell sx={{ border: 0, fontWeight: 500 }}>
                              {formData.unsold_action === 'return' ? '返却' : 
                               formData.unsold_action === 'free_pickup' ? '無料引取' : '次回再出品'}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Paper>

                    {/* 個体情報 */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#3B82F6' }}>
                        個体情報
                      </Typography>
                      {formData.body_length && (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>体長:</strong> {formData.body_length}
                        </Typography>
                      )}
                      {formData.age_months && (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>生後:</strong> {formData.age_months}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>健康状態:</strong> {
                          formData.health_status === 'excellent' ? '非常に良好' :
                          formData.health_status === 'good' ? '良好' : '普通'
                        }
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {formData.individual_info}
                      </Typography>
                    </Paper>

                    {/* オプション */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                        オプション
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {formData.is_premium && <Chip label="プレミアム出品" color="warning" size="small" />}
                        {formData.has_pedigree && <Chip label="血統書あり" color="primary" size="small" />}
                        {formData.is_original_breed && <Chip label="自社品種" color="success" size="small" />}
                        {!formData.is_premium && !formData.has_pedigree && !formData.is_original_breed && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>なし</Typography>
                        )}
                      </Box>
                    </Paper>

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
