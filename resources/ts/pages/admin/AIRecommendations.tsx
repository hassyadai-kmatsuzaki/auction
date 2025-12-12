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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Divider,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Recommend as RecommendIcon,
  Person as PersonIcon,
  Pets as PetsIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  TouchApp as TouchAppIcon,
  Visibility as VisibilityIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Mock データ
const performanceData = [
  { date: '12/6', ctr: 18.5, cvr: 4.2 },
  { date: '12/7', ctr: 20.2, cvr: 4.8 },
  { date: '12/8', ctr: 22.1, cvr: 5.1 },
  { date: '12/9', ctr: 21.5, cvr: 4.9 },
  { date: '12/10', ctr: 23.4, cvr: 5.5 },
  { date: '12/11', ctr: 24.8, cvr: 5.8 },
  { date: '12/12', ctr: 23.4, cvr: 5.3 },
];

const algorithmPerformance = [
  { name: '協調フィルタリング', ctr: 24.5, impression: 45000, clicks: 11025 },
  { name: 'コンテンツベース', ctr: 21.2, impression: 32000, clicks: 6784 },
  { name: 'ハイブリッド', ctr: 26.8, impression: 28000, clicks: 7504 },
  { name: '人気ベース', ctr: 18.5, impression: 15000, clicks: 2775 },
];

const userSegments = [
  { name: '新規ユーザー', value: 25, color: '#3B82F6' },
  { name: 'アクティブ', value: 45, color: '#10B981' },
  { name: '休眠復帰', value: 15, color: '#F59E0B' },
  { name: 'VIP', value: 15, color: '#8B5CF6' },
];

const topRecommendedItems = [
  { id: 1, species: '幹之フルボディ', seller: '田中養魚場', impressions: 1250, clicks: 312, ctr: 24.9, bids: 45 },
  { id: 2, species: '三色ラメ', seller: 'メダカの佐藤', impressions: 980, clicks: 235, ctr: 23.9, bids: 38 },
  { id: 3, species: 'オロチ', seller: '鈴木メダカファーム', impressions: 850, clicks: 195, ctr: 22.9, bids: 32 },
  { id: 4, species: '楊貴妃', seller: '田中養魚場', impressions: 720, clicks: 158, ctr: 21.9, bids: 28 },
  { id: 5, species: 'サファイア', seller: 'メダカの佐藤', impressions: 650, clicks: 137, ctr: 21.0, bids: 22 },
];

const userRecommendationLog = [
  { userId: 'U-1234', segments: ['VIP', 'メダカ愛好家'], recommendedItems: 5, clickedItems: 2, bidItems: 1, timestamp: '2分前' },
  { userId: 'U-2345', segments: ['新規', '高額入札者'], recommendedItems: 5, clickedItems: 3, bidItems: 0, timestamp: '5分前' },
  { userId: 'U-3456', segments: ['アクティブ', 'ラメ系好き'], recommendedItems: 5, clickedItems: 1, bidItems: 1, timestamp: '8分前' },
  { userId: 'U-4567', segments: ['休眠復帰'], recommendedItems: 5, clickedItems: 0, bidItems: 0, timestamp: '12分前' },
];

export default function AIRecommendations() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    collaborativeFiltering: true,
    contentBased: true,
    hybridMode: true,
    popularityBased: false,
    personalizedEmail: true,
    realTimeRecommend: true,
  });

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
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              レコメンドシステム
            </Typography>
            <Chip label="ベータ" color="warning" size="small" />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            ユーザー行動履歴に基づく協調フィルタリングによる商品推薦
          </Typography>
        </Box>
      </Box>

      {/* KPIカード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>
                  <TouchAppIcon sx={{ color: 'primary.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    クリック率（CTR）
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      23.4%
                    </Typography>
                    <Chip label="+5.2%" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.light', width: 48, height: 48 }}>
                  <CartIcon sx={{ color: 'success.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    入札転換率（CVR）
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      5.3%
                    </Typography>
                    <Chip label="+1.1%" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.light', width: 48, height: 48 }}>
                  <VisibilityIcon sx={{ color: 'warning.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    本日のインプレッション
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    12.5K
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.light', width: 48, height: 48 }}>
                  <PersonIcon sx={{ color: 'info.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    レコメンド対象ユーザー
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    2,845
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="パフォーマンス" icon={<AnalyticsIcon />} iconPosition="start" />
        <Tab label="アルゴリズム" icon={<RecommendIcon />} iconPosition="start" />
        <Tab label="設定" icon={<SettingsIcon />} iconPosition="start" />
      </Tabs>

      {/* パフォーマンスタブ */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                CTR・CVR推移（過去7日間）
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="ctr"
                    name="CTR (%)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cvr"
                    name="CVR (%)"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: '#10B981', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                ユーザーセグメント
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={userSegments}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {userSegments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
                {userSegments.map((item) => (
                  <Chip
                    key={item.name}
                    label={`${item.name} ${item.value}%`}
                    size="small"
                    sx={{ bgcolor: item.color, color: 'white', fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                レコメンド商品パフォーマンス
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>商品</TableCell>
                      <TableCell>出品者</TableCell>
                      <TableCell align="right">インプレッション</TableCell>
                      <TableCell align="right">クリック</TableCell>
                      <TableCell align="center">CTR</TableCell>
                      <TableCell align="right">入札数</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topRecommendedItems.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                              <PetsIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                            </Avatar>
                            {item.species}
                          </Box>
                        </TableCell>
                        <TableCell>{item.seller}</TableCell>
                        <TableCell align="right">{item.impressions.toLocaleString()}</TableCell>
                        <TableCell align="right">{item.clicks.toLocaleString()}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${item.ctr}%`}
                            size="small"
                            color={item.ctr >= 24 ? 'success' : item.ctr >= 22 ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">{item.bids}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                リアルタイムレコメンドログ
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {userRecommendationLog.map((log, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <PersonIcon sx={{ color: 'primary.main' }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {log.userId}
                        </Typography>
                        {log.segments.map((seg) => (
                          <Chip key={seg} label={seg} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                        ))}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {log.recommendedItems}件表示 → {log.clickedItems}件クリック → {log.bidItems}件入札
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {log.timestamp}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* アルゴリズムタブ */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                アルゴリズム別パフォーマンス比較
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={algorithmPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip />
                  <Bar dataKey="ctr" name="CTR (%)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                アルゴリズム詳細
              </Typography>
              <Grid container spacing={3}>
                {[
                  {
                    name: '協調フィルタリング',
                    description: '類似ユーザーの行動パターンから商品を推薦',
                    pros: ['パーソナライズ精度が高い', '新商品にも対応'],
                    cons: ['コールドスタート問題', '計算コスト高'],
                    status: 'active',
                  },
                  {
                    name: 'コンテンツベース',
                    description: '商品の特徴（品種、出品者等）に基づいて推薦',
                    pros: ['説明可能性が高い', 'コールドスタートに強い'],
                    cons: ['多様性が低下しやすい'],
                    status: 'active',
                  },
                  {
                    name: 'ハイブリッド',
                    description: '複数アルゴリズムを組み合わせた推薦',
                    pros: ['バランスが良い', '弱点を補完'],
                    cons: ['チューニングが複雑'],
                    status: 'active',
                  },
                  {
                    name: '人気ベース',
                    description: '全体的な人気度に基づくシンプルな推薦',
                    pros: ['シンプル', '新規ユーザーに有効'],
                    cons: ['パーソナライズ不足'],
                    status: 'inactive',
                  },
                ].map((algo) => (
                  <Grid item xs={12} md={6} key={algo.name}>
                    <Box
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: algo.status === 'active' ? 'success.main' : 'grey.300',
                        bgcolor: algo.status === 'active' ? 'success.light' : 'grey.50',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {algo.name}
                        </Typography>
                        <Chip
                          label={algo.status === 'active' ? '有効' : '無効'}
                          size="small"
                          color={algo.status === 'active' ? 'success' : 'default'}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        {algo.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                            メリット
                          </Typography>
                          {algo.pros.map((pro, i) => (
                            <Typography key={i} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                              • {pro}
                            </Typography>
                          ))}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                            デメリット
                          </Typography>
                          {algo.cons.map((con, i) => (
                            <Typography key={i} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                              • {con}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 設定タブ */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            レコメンド設定
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            設定を変更すると、即座にレコメンドシステムの挙動に反映されます。
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                アルゴリズム設定
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.collaborativeFiltering}
                      onChange={(e) => setSettings({ ...settings, collaborativeFiltering: e.target.checked })}
                    />
                  }
                  label="協調フィルタリング"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.contentBased}
                      onChange={(e) => setSettings({ ...settings, contentBased: e.target.checked })}
                    />
                  }
                  label="コンテンツベースフィルタリング"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.hybridMode}
                      onChange={(e) => setSettings({ ...settings, hybridMode: e.target.checked })}
                    />
                  }
                  label="ハイブリッドモード"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.popularityBased}
                      onChange={(e) => setSettings({ ...settings, popularityBased: e.target.checked })}
                    />
                  }
                  label="人気ベース（フォールバック）"
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                配信設定
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.personalizedEmail}
                      onChange={(e) => setSettings({ ...settings, personalizedEmail: e.target.checked })}
                    />
                  }
                  label="パーソナライズメール配信"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.realTimeRecommend}
                      onChange={(e) => setSettings({ ...settings, realTimeRecommend: e.target.checked })}
                    />
                  }
                  label="リアルタイムレコメンド"
                />
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined">
              デフォルトに戻す
            </Button>
            <Button variant="contained">
              設定を保存
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

