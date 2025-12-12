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
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Divider,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Search as SearchIcon,
  Calculate as CalculateIcon,
  AutoAwesome as AutoAwesomeIcon,
  History as HistoryIcon,
  Pets as PetsIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  Legend,
} from 'recharts';

// Mock データ
const priceHistoryData = [
  { date: '1月', 幹之: 1200, 楊貴妃: 800, 三色ラメ: 3500, オロチ: 2200 },
  { date: '2月', 幹之: 1150, 楊貴妃: 850, 三色ラメ: 3800, オロチ: 2100 },
  { date: '3月', 幹之: 1300, 楊貴妃: 900, 三色ラメ: 4000, オロチ: 2300 },
  { date: '4月', 幹之: 1400, 楊貴妃: 950, 三色ラメ: 3700, オロチ: 2400 },
  { date: '5月', 幹之: 1350, 楊貴妃: 920, 三色ラメ: 4200, オロチ: 2350 },
  { date: '6月', 幹之: 1500, 楊貴妃: 1000, 三色ラメ: 4500, オロチ: 2500 },
  { date: '7月', 幹之: 1600, 楊貴妃: 1100, 三色ラメ: 4800, オロチ: 2600 },
  { date: '8月', 幹之: 1550, 楊貴妃: 1050, 三色ラメ: 4600, オロチ: 2550 },
  { date: '9月', 幹之: 1450, 楊貴妃: 980, 三色ラメ: 4300, オロチ: 2450 },
  { date: '10月', 幹之: 1500, 楊貴妃: 1020, 三色ラメ: 4400, オロチ: 2480 },
  { date: '11月', 幹之: 1580, 楊貴妃: 1080, 三色ラメ: 4700, オロチ: 2580 },
  { date: '12月', 幹之: 1650, 楊貴妃: 1150, 三色ラメ: 5000, オロチ: 2700 },
];

const predictionAccuracy = [
  { month: '7月', accuracy: 82 },
  { month: '8月', accuracy: 84 },
  { month: '9月', accuracy: 85 },
  { month: '10月', accuracy: 86 },
  { month: '11月', accuracy: 87 },
  { month: '12月', accuracy: 87.5 },
];

const scatterData = [
  { predicted: 1200, actual: 1250, species: '幹之' },
  { predicted: 1500, actual: 1480, species: '幹之' },
  { predicted: 2500, actual: 2600, species: '三色' },
  { predicted: 3000, actual: 2850, species: '三色' },
  { predicted: 800, actual: 820, species: '楊貴妃' },
  { predicted: 950, actual: 980, species: '楊貴妃' },
  { predicted: 2200, actual: 2300, species: 'オロチ' },
  { predicted: 4500, actual: 4400, species: 'ラメ' },
  { predicted: 1800, actual: 1750, species: '幹之' },
  { predicted: 3500, actual: 3600, species: '三色' },
];

const recentPredictions = [
  { id: 1, species: '幹之フルボディ', quantity: 5, predicted: 1650, actual: 1700, accuracy: 97.1, date: '2025-12-11' },
  { id: 2, species: '三色ラメ', quantity: 3, predicted: 4800, actual: 5200, accuracy: 92.3, date: '2025-12-11' },
  { id: 3, species: '楊貴妃', quantity: 10, predicted: 1100, actual: 1050, accuracy: 95.2, date: '2025-12-10' },
  { id: 4, species: 'オロチ', quantity: 4, predicted: 2600, actual: 2550, accuracy: 98.0, date: '2025-12-10' },
  { id: 5, species: '紅白ラメ', quantity: 2, predicted: 3200, actual: 3500, accuracy: 91.4, date: '2025-12-09' },
];

const speciesOptions = [
  '幹之メダカ', '楊貴妃メダカ', '三色ラメメダカ', 'オロチメダカ', '紅白ラメメダカ',
  'サファイアメダカ', 'ブラックダイヤ', '女雛メダカ', '紅帝メダカ', 'その他',
];

export default function AIPricePrediction() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedSpecies, setSelectedSpecies] = useState('幹之メダカ');
  const [quantity, setQuantity] = useState(5);
  const [qualityScore, setQualityScore] = useState(85);
  const [predictionResult, setPredictionResult] = useState<{
    min: number;
    max: number;
    recommended: number;
    confidence: number;
  } | null>(null);

  const handlePredict = () => {
    // Mock: 予測処理
    const basePrice = Math.floor(Math.random() * 3000) + 500;
    const qualityMultiplier = qualityScore / 100;
    const recommended = Math.floor(basePrice * qualityMultiplier);
    setPredictionResult({
      min: Math.floor(recommended * 0.8),
      max: Math.floor(recommended * 1.3),
      recommended,
      confidence: 85 + Math.random() * 10,
    });
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
            価格予測システム
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            過去の取引データを基に適正価格を予測します
          </Typography>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="価格予測" icon={<CalculateIcon />} iconPosition="start" />
        <Tab label="市場トレンド" icon={<TimelineIcon />} iconPosition="start" />
        <Tab label="予測精度" icon={<AutoAwesomeIcon />} iconPosition="start" />
        <Tab label="履歴" icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {/* 価格予測タブ */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                価格予測入力
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>品種</InputLabel>
                  <Select
                    value={selectedSpecies}
                    label="品種"
                    onChange={(e) => setSelectedSpecies(e.target.value)}
                  >
                    {speciesOptions.map((species) => (
                      <MenuItem key={species} value={species}>{species}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  type="number"
                  label="匹数"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">匹</InputAdornment>,
                  }}
                />

                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    品質スコア: {qualityScore}点
                  </Typography>
                  <Slider
                    value={qualityScore}
                    onChange={(_, value) => setQualityScore(value as number)}
                    min={50}
                    max={100}
                    valueLabelDisplay="auto"
                    sx={{ color: qualityScore >= 90 ? 'success.main' : qualityScore >= 70 ? 'warning.main' : 'error.main' }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>低</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>高</Typography>
                  </Box>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handlePredict}
                >
                  価格を予測
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            {predictionResult ? (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  予測結果
                </Typography>

                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    推奨開始価格
                  </Typography>
                  <Typography variant="h2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    ¥{predictionResult.recommended.toLocaleString()}
                  </Typography>
                  <Chip
                    label={`信頼度 ${predictionResult.confidence.toFixed(1)}%`}
                    color="success"
                    sx={{ mt: 1 }}
                  />
                </Box>

                <Divider sx={{ my: 3 }} />

                <Grid container spacing={3}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        予測最低価格
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        ¥{predictionResult.min.toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        予測最高価格
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        ¥{predictionResult.max.toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Alert severity="info" sx={{ mt: 3 }}>
                  <Typography variant="body2">
                    この予測は過去6ヶ月の取引データ（{selectedSpecies}）を基に算出されています。
                    実際の落札価格は、季節や出品タイミングによって変動する可能性があります。
                  </Typography>
                </Alert>

                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button variant="outlined" fullWidth>
                    詳細分析を見る
                  </Button>
                  <Button variant="contained" fullWidth>
                    この価格で出品
                  </Button>
                </Box>
              </Paper>
            ) : (
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <CalculateIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
                  価格予測を実行してください
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  左側のフォームで品種・匹数・品質を入力し、「価格を予測」ボタンをクリックしてください
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {/* 市場トレンドタブ */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                品種別価格推移
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={priceHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="幹之" stroke="#3B82F6" strokeWidth={2} />
                  <Line type="monotone" dataKey="楊貴妃" stroke="#EF4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="三色ラメ" stroke="#F59E0B" strokeWidth={2} />
                  <Line type="monotone" dataKey="オロチ" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                価格上昇トップ5
              </Typography>
              {[
                { species: '三色ラメメダカ', change: 42.8 },
                { species: '幹之フルボディ', change: 37.5 },
                { species: 'サファイアメダカ', change: 28.3 },
                { species: '紅帝メダカ', change: 24.1 },
                { species: 'オロチメダカ', change: 22.7 },
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, width: 24 }}>
                    {index + 1}
                  </Typography>
                  <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.light' }}>
                    <PetsIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  </Avatar>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {item.species}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                    <TrendingUpIcon sx={{ fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      +{item.change}%
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                価格下落トップ5
              </Typography>
              {[
                { species: '楊貴妃メダカ（並）', change: -15.2 },
                { species: '白メダカ', change: -12.8 },
                { species: 'ヒメダカ', change: -10.5 },
                { species: '青メダカ', change: -8.3 },
                { species: 'クロメダカ', change: -5.7 },
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, width: 24 }}>
                    {index + 1}
                  </Typography>
                  <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'error.light' }}>
                    <PetsIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  </Avatar>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {item.species}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                    <TrendingDownIcon sx={{ fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.change}%
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 予測精度タブ */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                予測精度推移
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={predictionAccuracy}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                  <YAxis domain={[70, 100]} stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                予測 vs 実際（散布図）
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="predicted" name="予測価格" stroke="#6B7280" fontSize={12} />
                  <YAxis dataKey="actual" name="実際の価格" stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="取引" data={scatterData} fill="#3B82F6" />
                </ScatterChart>
              </ResponsiveContainer>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 1 }}>
                対角線に近いほど予測精度が高い
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                品種別予測精度
              </Typography>
              <Grid container spacing={2}>
                {[
                  { species: '幹之メダカ', accuracy: 94.2, samples: 245 },
                  { species: '楊貴妃メダカ', accuracy: 91.8, samples: 189 },
                  { species: '三色ラメメダカ', accuracy: 88.5, samples: 156 },
                  { species: 'オロチメダカ', accuracy: 92.3, samples: 134 },
                  { species: '紅白ラメメダカ', accuracy: 86.7, samples: 98 },
                  { species: 'その他', accuracy: 82.4, samples: 423 },
                ].map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.species}>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {item.species}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: item.accuracy >= 90 ? 'success.main' : 'warning.main' }}>
                          {item.accuracy}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ({item.samples}件のデータ)
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 履歴タブ */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              予測履歴
            </Typography>
            <TextField
              size="small"
              placeholder="品種名で検索..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 250 }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>日付</TableCell>
                  <TableCell>品種</TableCell>
                  <TableCell align="center">匹数</TableCell>
                  <TableCell align="right">予測価格</TableCell>
                  <TableCell align="right">実際の落札価格</TableCell>
                  <TableCell align="center">精度</TableCell>
                  <TableCell align="center">差額</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentPredictions.map((pred) => {
                  const diff = pred.actual - pred.predicted;
                  return (
                    <TableRow key={pred.id} hover>
                      <TableCell>{pred.date}</TableCell>
                      <TableCell>{pred.species}</TableCell>
                      <TableCell align="center">{pred.quantity}匹</TableCell>
                      <TableCell align="right">¥{pred.predicted.toLocaleString()}</TableCell>
                      <TableCell align="right">¥{pred.actual.toLocaleString()}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${pred.accuracy}%`}
                          size="small"
                          color={pred.accuracy >= 95 ? 'success' : pred.accuracy >= 90 ? 'warning' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          sx={{ color: diff >= 0 ? 'success.main' : 'error.main', fontWeight: 500 }}
                        >
                          {diff >= 0 ? '+' : ''}¥{diff.toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}

