import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid,
  Button, CircularProgress, Alert, Autocomplete, TextField, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { aiPriceApi, adminDataApi } from '../../api/admin/aiApi';

interface AuctionOption { id: number; title: string; event_date: string; }
interface ItemOption { id: number; item_number: number; species_name: string; start_price: number; current_price: number; status: string; }
interface PredictionResult {
  predicted_price: number;
  price_low: number;
  price_high: number;
  confidence: number;
  factors: Array<{ type: string; value: any }>;
  species_name: string;
}
interface MarketTrend {
  species_name: string;
  transaction_count: number;
  avg_price: number;
  max_price: number;
  min_price: number;
}

export default function AIPricePrediction() {
  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionOption | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState('');
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  useEffect(() => {
    adminDataApi.getAuctions().then(setAuctions).catch(() => {});
    aiPriceApi.getMarketTrends().then((data) => {
      setTrends(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setLoadingTrends(false));
  }, []);

  useEffect(() => {
    if (selectedAuction) {
      setSelectedItem(null);
      setResult(null);
      adminDataApi.getItems(selectedAuction.id).then(setItems).catch(() => {});
    }
  }, [selectedAuction]);

  const handlePredict = async () => {
    if (!selectedItem) return;
    setPredicting(true);
    setError('');
    setResult(null);
    try {
      const data = await aiPriceApi.predict(selectedItem.id);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.message || '価格予測に失敗しました');
    } finally {
      setPredicting(false);
    }
  };

  const confidenceColor = (c: number) => c >= 70 ? 'success' : c >= 40 ? 'warning' : 'error';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <TimelineIcon sx={{ fontSize: 32, color: '#10B981' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>AI価格予測</Typography>
          <Typography variant="body2" color="text.secondary">
            過去の取引データとトレンドに基づき、適正な参考落札価格を算出します
          </Typography>
        </Box>
      </Box>

      {/* 商品選択 + 予測実行 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>予測対象の選択</Typography>
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
          <Grid item xs={12} md={5}>
            <Autocomplete
              options={items}
              getOptionLabel={(o) => `No.${o.item_number} ${o.species_name}（開始¥${o.start_price.toLocaleString()}）`}
              value={selectedItem}
              onChange={(_, v) => { setSelectedItem(v); setResult(null); setError(''); }}
              disabled={!selectedAuction}
              renderInput={(params) => <TextField {...params} label="商品" size="small" />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              fullWidth
              color="success"
              startIcon={predicting ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
              onClick={handlePredict}
              disabled={!selectedItem || predicting}
            >
              {predicting ? '予測中...' : '価格予測'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* 予測結果 */}
      {result && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            予測結果: {result.species_name}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  ¥{result.predicted_price.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">予測落札価格</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  ¥{result.price_low.toLocaleString()} - ¥{result.price_high.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">予測レンジ</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: `${confidenceColor(result.confidence)}.50`, borderRadius: 2 }}>
                <Typography variant="h4" fontWeight={700} color={`${confidenceColor(result.confidence)}.main`}>
                  {result.confidence.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">信頼度</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
                <Typography variant="h6" fontWeight={600} color="info.main">
                  ¥{selectedItem?.start_price.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">開始価格</Typography>
              </Box>
            </Grid>
          </Grid>

          {result.factors.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>予測根拠</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {result.factors.map((f, i) => (
                  <Chip key={i} label={`${f.type}: ${f.value}`} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* 市場動向 */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>品種別市場動向（直近90日）</Typography>
        </Box>

        {loadingTrends ? (
          <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
        ) : trends.length === 0 ? (
          <Alert severity="info">取引データがまだありません。オークション完了後にデータが蓄積されます。</Alert>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="species_name" fontSize={11} />
                <YAxis />
                <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                <Bar dataKey="avg_price" name="平均落札価格" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max_price" name="最高落札価格" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <TableContainer sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>品種名</TableCell>
                    <TableCell align="right">取引数</TableCell>
                    <TableCell align="right">平均価格</TableCell>
                    <TableCell align="right">最高価格</TableCell>
                    <TableCell align="right">最低価格</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trends.map((t, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{t.species_name}</TableCell>
                      <TableCell align="right">{t.transaction_count}件</TableCell>
                      <TableCell align="right">¥{Math.round(t.avg_price).toLocaleString()}</TableCell>
                      <TableCell align="right">¥{Math.round(t.max_price).toLocaleString()}</TableCell>
                      <TableCell align="right">¥{Math.round(t.min_price).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Box>
  );
}
