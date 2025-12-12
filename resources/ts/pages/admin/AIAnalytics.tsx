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
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Psychology as AIIcon,
  CameraAlt as CameraIcon,
  Warning as WarningIcon,
  Recommend as RecommendIcon,
  Assessment as AssessmentIcon,
  AutoAwesome as AutoAwesomeIcon,
  Speed as SpeedIcon,
  DataUsage as DataUsageIcon,
  Timeline as TimelineIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

// Mock データ
const aiMetrics = {
  imageAnalysisCount: 1245,
  imageAnalysisAccuracy: 94.2,
  pricePredicationAccuracy: 87.5,
  fraudDetectionCount: 3,
  recommendClickRate: 23.4,
  dataCollected: 15680,
};

const accuracyTrend = [
  { month: '7月', imageAccuracy: 89, priceAccuracy: 82 },
  { month: '8月', imageAccuracy: 90, priceAccuracy: 84 },
  { month: '9月', imageAccuracy: 91, priceAccuracy: 85 },
  { month: '10月', imageAccuracy: 93, priceAccuracy: 86 },
  { month: '11月', imageAccuracy: 94, priceAccuracy: 87 },
  { month: '12月', imageAccuracy: 94.2, priceAccuracy: 87.5 },
];

const categoryDistribution = [
  { name: '幹之系', value: 35, color: '#3B82F6' },
  { name: '楊貴妃系', value: 25, color: '#EF4444' },
  { name: 'ラメ系', value: 20, color: '#F59E0B' },
  { name: '三色系', value: 12, color: '#10B981' },
  { name: 'その他', value: 8, color: '#6B7280' },
];

const recentAnalyses = [
  { id: 1, image: '幹之フルボディ', species: '幹之メダカ', confidence: 96.5, status: 'completed', timestamp: '2分前' },
  { id: 2, image: '三色ラメ', species: '三色ラメメダカ', confidence: 94.2, status: 'completed', timestamp: '5分前' },
  { id: 3, image: '楊貴妃', species: '楊貴妃メダカ', confidence: 98.1, status: 'completed', timestamp: '12分前' },
  { id: 4, image: 'オロチ', species: 'オロチメダカ', confidence: 91.8, status: 'completed', timestamp: '18分前' },
];

const fraudAlerts = [
  { id: 1, type: '短時間連続入札', user: 'user_xxx', severity: 'high', timestamp: '1時間前' },
  { id: 2, type: '異常な価格設定', user: 'seller_yyy', severity: 'medium', timestamp: '3時間前' },
  { id: 3, type: 'パターン類似', user: 'user_zzz', severity: 'low', timestamp: '昨日' },
];

const priceHistory = [
  { date: '11/1', actual: 1200, predicted: 1150 },
  { date: '11/5', actual: 1350, predicted: 1380 },
  { date: '11/10', actual: 1500, predicted: 1480 },
  { date: '11/15', actual: 1420, predicted: 1450 },
  { date: '11/20', actual: 1600, predicted: 1550 },
  { date: '11/25', actual: 1750, predicted: 1720 },
];

export default function AIAnalytics() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  const StatCard = ({ 
    title, 
    value, 
    unit, 
    change, 
    icon, 
    color 
  }: { 
    title: string; 
    value: string | number; 
    unit?: string; 
    change?: number; 
    icon: React.ReactNode; 
    color: string;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {value}
              </Typography>
              {unit && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {unit}
                </Typography>
              )}
            </Box>
            {change !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                {change >= 0 ? (
                  <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography
                  variant="caption"
                  sx={{ color: change >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}
                >
                  {change >= 0 ? '+' : ''}{change}%
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  先月比
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const FeatureCard = ({
    title,
    description,
    icon,
    status,
    path,
    color,
  }: {
    title: string;
    description: string;
    icon: React.ReactNode;
    status: 'active' | 'beta' | 'coming';
    path?: string;
    color: string;
  }) => (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: path ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': path ? {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
        } : {},
      }}
      onClick={() => path && navigate(path)}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: color, width: 44, height: 44 }}>
            {icon}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
              <Chip
                label={status === 'active' ? '稼働中' : status === 'beta' ? 'ベータ' : '準備中'}
                size="small"
                color={status === 'active' ? 'success' : status === 'beta' ? 'warning' : 'default'}
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {description}
            </Typography>
          </Box>
        </Box>
        {path && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              sx={{ color: color }}
            >
              詳細を見る
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Avatar sx={{ bgcolor: '#7C3AED', width: 48, height: 48 }}>
            <AIIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              AI・分析センター
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              AI機能の状況確認とデータ分析ダッシュボード
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* メトリクスカード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="画像解析数"
            value={aiMetrics.imageAnalysisCount.toLocaleString()}
            unit="件"
            change={12.5}
            icon={<CameraIcon />}
            color="#3B82F6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="画像認識精度"
            value={aiMetrics.imageAnalysisAccuracy}
            unit="%"
            change={2.1}
            icon={<SpeedIcon />}
            color="#10B981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="価格予測精度"
            value={aiMetrics.pricePredicationAccuracy}
            unit="%"
            change={1.8}
            icon={<TimelineIcon />}
            color="#F59E0B"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="不正検知"
            value={aiMetrics.fraudDetectionCount}
            unit="件"
            icon={<WarningIcon />}
            color="#EF4444"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="レコメンドCTR"
            value={aiMetrics.recommendClickRate}
            unit="%"
            change={5.2}
            icon={<RecommendIcon />}
            color="#8B5CF6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="学習データ"
            value={(aiMetrics.dataCollected / 1000).toFixed(1)}
            unit="K件"
            change={8.3}
            icon={<DataUsageIcon />}
            color="#06B6D4"
          />
        </Grid>
      </Grid>

      {/* AI機能カード */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        AI機能
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard
            title="AI画像認識"
            description="メダカの体型・色彩・模様を自動解析し、品種を特定します"
            icon={<CameraIcon />}
            status="active"
            path="/admin/ai/image-recognition"
            color="#3B82F6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard
            title="価格予測"
            description="過去の取引データから適正な参考価格を算出します"
            icon={<TimelineIcon />}
            status="active"
            path="/admin/ai/price-prediction"
            color="#10B981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard
            title="異常検知"
            description="入札パターンを分析し、不正な取引を検知します"
            icon={<WarningIcon />}
            status="active"
            path="/admin/ai/fraud-detection"
            color="#EF4444"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard
            title="レコメンド"
            description="ユーザーの行動履歴から最適な商品を提案します"
            icon={<RecommendIcon />}
            status="beta"
            path="/admin/ai/recommendations"
            color="#8B5CF6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard
            title="自動カテゴリ分類"
            description="商品説明文から品種・タイプを自動判別します"
            icon={<AutoAwesomeIcon />}
            status="beta"
            color="#F59E0B"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard
            title="レポート自動生成"
            description="週次・月次の取引サマリーを自動作成します"
            icon={<AssessmentIcon />}
            status="active"
            path="/admin/reports"
            color="#06B6D4"
          />
        </Grid>
      </Grid>

      {/* 詳細分析 */}
      <Grid container spacing={3}>
        {/* 精度推移グラフ */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              AI精度推移
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={accuracyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis domain={[75, 100]} stroke="#6B7280" fontSize={12} />
                <RechartsTooltip />
                <Line
                  type="monotone"
                  dataKey="imageAccuracy"
                  name="画像認識精度"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="priceAccuracy"
                  name="価格予測精度"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* カテゴリ分布 */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              自動分類カテゴリ分布
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
              {categoryDistribution.map((item) => (
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

        {/* 最近の画像解析 */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                最近の画像解析
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/admin/ai/image-recognition')}
              >
                すべて見る
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>画像</TableCell>
                    <TableCell>判定品種</TableCell>
                    <TableCell align="center">信頼度</TableCell>
                    <TableCell align="center">ステータス</TableCell>
                    <TableCell align="right">時間</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentAnalyses.map((analysis) => (
                    <TableRow key={analysis.id} hover>
                      <TableCell>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#F3F4F6' }}>
                          <CameraIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                        </Avatar>
                      </TableCell>
                      <TableCell>{analysis.species}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${analysis.confidence}%`}
                          size="small"
                          color={analysis.confidence >= 95 ? 'success' : analysis.confidence >= 90 ? 'warning' : 'error'}
                          sx={{ minWidth: 60 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {analysis.timestamp}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* 不正検知アラート */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                不正検知アラート
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/admin/ai/fraud-detection')}
              >
                すべて見る
              </Button>
            </Box>
            {fraudAlerts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <CheckCircleIcon sx={{ fontSize: 48, mb: 1, color: 'success.main' }} />
                <Typography>現在アラートはありません</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {fraudAlerts.map((alert) => (
                  <Box
                    key={alert.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alert.severity === 'high' ? 'error.light' : alert.severity === 'medium' ? 'warning.light' : 'grey.100',
                      border: '1px solid',
                      borderColor: alert.severity === 'high' ? 'error.main' : alert.severity === 'medium' ? 'warning.main' : 'grey.300',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {alert.severity === 'high' ? (
                        <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      ) : alert.severity === 'medium' ? (
                        <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                      ) : (
                        <ScheduleIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      )}
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {alert.type}
                      </Typography>
                      <Chip
                        label={alert.severity === 'high' ? '高' : alert.severity === 'medium' ? '中' : '低'}
                        size="small"
                        color={alert.severity === 'high' ? 'error' : alert.severity === 'medium' ? 'warning' : 'default'}
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      対象: {alert.user} ・ {alert.timestamp}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* 価格予測の精度 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                価格予測 vs 実際の落札価格
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/admin/ai/price-prediction')}
              >
                詳細を見る
              </Button>
            </Box>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <RechartsTooltip />
                <Bar dataKey="actual" name="実際の落札価格" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="predicted" name="AI予測価格" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

