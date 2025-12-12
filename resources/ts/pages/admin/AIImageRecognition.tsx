import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  CameraAlt as CameraIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Info as InfoIcon,
  AutoAwesome as AutoAwesomeIcon,
  Palette as PaletteIcon,
  Straighten as StraightenIcon,
  Pattern as PatternIcon,
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
} from '@mui/icons-material';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

// Mock 解析結果データ
const mockAnalysisResults = [
  {
    id: 1,
    imageName: 'medaka_001.jpg',
    uploadedAt: '2025-12-12 10:30',
    status: 'completed',
    result: {
      species: '幹之メダカ',
      subtype: 'フルボディ',
      confidence: 96.5,
      features: {
        bodyShape: { score: 95, description: '体型良好、背骨のラインが美しい' },
        color: { score: 98, description: '背中の光沢が強い、青白い輝き' },
        pattern: { score: 94, description: 'フルボディタイプ、頭部から尾部まで光' },
        fins: { score: 92, description: 'ヒレの形状正常、損傷なし' },
      },
      qualityScore: 94.8,
      estimatedPrice: { min: 1200, max: 1800 },
    },
  },
  {
    id: 2,
    imageName: 'medaka_002.jpg',
    uploadedAt: '2025-12-12 10:25',
    status: 'completed',
    result: {
      species: '三色ラメメダカ',
      subtype: '透明鱗',
      confidence: 91.2,
      features: {
        bodyShape: { score: 88, description: '体型やや細め' },
        color: { score: 94, description: '赤・黒・白のバランス良好' },
        pattern: { score: 92, description: 'ラメの分布均一' },
        fins: { score: 90, description: 'ヒレ正常' },
      },
      qualityScore: 91.0,
      estimatedPrice: { min: 2500, max: 4000 },
    },
  },
  {
    id: 3,
    imageName: 'medaka_003.jpg',
    uploadedAt: '2025-12-12 10:20',
    status: 'processing',
    result: null,
  },
  {
    id: 4,
    imageName: 'medaka_004.jpg',
    uploadedAt: '2025-12-12 10:15',
    status: 'error',
    result: null,
    error: '画像が不鮮明です。別の画像をお試しください。',
  },
];

// 特徴データ（レーダーチャート用）
const getFeatureData = (features: any) => [
  { subject: '体型', value: features.bodyShape.score, fullMark: 100 },
  { subject: '色彩', value: features.color.score, fullMark: 100 },
  { subject: '模様', value: features.pattern.score, fullMark: 100 },
  { subject: 'ヒレ', value: features.fins.score, fullMark: 100 },
];

export default function AIImageRecognition() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedResult, setSelectedResult] = useState<typeof mockAnalysisResults[0] | null>(mockAnalysisResults[0]);
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: { file: File; preview: string }[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
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

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    // Mock: 解析処理
    setTimeout(() => {
      setIsAnalyzing(false);
      alert('解析が完了しました（デモ）');
    }, 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'processing':
        return <CircularProgress size={18} />;
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />;
      default:
        return <PendingIcon sx={{ color: 'warning.main', fontSize: 20 }} />;
    }
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/ai-analytics')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            AI画像認識
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            メダカの画像から品種・特徴を自動解析します
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* 左側: アップロード・解析履歴 */}
        <Grid item xs={12} lg={5}>
          {/* アップロードエリア */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              画像アップロード
            </Typography>

            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                mb: 2,
                bgcolor: 'grey.50',
                cursor: 'pointer',
                transition: 'all 0.2s',
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
              />
              <CameraIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                クリックまたはドラッグ＆ドロップ
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                JPG, PNG形式 / 最大5枚まで同時アップロード可能
              </Typography>
            </Box>

            {/* アップロードされた画像 */}
            {uploadedImages.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  アップロード済み画像 ({uploadedImages.length}枚)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {uploadedImages.map((image, index) => (
                    <Box
                      key={index}
                      sx={{
                        position: 'relative',
                        width: 80,
                        height: 80,
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
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(index)}
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          bgcolor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          p: 0.25,
                          '&:hover': { bgcolor: 'error.main' },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              startIcon={isAnalyzing ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              disabled={uploadedImages.length === 0 || isAnalyzing}
              onClick={handleAnalyze}
            >
              {isAnalyzing ? '解析中...' : 'AI解析を開始'}
            </Button>
          </Paper>

          {/* 解析履歴 */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              解析履歴
            </Typography>

            <TextField
              fullWidth
              size="small"
              placeholder="画像名で検索..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {mockAnalysisResults.map((result) => (
                <Box
                  key={result.id}
                  onClick={() => result.status === 'completed' && setSelectedResult(result)}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: selectedResult?.id === result.id ? 'primary.main' : 'grey.200',
                    bgcolor: selectedResult?.id === result.id ? 'primary.light' : 'background.paper',
                    cursor: result.status === 'completed' ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    '&:hover': result.status === 'completed' ? {
                      borderColor: 'primary.main',
                    } : {},
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 48, height: 48, bgcolor: 'grey.100' }}>
                      <CameraIcon sx={{ color: 'grey.500' }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2">{result.imageName}</Typography>
                        {getStatusIcon(result.status)}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {result.uploadedAt}
                      </Typography>
                      {result.status === 'completed' && result.result && (
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500 }}>
                          {result.result.species} - {result.result.confidence}%
                        </Typography>
                      )}
                      {result.status === 'error' && (
                        <Typography variant="caption" sx={{ color: 'error.main' }}>
                          {result.error}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* 右側: 解析結果詳細 */}
        <Grid item xs={12} lg={7}>
          {selectedResult && selectedResult.result ? (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {selectedResult.result.species}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    サブタイプ: {selectedResult.result.subtype}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    label={`信頼度 ${selectedResult.result.confidence}%`}
                    color={selectedResult.result.confidence >= 95 ? 'success' : selectedResult.result.confidence >= 90 ? 'warning' : 'error'}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* 品質スコア */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  総合品質スコア
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress
                      variant="determinate"
                      value={selectedResult.result.qualityScore}
                      size={100}
                      thickness={6}
                      sx={{ color: selectedResult.result.qualityScore >= 90 ? 'success.main' : 'warning.main' }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {selectedResult.result.qualityScore}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      推定価格帯
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      ¥{selectedResult.result.estimatedPrice.min.toLocaleString()} 〜 ¥{selectedResult.result.estimatedPrice.max.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* 特徴分析 */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    特徴スコア
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={getFeatureData(selectedResult.result.features)}>
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="スコア"
                        dataKey="value"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    詳細分析
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { key: 'bodyShape', label: '体型', icon: <StraightenIcon /> },
                      { key: 'color', label: '色彩', icon: <PaletteIcon /> },
                      { key: 'pattern', label: '模様', icon: <PatternIcon /> },
                      { key: 'fins', label: 'ヒレ', icon: <InfoIcon /> },
                    ].map((item) => {
                      const feature = selectedResult.result!.features[item.key as keyof typeof selectedResult.result.features];
                      return (
                        <Box key={item.key}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            {item.icon}
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {item.label}
                            </Typography>
                            <Chip
                              label={`${feature.score}点`}
                              size="small"
                              color={feature.score >= 95 ? 'success' : feature.score >= 90 ? 'warning' : 'default'}
                              sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', pl: 4 }}>
                            {feature.description}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* アクション */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined">
                  結果をエクスポート
                </Button>
                <Button variant="contained">
                  商品登録に使用
                </Button>
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <CameraIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
                解析結果を選択してください
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                左側の履歴から解析済みの画像を選択すると、詳細な結果を確認できます
              </Typography>
            </Paper>
          )}

          {/* AI学習データ収集 */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: '#7C3AED' }}>
                <AutoAwesomeIcon />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  AI学習データ収集
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  解析結果のフィードバックでAIの精度が向上します
                </Typography>
              </Box>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              解析結果が正確でない場合は、正しい品種を教えてください。このデータはAIの学習に活用されます。
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  収集済みデータ
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  15,680件
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  フィードバック反映率
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  94.2%
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

