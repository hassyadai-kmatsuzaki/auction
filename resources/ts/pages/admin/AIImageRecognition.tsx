import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardMedia,
  Button, Chip, CircularProgress, Alert, Autocomplete, TextField,
  Divider,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { aiImageApi, adminDataApi } from '../../api/admin/aiApi';

interface AuctionOption { id: number; title: string; event_date: string; items_count?: number; }
interface ItemOption { id: number; item_number: number; species_name: string; thumbnail_path?: string | null; status: string; }
interface AnalysisResult {
  id: number;
  quality_score: number | null;
  predicted_breed: string | null;
  breed_confidence: number | null;
  body_shape_features: Record<string, any> | null;
  color_features: Record<string, any> | null;
  pattern_features: Record<string, any> | null;
  model_version: string | null;
}

export default function AIImageRecognition() {
  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionOption | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [batchMessage, setBatchMessage] = useState('');

  useEffect(() => {
    adminDataApi.getAuctions().then(setAuctions).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedAuction) {
      setSelectedItem(null);
      setResult(null);
      adminDataApi.getItems(selectedAuction.id).then(setItems).catch(() => {});
    }
  }, [selectedAuction]);

  const handleAnalyze = async () => {
    if (!selectedItem) return;
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const res = await aiImageApi.analyze(selectedItem.id);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError('解析結果を取得できませんでした。商品に画像が登録されているか確認してください。');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '解析中にエラーが発生しました');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBatchAnalyze = async () => {
    if (!selectedAuction) return;
    setBatchAnalyzing(true);
    setBatchMessage('');
    try {
      const res = await aiImageApi.batchAnalyze(selectedAuction.id);
      setBatchMessage(res.message || `${res.data?.analyzed_count ?? 0}件の商品を解析しました`);
    } catch (err: any) {
      setBatchMessage('バッチ解析に失敗しました: ' + (err.response?.data?.message || err.message));
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const FeatureCard = ({ title, data }: { title: string; data: Record<string, any> | null }) => {
    if (!data) return null;
    return (
      <Card variant="outlined" sx={{ mb: 1 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography>
          {Object.entries(data).map(([key, value]) => (
            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{key}</Typography>
              <Typography variant="body2" fontWeight={500}>
                {typeof value === 'number' ? value.toFixed(1) : String(value)}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CameraIcon sx={{ fontSize: 32, color: '#3B82F6' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>AI画像認識</Typography>
          <Typography variant="body2" color="text.secondary">
            メダカの体型・色彩・模様をAIで解析し、品種判定・品質スコアを算出します
          </Typography>
        </Box>
      </Box>

      {/* 商品選択エリア */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>解析対象の選択</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={auctions}
              getOptionLabel={(o) => `${o.title}（${o.event_date}）`}
              value={selectedAuction}
              onChange={(_, v) => setSelectedAuction(v)}
              renderInput={(params) => <TextField {...params} label="オークション" size="small" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={items}
              getOptionLabel={(o) => `No.${o.item_number} ${o.species_name}`}
              value={selectedItem}
              onChange={(_, v) => { setSelectedItem(v); setResult(null); setError(''); }}
              disabled={!selectedAuction}
              renderInput={(params) => <TextField {...params} label="商品" size="small" />}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <Button
              variant="contained"
              fullWidth
              startIcon={analyzing ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
              onClick={handleAnalyze}
              disabled={!selectedItem || analyzing}
            >
              {analyzing ? '解析中...' : '解析実行'}
            </Button>
          </Grid>
          <Grid item xs={6} md={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={batchAnalyzing ? <CircularProgress size={18} /> : <PlayIcon />}
              onClick={handleBatchAnalyze}
              disabled={!selectedAuction || batchAnalyzing}
            >
              一括解析
            </Button>
          </Grid>
        </Grid>
        {batchMessage && <Alert severity="info" sx={{ mt: 2 }}>{batchMessage}</Alert>}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* 選択中の商品プレビュー */}
      {selectedItem && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>選択中の商品</Typography>
              {selectedItem.thumbnail_path ? (
                <CardMedia
                  component="img"
                  image={selectedItem.thumbnail_path}
                  alt={selectedItem.species_name}
                  sx={{ borderRadius: 1, mb: 1, maxHeight: 250, objectFit: 'cover' }}
                />
              ) : (
                <Box sx={{ bgcolor: 'grey.100', borderRadius: 1, p: 4, textAlign: 'center', mb: 1 }}>
                  <CameraIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                  <Typography variant="body2" color="text.secondary">画像なし</Typography>
                </Box>
              )}
              <Typography variant="subtitle1" fontWeight={600}>
                No.{selectedItem.item_number} {selectedItem.species_name}
              </Typography>
              <Chip label={selectedItem.status} size="small" sx={{ mt: 0.5 }} />
            </Paper>
          </Grid>

          {/* 解析結果 */}
          <Grid item xs={12} md={8}>
            {analyzing && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography>AIが画像を解析しています...</Typography>
              </Paper>
            )}

            {result && !analyzing && (
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckIcon color="success" />
                  <Typography variant="h6" fontWeight={600}>解析結果</Typography>
                  {result.model_version && (
                    <Chip label={`Model: ${result.model_version}`} size="small" variant="outlined" />
                  )}
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.50', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {result.quality_score?.toFixed(1) ?? '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">品質スコア / 10</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                      <Typography variant="h6" fontWeight={700} color="success.main">
                        {result.predicted_breed ?? '不明'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">推定品種</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {result.breed_confidence?.toFixed(0) ?? '-'}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">品種信頼度</Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>特徴分析</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FeatureCard title="体型" data={result.body_shape_features} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FeatureCard title="色彩" data={result.color_features} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FeatureCard title="模様" data={result.pattern_features} />
                  </Grid>
                </Grid>
              </Paper>
            )}

            {!result && !analyzing && (
              <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <CameraIcon sx={{ fontSize: 64, mb: 1, opacity: 0.3 }} />
                <Typography>商品を選択して「解析実行」をクリックしてください</Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
