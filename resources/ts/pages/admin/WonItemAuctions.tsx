import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Payment as PaymentIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface AuctionStatistics {
  total_count: number;
  total_amount: number;
  pending_payment: number;
  paid_count: number;
  confirmed_payment: number;
  preparing_count: number;
  shipped_count: number;
  completed_count: number;
}

interface Auction {
  id: number;
  title: string;
  event_date: string;
  status: string;
  statistics: AuctionStatistics;
}

export default function WonItemAuctions() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/won-items-auctions');
      if (response.data.success) {
        setAuctions(response.data.data.auctions);
      }
    } catch (err: any) {
      console.error('オークション一覧取得エラー:', err);
      setError(err.response?.data?.message || 'オークション一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live':
        return 'オークション中';
      case 'finished':
        return '終了';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'error';
      case 'finished':
        return 'default';
      default:
        return 'default';
    }
  };

  // 入金完了率
  const getPaymentProgress = (stats: AuctionStatistics) => {
    if (stats.total_count === 0) return 0;
    return ((stats.confirmed_payment + stats.paid_count) / stats.total_count) * 100;
  };

  // 発送完了率
  const getShippingProgress = (stats: AuctionStatistics) => {
    if (stats.total_count === 0) return 0;
    return ((stats.shipped_count + stats.completed_count) / stats.total_count) * 100;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          落札者管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          オークションを選択して落札者の管理を行います
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {auctions.length === 0 ? (
        <Alert severity="info">
          落札者のいるオークションはまだありません。
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {auctions.map((auction) => (
            <Grid item xs={12} md={6} lg={4} key={auction.id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/admin/auctions/${auction.id}/won-items`)}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    {/* オークション情報 */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {auction.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {new Date(auction.event_date).toLocaleDateString('ja-JP')}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={getStatusLabel(auction.status)}
                        color={getStatusColor(auction.status) as any}
                        size="small"
                      />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* 統計情報 */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrophyIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                          <Typography variant="body2" fontWeight={600}>
                            落札数
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700} color="primary.main">
                          {auction.statistics.total_count}件
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                        合計: {formatCurrency(auction.statistics.total_amount)}
                      </Typography>
                    </Box>

                    {/* 入金状況 */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <PaymentIcon sx={{ fontSize: 18, color: 'success.main' }} />
                        <Typography variant="body2" fontWeight={600}>
                          入金状況
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={getPaymentProgress(auction.statistics)}
                        sx={{ height: 8, borderRadius: 4, mb: 1 }}
                        color="success"
                      />
                      <Stack direction="row" spacing={2} justifyContent="space-between">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                          <Typography variant="caption" color="text.secondary">
                            未入金: {auction.statistics.pending_payment}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                          <Typography variant="caption" color="text.secondary">
                            確認済: {auction.statistics.confirmed_payment}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>

                    {/* 発送状況 */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <ShippingIcon sx={{ fontSize: 18, color: 'info.main' }} />
                        <Typography variant="body2" fontWeight={600}>
                          発送状況
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={getShippingProgress(auction.statistics)}
                        sx={{ height: 8, borderRadius: 4, mb: 1 }}
                        color="info"
                      />
                      <Stack direction="row" spacing={2} justifyContent="space-between">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            準備中: {auction.statistics.preparing_count}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            発送済: {auction.statistics.shipped_count}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircleIcon sx={{ fontSize: 14, color: 'info.main' }} />
                          <Typography variant="caption" color="text.secondary">
                            完了: {auction.statistics.completed_count}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
