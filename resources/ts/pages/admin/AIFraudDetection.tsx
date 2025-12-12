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
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Flag as FlagIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
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
} from 'recharts';

// Mock データ
const fraudAlerts = [
  {
    id: 1,
    type: '短時間連続入札',
    description: '5分間で15回の連続入札を検出',
    user: { id: 'U-1234', name: '匿名ユーザー', email: 'user***@example.com' },
    severity: 'high',
    status: 'pending',
    detectedAt: '2025-12-12 10:30:25',
    auctionId: 'A-2025-12-001',
    itemId: 'I-0045',
    riskScore: 92,
    details: {
      bidCount: 15,
      timeWindow: '5分',
      avgInterval: '20秒',
      priceIncrease: '+¥3,500',
    },
  },
  {
    id: 2,
    type: '異常な価格設定',
    description: '市場価格の3倍以上の開始価格を検出',
    user: { id: 'S-5678', name: '出品者B', email: 'seller***@example.com' },
    severity: 'medium',
    status: 'investigating',
    detectedAt: '2025-12-12 09:15:40',
    auctionId: 'A-2025-12-001',
    itemId: 'I-0032',
    riskScore: 75,
    details: {
      setPrice: '¥15,000',
      marketAvg: '¥4,500',
      deviation: '233%',
    },
  },
  {
    id: 3,
    type: '入札パターン類似',
    description: '同一IPから複数アカウントでの入札パターンを検出',
    user: { id: 'U-9012', name: '匿名ユーザー', email: 'user***@example.com' },
    severity: 'medium',
    status: 'pending',
    detectedAt: '2025-12-12 08:45:12',
    auctionId: 'A-2025-12-001',
    itemId: 'I-0028',
    riskScore: 68,
    details: {
      relatedAccounts: 3,
      commonIP: '192.168.xxx.xxx',
      bidPattern: '交互入札',
    },
  },
  {
    id: 4,
    type: '吊り上げ疑惑',
    description: '出品者と落札者の関連性を検出',
    user: { id: 'U-3456', name: '匿名ユーザー', email: 'user***@example.com' },
    severity: 'high',
    status: 'resolved',
    detectedAt: '2025-12-11 16:20:30',
    auctionId: 'A-2025-11-002',
    itemId: 'I-0156',
    riskScore: 88,
    details: {
      relation: '同一住所',
      frequency: '過去3回',
      action: 'アカウント警告',
    },
  },
  {
    id: 5,
    type: 'ボット疑惑',
    description: '人間らしくない入札タイミングを検出',
    user: { id: 'U-7890', name: '匿名ユーザー', email: 'user***@example.com' },
    severity: 'low',
    status: 'dismissed',
    detectedAt: '2025-12-11 14:10:55',
    auctionId: 'A-2025-11-002',
    itemId: 'I-0143',
    riskScore: 45,
    details: {
      responseTime: '0.3秒',
      pattern: '規則的',
      conclusion: '誤検知',
    },
  },
];

const alertTrend = [
  { date: '12/6', high: 1, medium: 2, low: 3 },
  { date: '12/7', high: 0, medium: 3, low: 2 },
  { date: '12/8', high: 2, medium: 1, low: 4 },
  { date: '12/9', high: 1, medium: 2, low: 2 },
  { date: '12/10', high: 0, medium: 1, low: 3 },
  { date: '12/11', high: 2, medium: 2, low: 1 },
  { date: '12/12', high: 1, medium: 2, low: 0 },
];

const fraudTypes = [
  { type: '短時間連続入札', count: 12, percentage: 35 },
  { type: '異常価格設定', count: 8, percentage: 24 },
  { type: 'パターン類似', count: 6, percentage: 18 },
  { type: '吊り上げ疑惑', count: 5, percentage: 15 },
  { type: 'ボット疑惑', count: 3, percentage: 8 },
];

export default function AIFraudDetection() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<typeof fraudAlerts[0] | null>(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredAlerts = fraudAlerts.filter((alert) => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && alert.status !== filterStatus) return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '未対応';
      case 'investigating': return '調査中';
      case 'resolved': return '対応済み';
      case 'dismissed': return '誤検知';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'error';
      case 'investigating': return 'warning';
      case 'resolved': return 'success';
      case 'dismissed': return 'default';
      default: return 'default';
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
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            異常検知・不正入札監視
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            AIによる入札パターン分析と不正検知
          </Typography>
        </Box>
        <Chip
          icon={<SecurityIcon />}
          label="リアルタイム監視中"
          color="success"
          sx={{ fontWeight: 500 }}
        />
      </Box>

      {/* サマリーカード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'error.light', width: 48, height: 48 }}>
                  <ErrorIcon sx={{ color: 'error.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    高リスク
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                    2
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
                <Avatar sx={{ bgcolor: 'warning.light', width: 48, height: 48 }}>
                  <WarningIcon sx={{ color: 'warning.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    中リスク
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    2
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
                  <InfoIcon sx={{ color: 'info.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    低リスク
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                    1
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
                <Avatar sx={{ bgcolor: 'success.light', width: 48, height: 48 }}>
                  <CheckCircleIcon sx={{ color: 'success.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    解決済み
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                    12
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="アラート一覧" icon={<WarningIcon />} iconPosition="start" />
        <Tab label="統計・トレンド" icon={<TimelineIcon />} iconPosition="start" />
        <Tab label="設定" icon={<SecurityIcon />} iconPosition="start" />
      </Tabs>

      {/* アラート一覧タブ */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              {/* フィルター */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  size="small"
                  placeholder="検索..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 250 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>重大度</InputLabel>
                  <Select
                    value={filterSeverity}
                    label="重大度"
                    onChange={(e) => setFilterSeverity(e.target.value)}
                  >
                    <MenuItem value="all">すべて</MenuItem>
                    <MenuItem value="high">高</MenuItem>
                    <MenuItem value="medium">中</MenuItem>
                    <MenuItem value="low">低</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>ステータス</InputLabel>
                  <Select
                    value={filterStatus}
                    label="ステータス"
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <MenuItem value="all">すべて</MenuItem>
                    <MenuItem value="pending">未対応</MenuItem>
                    <MenuItem value="investigating">調査中</MenuItem>
                    <MenuItem value="resolved">対応済み</MenuItem>
                    <MenuItem value="dismissed">誤検知</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* アラートリスト */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredAlerts.map((alert) => (
                  <Box
                    key={alert.id}
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alert.severity === 'high' ? 'error.main' : alert.severity === 'medium' ? 'warning.main' : 'grey.300',
                      borderLeftWidth: 4,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: alert.severity === 'high' ? 'error.light' : alert.severity === 'medium' ? 'warning.light' : 'info.light',
                          width: 44,
                          height: 44,
                        }}
                      >
                        <WarningIcon
                          sx={{
                            color: alert.severity === 'high' ? 'error.main' : alert.severity === 'medium' ? 'warning.main' : 'info.main',
                          }}
                        />
                      </Avatar>

                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {alert.type}
                          </Typography>
                          <Chip
                            label={alert.severity === 'high' ? '高' : alert.severity === 'medium' ? '中' : '低'}
                            size="small"
                            color={getSeverityColor(alert.severity)}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          <Chip
                            label={getStatusLabel(alert.status)}
                            size="small"
                            color={getStatusColor(alert.status)}
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>

                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                          {alert.description}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                            {alert.user.id}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            <ScheduleIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                            {alert.detectedAt}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            リスクスコア: <strong>{alert.riskScore}</strong>
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                        {alert.status === 'pending' && (
                          <IconButton size="small" color="error">
                            <BlockIcon />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 統計・トレンドタブ */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                アラート発生推移（過去7日間）
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alertTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <RechartsTooltip />
                  <Bar dataKey="high" name="高リスク" fill="#EF4444" stackId="a" />
                  <Bar dataKey="medium" name="中リスク" fill="#F59E0B" stackId="a" />
                  <Bar dataKey="low" name="低リスク" fill="#3B82F6" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                検知タイプ別内訳
              </Typography>
              {fraudTypes.map((item) => (
                <Box key={item.type} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{item.type}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.count}件 ({item.percentage}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={item.percentage}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'grey.100',
                    }}
                  />
                </Box>
              ))}
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                AI検知の統計
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      今月の検知総数
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      34
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      検知精度
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      94.2%
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      誤検知率
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      5.8%
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      平均対応時間
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      2.3h
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 設定タブ */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            検知ルール設定
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            検知ルールを変更すると、AIモデルの挙動に影響します。慎重に設定してください。
          </Alert>

          <Grid container spacing={3}>
            {[
              { label: '短時間連続入札', description: '指定時間内の入札回数が閾値を超えた場合に検知', threshold: '10回/5分', enabled: true },
              { label: '異常価格設定', description: '市場平均から大きく乖離した価格を検知', threshold: '±200%', enabled: true },
              { label: '入札パターン類似', description: '類似した入札パターンを持つアカウントを検知', threshold: '類似度80%以上', enabled: true },
              { label: '吊り上げ疑惑', description: '出品者と落札者の関連性を検知', threshold: '同一情報2件以上', enabled: true },
              { label: 'ボット検知', description: '人間らしくない入札タイミングを検知', threshold: '反応時間0.5秒未満', enabled: false },
            ].map((rule) => (
              <Grid item xs={12} md={6} key={rule.label}>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    bgcolor: rule.enabled ? 'background.paper' : 'grey.50',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {rule.label}
                    </Typography>
                    <Chip
                      label={rule.enabled ? '有効' : '無効'}
                      size="small"
                      color={rule.enabled ? 'success' : 'default'}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {rule.description}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    閾値: <strong>{rule.threshold}</strong>
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
            <Button variant="outlined">
              デフォルトに戻す
            </Button>
            <Button variant="contained">
              設定を保存
            </Button>
          </Box>
        </Paper>
      )}

      {/* 詳細ダイアログ */}
      <Dialog
        open={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: selectedAlert.severity === 'high' ? 'error.light' : selectedAlert.severity === 'medium' ? 'warning.light' : 'info.light',
                  }}
                >
                  <WarningIcon
                    sx={{
                      color: selectedAlert.severity === 'high' ? 'error.main' : selectedAlert.severity === 'medium' ? 'warning.main' : 'info.main',
                    }}
                  />
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedAlert.type}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {selectedAlert.detectedAt}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 3 }}>
                {selectedAlert.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                検知詳細
              </Typography>
              <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
                {Object.entries(selectedAlert.details).map(([key, value]) => (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {key}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                対象ユーザー
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'grey.200' }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedAlert.user.id}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {selectedAlert.user.email}
                  </Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedAlert(null)}>
                閉じる
              </Button>
              {selectedAlert.status === 'pending' && (
                <>
                  <Button color="warning">
                    調査開始
                  </Button>
                  <Button variant="contained" color="error">
                    アカウント停止
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

