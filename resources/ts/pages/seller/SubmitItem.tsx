import React, { useState } from 'react';
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

const steps = ['基本情報', '個体情報', '確認'];

// Mock オークション
const availableAuctions = [
  { id: 1, title: '2025年12月オークション', date: '2025-12-10', deadline: '2025-12-05' },
  { id: 2, title: '2025年クリスマス特別', date: '2025-12-24', deadline: '2025-12-19' },
];

export default function SubmitItem() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    auction_id: '',
    species_name: '',
    quantity: '',
    quantity_unit: 'fish', // fish or pair
    start_price: '',
    is_premium: false,
    individual_info: '',
    breeding_info: '',
    notes: '',
    has_pedigree: false,
    is_original_breed: false,
    fixed_rate: '',
    expression: '',
  });

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

  const handleSubmit = () => {
    // Mock: 実際はAPIを呼び出す
    alert('出品申込を送信しました');
    navigate('/seller/items');
  };

  const selectedAuction = availableAuctions.find(a => a.id.toString() === formData.auction_id);

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

      {/* ステッパー */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Step 1: 基本情報 */}
      {activeStep === 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              基本情報
            </Typography>

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
                        {auction.title} ({new Date(auction.date).toLocaleDateString('ja-JP')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedAuction && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    出品申込締切: {new Date(selectedAuction.deadline).toLocaleDateString('ja-JP')}
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
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleNext}
                disabled={!formData.auction_id || !formData.species_name || !formData.quantity}
              >
                次へ
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 個体情報 */}
      {activeStep === 1 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              個体情報
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={4}
                  label="個体情報・特徴"
                  value={formData.individual_info}
                  onChange={handleChange('individual_info')}
                  placeholder="体長、色、ラメの状態、健康状態など詳しく記入してください"
                  helperText="買受者への説明として使用されます"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="繁殖情報"
                  value={formData.breeding_info}
                  onChange={handleChange('breeding_info')}
                  placeholder="親魚の情報、世代（F1, F2など）、産卵時期など"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
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

              {formData.is_original_breed && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="固定率"
                      value={formData.fixed_rate}
                      onChange={handleChange('fixed_rate')}
                      placeholder="例: 80%"
                      helperText="品種の固定率（任意）"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="表現・特徴"
                      value={formData.expression}
                      onChange={handleChange('expression')}
                      placeholder="例: 体外光＋青ラメ"
                      helperText="品種の特徴的な表現"
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="その他備考"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  placeholder="発送対応、死着保証、まじり有無、生後○ヶ月など"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleBack}>
                戻る
              </Button>
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
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              申込内容の確認
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              以下の内容で出品申込を送信します。内容をご確認ください。
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>オークション</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                  {selectedAuction?.title}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>品種名</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                  {formData.species_name}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>数量</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                  {formData.quantity}{formData.quantity_unit === 'fish' ? '匹' : 'ペア'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>希望開始価格</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                  ¥{parseInt(formData.start_price || '0').toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>個体情報</Typography>
                <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                  {formData.individual_info}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>オプション</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  {formData.is_premium && <Chip label="プレミアム出品" color="warning" size="small" />}
                  {formData.has_pedigree && <Chip label="血統書あり" color="primary" size="small" />}
                  {formData.is_original_breed && <Chip label="自社品種" color="success" size="small" />}
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>
                戻る
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                onClick={handleSubmit}
              >
                出品申込を送信
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

