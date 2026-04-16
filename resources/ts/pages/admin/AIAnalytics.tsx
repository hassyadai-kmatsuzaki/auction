import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiDashboardApi, aiFraudApi } from '../../api/admin/aiApi';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
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
  Timeline as TimelineIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
// recharts は個別AI画面で使用

// デフォルト値（API取得前）
const defaultMetrics = {
  imageAnalysisCount: 0,
  fraudDetectionCount: 0,
  dataCollected: 0,
};

// モックデータは使用しない - 全てAPIから取得

export default function AIAnalytics() {
  const navigate = useNavigate();
  const [aiMetrics, setAiMetrics] = useState(defaultMetrics);
  const [fraudAlertsList, setFraudAlertsList] = useState<any[]>([]);

  useEffect(() => {
    // AI ダッシュボード統計を取得
    aiDashboardApi.getSummary().then((data) => {
      setAiMetrics({
        imageAnalysisCount: data.image_analyses ?? 0,
        fraudDetectionCount: (data.fraud_alerts?.open ?? 0) + (data.fraud_alerts?.investigating ?? 0),
        dataCollected: data.recommendations_generated ?? 0,
      });
    }).catch(() => {});

    // 不正検知アラート取得
    aiFraudApi.getAlerts({ status: 'open' }).then((data) => {
      setFraudAlertsList((data.data ?? []).slice(0, 3).map((a: any) => ({
        id: a.id,
        type: a.alert_type === 'shill_bidding' ? 'サクラ入札' :
              a.alert_type === 'bid_pattern' ? '入札パターン異常' :
              a.alert_type === 'price_manipulation' ? '価格操作' : a.alert_type,
        user: a.user?.name ?? `ID:${a.user_id}`,
        severity: a.severity,
        timestamp: new Date(a.created_at).toLocaleString('ja-JP'),
      })));
    }).catch(() => {});
  }, []);

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
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="画像解析数"
            value={aiMetrics.imageAnalysisCount.toLocaleString()}
            unit="件"
            icon={<CameraIcon />}
            color="#3B82F6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="未対応アラート"
            value={aiMetrics.fraudDetectionCount}
            unit="件"
            icon={<WarningIcon />}
            color="#EF4444"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="レコメンド生成数"
            value={aiMetrics.dataCollected.toLocaleString()}
            unit="件"
            icon={<RecommendIcon />}
            color="#8B5CF6"
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

      {/* 不正検知アラート */}
      <Grid container spacing={3}>
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
            {fraudAlertsList.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <CheckCircleIcon sx={{ fontSize: 48, mb: 1, color: 'success.main' }} />
                <Typography>現在アラートはありません</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {fraudAlertsList.map((alert) => (
                  <Box
                    key={alert.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alert.severity === 'high' || alert.severity === 'critical' ? 'error.light' : alert.severity === 'medium' ? 'warning.light' : 'grey.100',
                      border: '1px solid',
                      borderColor: alert.severity === 'high' || alert.severity === 'critical' ? 'error.main' : alert.severity === 'medium' ? 'warning.main' : 'grey.300',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {alert.severity === 'high' || alert.severity === 'critical' ? (
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
                        label={alert.severity === 'high' || alert.severity === 'critical' ? '高' : alert.severity === 'medium' ? '中' : '低'}
                        size="small"
                        color={alert.severity === 'high' || alert.severity === 'critical' ? 'error' : alert.severity === 'medium' ? 'warning' : 'default'}
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

        {/* クイックアクセス */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              各機能へのアクセス
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              各AI機能ページでは、オークションや商品を選択して個別に解析・予測・検知を実行できます。
            </Typography>
            {[
              { label: '画像認識: 商品を選択してAI解析', path: '/admin/ai/image-recognition', color: '#3B82F6' },
              { label: '価格予測: 市場動向と参考価格を確認', path: '/admin/ai/price-prediction', color: '#10B981' },
              { label: '不正検知: オークションの入札パターンを分析', path: '/admin/ai/fraud-detection', color: '#EF4444' },
              { label: 'レコメンド: ユーザーへのおすすめ商品を生成', path: '/admin/ai/recommendations', color: '#8B5CF6' },
            ].map((item) => (
              <Button
                key={item.path}
                fullWidth
                variant="outlined"
                sx={{
                  mb: 1, justifyContent: 'flex-start', textTransform: 'none',
                  borderColor: item.color, color: item.color,
                  '&:hover': { bgcolor: `${item.color}10`, borderColor: item.color },
                }}
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </Button>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

