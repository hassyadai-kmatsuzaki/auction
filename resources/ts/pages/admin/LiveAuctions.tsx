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
  LiveTv as LiveTvIcon,
  ViewColumn as LaneIcon,
  Pets as PetsIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckCircleIcon,
  Event as EventIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface AuctionStatistics {
  lane_count: number;
  active_lanes: number;
  total_items: number;
  registered_items: number;
  assigned_items: number;
  live_items: number;
  sold_items: number;
  unsold_items: number;
}

interface Auction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  status: string;
  statistics: AuctionStatistics;
}

export default function LiveAuctions() {
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
      const response = await axios.get('/api/admin/live-auctions');
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'preparing':
        return '準備中';
      case 'scheduled':
        return '開催予定';
      case 'live':
        return 'ライブ中';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'error';
      case 'scheduled':
        return 'primary';
      case 'preparing':
        return 'warning';
      default:
        return 'default';
    }
  };

  // アイテム割り当て率
  const getAssignmentProgress = (stats: AuctionStatistics) => {
    if (stats.total_items === 0) return 0;
    return (stats.assigned_items / stats.total_items) * 100;
  };

  // 進行率（落札済み + 不落札）/ 総数
  const getProgressRate = (stats: AuctionStatistics) => {
    if (stats.total_items === 0) return 0;
    return ((stats.sold_items + stats.unsold_items) / stats.total_items) * 100;
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
          ライブオークション管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          オークションを選択してライブ管理を行います
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {auctions.length === 0 ? (
        <Alert severity="info">
          ライブ管理対象のオークションはありません。
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {auctions.map((auction) => (
            <Grid item xs={12} md={6} lg={4} key={auction.id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'all 0.2s',
                  border: auction.status === 'live' ? '2px solid' : '1px solid',
                  borderColor: auction.status === 'live' ? 'error.main' : 'divider',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/admin/auctions/${auction.id}/live`)}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    {/* オークション情報 */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {auction.title}
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {new Date(auction.event_date).toLocaleDateString('ja-JP')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {auction.start_time?.slice(0, 5)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                      <Chip
                        icon={auction.status === 'live' ? <PlayIcon /> : <ScheduleIcon />}
                        label={getStatusLabel(auction.status)}
                        color={getStatusColor(auction.status) as any}
                        size="small"
                        sx={{ 
                          animation: auction.status === 'live' ? 'pulse 2s infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.7 },
                          },
                        }}
                      />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* レーン・アイテム情報 */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <LaneIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                          <Typography variant="body2" fontWeight={600}>
                            レーン
                          </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight={700} color="primary.main">
                          {auction.statistics.lane_count}
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                            本
                          </Typography>
                        </Typography>
                        {auction.status === 'live' && auction.statistics.active_lanes > 0 && (
                          <Typography variant="caption" color="success.main">
                            {auction.statistics.active_lanes}レーン稼働中
                          </Typography>
                        )}
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PetsIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
                          <Typography variant="body2" fontWeight={600}>
                            出品数
                          </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight={700} color="secondary.main">
                          {auction.statistics.total_items}
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                            件
                          </Typography>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          承認済: {auction.statistics.registered_items}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* レーン割当状況 */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>
                          レーン割当
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {auction.statistics.assigned_items}/{auction.statistics.total_items}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={getAssignmentProgress(auction.statistics)}
                        sx={{ height: 8, borderRadius: 4 }}
                        color="primary"
                      />
                    </Box>

                    {/* 進行状況（ライブ中のみ） */}
                    {auction.status === 'live' && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>
                            進行状況
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {auction.statistics.sold_items + auction.statistics.unsold_items}/{auction.statistics.total_items}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={getProgressRate(auction.statistics)}
                          sx={{ height: 8, borderRadius: 4 }}
                          color="success"
                        />
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                          <Typography variant="caption" color="success.main">
                            落札: {auction.statistics.sold_items}
                          </Typography>
                          <Typography variant="caption" color="error.main">
                            不落札: {auction.statistics.unsold_items}
                          </Typography>
                          <Typography variant="caption" color="warning.main">
                            出品中: {auction.statistics.live_items}
                          </Typography>
                        </Stack>
                      </Box>
                    )}
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
