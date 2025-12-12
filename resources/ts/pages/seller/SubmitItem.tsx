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
  Avatar,
  IconButton,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Upload as UploadIcon,
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  AutoAwesome as AIIcon,
  Pets as PetsIcon,
  Info as InfoIcon,
  Videocam as VideoIcon,
  Image as ImageIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

const steps = ['基本情報', '画像・動画', '個体情報', '確認'];

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
    quantity_unit: 'fish',
    start_price: '',
    is_premium: false,
    individual_info: '',
    breeding_info: '',
    notes: '',
    has_pedigree: false,
    is_original_breed: false,
    fixed_rate: '',
    expression: '',
    body_length: '',
    age_months: '',
    health_status: 'good',
    color_description: '',
    pattern_description: '',
  });

  // 画像・動画アップロード
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  const [topViewVideo, setTopViewVideo] = useState<File | null>(null);
  const [sideViewVideo, setSideViewVideo] = useState<File | null>(null);

  // AI分析
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    species: string;
    subtype: string;
    confidence: number;
    features: {
      bodyShape: { score: number; description: string };
      color: { score: number; description: string };
      pattern: { score: number; description: string };
    };
    estimatedPrice: { min: number; max: number };
  } | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const MAX_IMAGES = 20;

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
    alert('出品申込を送信しました');
    navigate('/seller/dashboard');
  };

  // 画像アップロード
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = MAX_IMAGES - uploadedImages.length;
    const filesToAdd = Math.min(files.length, remainingSlots);

    for (let i = 0; i < filesToAdd; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newImages.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }
    setUploadedImages([...uploadedImages, ...newImages]);
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...uploadedImages];
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    setUploadedImages(newImages);
  };

  // AI画像分析
  const handleAIAnalysis = () => {
    if (uploadedImages.length === 0) {
      alert('画像をアップロードしてください');
      return;
    }

    setIsAnalyzing(true);
    setShowAIDialog(true);

    // Mock: AI分析処理
    setTimeout(() => {
      setAiAnalysisResult({
        species: '幹之メダカ',
        subtype: 'フルボディ',
        confidence: 94.5,
        features: {
          bodyShape: { score: 92, description: '体型良好、背骨のラインが美しい' },
          color: { score: 96, description: '背中の光沢が強い、青白い輝き' },
          pattern: { score: 91, description: 'フルボディタイプ、頭部から尾部まで光' },
        },
        estimatedPrice: { min: 1200, max: 2000 },
      });
      setIsAnalyzing(false);
    }, 2500);
  };

  // AI分析結果を適用
  const handleApplyAIResult = () => {
    if (aiAnalysisResult) {
      setFormData({
        ...formData,
        species_name: `${aiAnalysisResult.species} ${aiAnalysisResult.subtype}`,
        color_description: aiAnalysisResult.features.color.description,
        pattern_description: aiAnalysisResult.features.pattern.description,
        individual_info: `【AI分析結果】\n体型: ${aiAnalysisResult.features.bodyShape.description}\n色彩: ${aiAnalysisResult.features.color.description}\n模様: ${aiAnalysisResult.features.pattern.description}`,
        start_price: aiAnalysisResult.estimatedPrice.min.toString(),
      });
      setShowAIDialog(false);
    }
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
            {steps.map((label, index) => (
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
                  helperText="AI分析で自動入力も可能です"
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
                次へ：画像・動画
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 画像・動画 */}
      {activeStep === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ImageIcon sx={{ color: '#059669' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      画像アップロード
                    </Typography>
                    <Chip
                      label={`${uploadedImages.length} / ${MAX_IMAGES}`}
                      size="small"
                      color={uploadedImages.length >= MAX_IMAGES ? 'error' : 'default'}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={isAnalyzing ? <CircularProgress size={18} color="inherit" /> : <AIIcon />}
                    onClick={handleAIAnalysis}
                    disabled={uploadedImages.length === 0 || isAnalyzing}
                    sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
                  >
                    AI画像分析
                  </Button>
                </Box>

                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                    p: 4,
                    mb: 3,
                    bgcolor: 'grey.50',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 180,
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.light',
                    },
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleImageUpload}
                    disabled={uploadedImages.length >= MAX_IMAGES}
                  />
                  <CameraIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" sx={{ fontWeight: 500, mb: 1, textAlign: 'center' }}>
                    クリックまたはドラッグ＆ドロップ
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    JPG, PNG形式 / 最大{MAX_IMAGES}枚まで
                  </Typography>
                </Box>

                {/* アップロード済み画像グリッド */}
                {uploadedImages.length > 0 && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 1.5,
                      mb: 3,
                    }}
                  >
                    {uploadedImages.map((image, index) => (
                      <Box
                        key={index}
                        sx={{
                          position: 'relative',
                          aspectRatio: '1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '2px solid',
                          borderColor: index === 0 ? 'primary.main' : 'grey.200',
                        }}
                      >
                        <Box
                          component="img"
                          src={image.preview}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveImage(index)}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            p: 0.5,
                            '&:hover': { bgcolor: 'error.main' },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        {index === 0 && (
                          <Chip
                            label="メイン"
                            size="small"
                            color="primary"
                            sx={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              height: 20,
                              fontSize: '0.65rem',
                            }}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                )}

                <Divider sx={{ my: 3 }} />

                {/* 動画アップロード */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <VideoIcon sx={{ color: '#059669' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    動画アップロード（任意）
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        border: '1px dashed',
                        borderColor: topViewVideo ? 'success.main' : 'grey.300',
                        bgcolor: topViewVideo ? 'success.light' : 'grey.50',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        上見動画（30秒以内）
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={topViewVideo ? <CheckCircleIcon /> : <UploadIcon />}
                        component="label"
                        color={topViewVideo ? 'success' : 'primary'}
                        fullWidth
                      >
                        {topViewVideo ? topViewVideo.name : '動画を選択'}
                        <input
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(e) => e.target.files && setTopViewVideo(e.target.files[0])}
                        />
                      </Button>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        border: '1px dashed',
                        borderColor: sideViewVideo ? 'success.main' : 'grey.300',
                        bgcolor: sideViewVideo ? 'success.light' : 'grey.50',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        横見動画（30秒以内）
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={sideViewVideo ? <CheckCircleIcon /> : <UploadIcon />}
                        component="label"
                        color={sideViewVideo ? 'success' : 'primary'}
                        fullWidth
                      >
                        {sideViewVideo ? sideViewVideo.name : '動画を選択'}
                        <input
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(e) => e.target.files && setSideViewVideo(e.target.files[0])}
                        />
                      </Button>
                    </Paper>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Button onClick={handleBack}>
                    戻る
                  </Button>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleNext}
                    disabled={uploadedImages.length === 0}
                  >
                    次へ：個体情報
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* AI分析結果サイドバー */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ position: 'sticky', top: 80 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#7C3AED', width: 36, height: 36 }}>
                    <AIIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    AI画像分析
                  </Typography>
                </Box>

                {aiAnalysisResult ? (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      分析完了！結果を個体情報に反映できます
                    </Alert>

                    <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        判定品種
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {aiAnalysisResult.species}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        サブタイプ: {aiAnalysisResult.subtype}
                      </Typography>
                      <Chip
                        label={`信頼度 ${aiAnalysisResult.confidence}%`}
                        size="small"
                        color="success"
                        sx={{ mt: 1 }}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        推奨開始価格
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        ¥{aiAnalysisResult.estimatedPrice.min.toLocaleString()} 〜 ¥{aiAnalysisResult.estimatedPrice.max.toLocaleString()}
                      </Typography>
                    </Box>

                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleApplyAIResult}
                      sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
                    >
                      分析結果を適用
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CameraIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      画像をアップロードしてAI分析ボタンを押すと、品種を自動判定します
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Step 3: 個体情報 */}
      {activeStep === 2 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <InfoIcon sx={{ color: '#3B82F6' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                個体情報
              </Typography>
              {aiAnalysisResult && (
                <Chip label="AI分析済み" size="small" sx={{ bgcolor: '#EDE9FE', color: '#7C3AED' }} />
              )}
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
                  helperText="色合いや輝きの特徴を記入"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="模様の特徴"
                  value={formData.pattern_description}
                  onChange={handleChange('pattern_description')}
                  placeholder="例: フルボディタイプ、頭部から尾部まで光"
                  helperText="模様やラメの分布などを記入"
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
                  placeholder="発送対応、死着保証、まじり有無など"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
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

      {/* Step 4: 確認 */}
      {activeStep === 3 && (
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

                {/* メディア */}
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    アップロードメディア
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip icon={<ImageIcon />} label={`画像 ${uploadedImages.length}枚`} size="small" />
                    {topViewVideo && <Chip icon={<VideoIcon />} label="上見動画" size="small" color="success" />}
                    {sideViewVideo && <Chip icon={<VideoIcon />} label="横見動画" size="small" color="success" />}
                  </Box>
                </Paper>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={handleBack} startIcon={<EditIcon />}>
                    修正する
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<CheckIcon />}
                    onClick={handleSubmit}
                  >
                    出品申込を送信
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 画像プレビュー */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ position: 'sticky', top: 80 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  アップロード画像
                </Typography>
                {uploadedImages.length > 0 ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 1,
                    }}
                  >
                    {uploadedImages.slice(0, 4).map((image, index) => (
                      <Box
                        key={index}
                        sx={{
                          aspectRatio: '1',
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Box
                          component="img"
                          src={image.preview}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    画像がありません
                  </Typography>
                )}
                {uploadedImages.length > 4 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                    他 {uploadedImages.length - 4}枚
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* AI分析ダイアログ */}
      <Dialog open={showAIDialog} onClose={() => !isAnalyzing && setShowAIDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: '#7C3AED' }}>
              <AIIcon />
            </Avatar>
            <Typography variant="h6">AI画像分析</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {isAnalyzing ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={60} sx={{ color: '#7C3AED', mb: 2 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                画像を解析中...
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                メダカの品種・特徴を自動判定しています
              </Typography>
              <LinearProgress sx={{ mt: 3, mx: 'auto', maxWidth: 300 }} />
            </Box>
          ) : aiAnalysisResult ? (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                分析が完了しました！
              </Alert>

              <Box sx={{ mb: 3, p: 3, bgcolor: 'grey.50', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  判定品種
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {aiAnalysisResult.species}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  {aiAnalysisResult.subtype}
                </Typography>
                <Chip
                  label={`信頼度 ${aiAnalysisResult.confidence}%`}
                  color="success"
                  sx={{ mt: 2 }}
                />
              </Box>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                特徴分析
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {['bodyShape', 'color', 'pattern'].map((key) => {
                  const feature = aiAnalysisResult.features[key as keyof typeof aiAnalysisResult.features];
                  const label = key === 'bodyShape' ? '体型' : key === 'color' ? '色彩' : '模様';
                  return (
                    <Grid item xs={12} key={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ minWidth: 50 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={feature.score}
                            sx={{ height: 8, borderRadius: 4, bgcolor: 'grey.200' }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 40 }}>
                          {feature.score}点
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 7 }}>
                        {feature.description}
                      </Typography>
                    </Grid>
                  );
                })}
              </Grid>

              <Box sx={{ p: 2, bgcolor: '#F0FDF4', borderRadius: 2, mb: 2, border: '1px solid #BBF7D0' }}>
                <Typography variant="body2" sx={{ color: '#059669', mb: 0.5, fontWeight: 500 }}>
                  推奨開始価格
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#047857' }}>
                  ¥{aiAnalysisResult.estimatedPrice.min.toLocaleString()} 〜 ¥{aiAnalysisResult.estimatedPrice.max.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAIDialog(false)} disabled={isAnalyzing}>
            閉じる
          </Button>
          {aiAnalysisResult && (
            <Button
              variant="contained"
              onClick={handleApplyAIResult}
              sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
            >
              結果を適用する
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
