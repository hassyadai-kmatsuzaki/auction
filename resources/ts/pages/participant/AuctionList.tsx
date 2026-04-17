import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Divider,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Inventory as InventoryIcon,
  ArrowForward as ArrowForwardIcon,
  MeetingRoom as MeetingRoomIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { Auction } from '../../types';
import axios from '../../lib/axios';

export default function AuctionList() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = useCallback(async () => {
    try {
      const response = await axios.get('/api/participant/auctions');
      if (response.data.success) {
        setAuctions(response.data.data.auctions || []);
      }
    } catch (err) {
      setError('オークション一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // scheduled オークションがある場合は30秒ごとに入室状態をポーリング
  useEffect(() => {
    const hasScheduled = auctions.some(a => a.status === 'scheduled');
    if (!hasScheduled) return;
    const interval = setInterval(fetchAuctions, 30_000);
    return () => clearInterval(interval);
  }, [auctions, fetchAuctions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <Chip
            icon={<PlayArrowIcon />}
            label="開催中"
            color="success"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        );
      case 'scheduled':
        return (
          <Chip
            icon={<ScheduleIcon />}
            label="開催予定"
            color="primary"
            size="small"
            variant="outlined"
          />
        );
      case 'finished':
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="終了"
            size="small"
            variant="outlined"
          />
        );
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // フィルタリング
  const liveAuctions = auctions.filter(a => a.status === 'live');
  const scheduledAuctions = auctions.filter(a => a.status === 'scheduled');
  const finishedAuctions = auctions.filter(a => a.status === 'finished');

  const getFilteredAuctions = () => {
    switch (tabValue) {
      case 0:
        return [...liveAuctions, ...scheduledAuctions];
      case 1:
        return liveAuctions;
      case 2:
        return scheduledAuctions;
      case 3:
        return finishedAuctions;
      default:
        return auctions;
    }
  };

  const filteredAuctions = getFilteredAuctions();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
          <GavelIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          オークション一覧
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          開催中・開催予定のオークションを確認できます
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 開催中のオークションがある場合のバナー */}
      {liveAuctions.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: 3,
            bgcolor: 'success.50',
            border: '2px solid',
            borderColor: 'success.main',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlayArrowIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.dark' }}>
                  オークション開催中！
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {liveAuctions[0].title}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              color="success"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/participant/auction/${liveAuctions[0].id}/live`)}
              sx={{ fontWeight: 600 }}
            >
              今すぐ参加する
            </Button>
          </Box>
        </Paper>
      )}

      {/* タブ */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              py: 2,
              fontWeight: 600,
            },
          }}
        >
          <Tab label={`開催中・予定 (${liveAuctions.length + scheduledAuctions.length})`} />
          <Tab label={`開催中 (${liveAuctions.length})`} />
          <Tab label={`予定 (${scheduledAuctions.length})`} />
          <Tab label={`終了 (${finishedAuctions.length})`} />
        </Tabs>
      </Paper>

      {/* オークション一覧 */}
      {filteredAuctions.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'grey.50',
            borderRadius: 2,
          }}
        >
          <GavelIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            該当するオークションはありません
          </Typography>
          <Typography variant="body2" color="text.secondary">
            他のタブを確認してみてください
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredAuctions.map((auction) => (
            <Grid item xs={12} md={6} key={auction.id}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: auction.status === 'live' ? '2px solid' : '1px solid',
                  borderColor: auction.status === 'live' ? 'success.main' : 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: auction.status === 'live' ? 'success.dark' : 'primary.main',
                    boxShadow: 2,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  {/* ステータスとタイトル */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, mr: 1 }}>
                      {auction.title}
                    </Typography>
                    {getStatusChip(auction.status)}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* 詳細情報 */}
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EventIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            開催日
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatDate(auction.event_date)}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            開始時刻
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {auction.start_time || '未定'}〜
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    {auction.total_items !== undefined && (
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InventoryIcon fontSize="small" sx={{ color: 'primary.main' }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              出品数
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {auction.total_items}点
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )}
                    {auction.sellers && auction.sellers.length > 0 && (
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <PersonIcon fontSize="small" sx={{ color: 'primary.main', mt: 0.25 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              生産者
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                              {auction.sellers.map((seller) => (
                                <Chip key={seller} label={seller} size="small" variant="outlined" />
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      </Grid>
                    )}
                  </Grid>

                  {auction.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 2,
                        pt: 2,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {auction.description}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ p: 3, pt: 0 }}>
                  {auction.status === 'live' ? (
                    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                      <Button
                        variant="outlined"
                        size="large"
                        onClick={() => navigate(`/participant/auction/${auction.id}/items`)}
                        sx={{ fontWeight: 600, flex: 1 }}
                      >
                        出品一覧
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate(`/participant/auction/${auction.id}/live`)}
                        sx={{ fontWeight: 600, flex: 1 }}
                      >
                        オークション会場へ
                      </Button>
                    </Box>
                  ) : auction.status === 'scheduled' ? (
                    /* 待機室が公開中かどうかでボタンを出し分け */
                    auction.entrance_allowed ? (
                      /* 入室可能: 2ボタン並列表示 */
                      <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                        <Button
                          variant="outlined"
                          size="large"
                          onClick={() => navigate(`/participant/auction/${auction.id}/items`)}
                          sx={{ fontWeight: 600, flex: 1 }}
                        >
                          出品一覧
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          size="large"
                          startIcon={<MeetingRoomIcon />}
                          onClick={() => navigate(`/participant/auction/${auction.id}/live`)}
                          sx={{ fontWeight: 600, flex: 1 }}
                        >
                          待機室へ入室
                        </Button>
                      </Box>
                    ) : (
                      /* 入室不可: 出品一覧ボタンのみ */
                      <Button
                        variant="outlined"
                        fullWidth
                        size="large"
                        onClick={() => navigate(`/participant/auction/${auction.id}/items`)}
                        sx={{ fontWeight: 600 }}
                      >
                        出品一覧を見る
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="text"
                      fullWidth
                      size="large"
                      onClick={() => navigate(`/participant/auction/${auction.id}/items`)}
                    >
                      結果を見る
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
