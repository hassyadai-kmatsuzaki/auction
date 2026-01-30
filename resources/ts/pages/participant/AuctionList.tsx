import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  List as ListIcon,
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

  const fetchAuctions = async () => {
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
  };

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
        return <Chip icon={<PlayArrowIcon />} label="開催中" color="success" size="small" />;
      case 'scheduled':
        return <Chip icon={<ScheduleIcon />} label="開催予定" color="primary" size="small" />;
      case 'finished':
        return <Chip icon={<CheckCircleIcon />} label="終了" color="default" size="small" />;
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
        return [...liveAuctions, ...scheduledAuctions]; // 開催中・予定
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
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GavelIcon />
        オークション一覧
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 開催中のオークションがある場合のアラート */}
      {liveAuctions.length > 0 && (
        <Alert
          severity="success"
          icon={<PlayArrowIcon />}
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(`/participant/auction/${liveAuctions[0].id}/live`)}
            >
              参加する
            </Button>
          }
        >
          <strong>開催中のオークションがあります！</strong>
          {' '}{liveAuctions[0].title}
        </Alert>
      )}

      {/* タブ */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label={`開催中・予定 (${liveAuctions.length + scheduledAuctions.length})`} />
        <Tab label={`開催中 (${liveAuctions.length})`} />
        <Tab label={`予定 (${scheduledAuctions.length})`} />
        <Tab label={`終了 (${finishedAuctions.length})`} />
      </Tabs>

      {filteredAuctions.length === 0 ? (
        <Alert severity="info">
          該当するオークションはありません
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {filteredAuctions.map((auction) => (
            <Grid item xs={12} md={6} lg={4} key={auction.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  border: auction.status === 'live' ? '2px solid' : undefined,
                  borderColor: auction.status === 'live' ? 'success.main' : undefined,
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                      {auction.title}
                    </Typography>
                    {getStatusChip(auction.status)}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
                    <EventIcon fontSize="small" />
                    <Typography variant="body2">
                      {formatDate(auction.event_date)}
                    </Typography>
                  </Box>

                  {auction.start_time && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
                      <AccessTimeIcon fontSize="small" />
                      <Typography variant="body2">
                        {auction.start_time}〜
                      </Typography>
                    </Box>
                  )}

                  {auction.total_items !== undefined && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                      <ListIcon fontSize="small" />
                      <Typography variant="body2">
                        出品数: {auction.total_items}点
                      </Typography>
                    </Box>
                  )}

                  {auction.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {auction.description}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  {auction.status === 'live' ? (
                    <>
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        onClick={() => navigate(`/participant/auction/${auction.id}/live`)}
                      >
                        オークション会場へ
                      </Button>
                    </>
                  ) : auction.status === 'scheduled' ? (
                    <>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => navigate(`/participant/auction/${auction.id}/items`)}
                      >
                        出品一覧を見る
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="text"
                      fullWidth
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
    </Box>
  );
}
