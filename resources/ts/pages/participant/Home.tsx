import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Skeleton,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  OpenInNew as OpenInNewIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import type { Auction } from '../../types';
import AnnouncementList from '../../components/AnnouncementList';
import axios from '../../lib/axios';

interface SponsoredAd {
  id: number;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  advertiser: string;
}

const sponsoredAds: SponsoredAd[] = [
  {
    id: 1,
    title: '高品質メダカ用飼料「極」新発売！',
    description: '色揚げ効果抜群！プロブリーダー推奨の最高級飼料。今なら初回購入20%OFF',
    image_url: '/img/noimage.png',
    link_url: 'https://example.com/feed',
    advertiser: 'メダカフード株式会社',
  },
];

function getDaysUntil(dateString: string): string {
  const target = new Date(dateString + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '本日開催';
  if (diff === 1) return 'あと1日';
  return `あと${diff}日`;
}

export default function ParticipantHome() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      const response = await axios.get('/api/participant/auctions');
      if (response.data.success) {
        setAuctions(response.data.data.auctions);
      }
    } catch (err) {
      console.error('オークション取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const liveAuction = auctions.find(a => a.status === 'live');
  const scheduledAuction = auctions.find(a => a.status === 'scheduled');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  return (
    <Box>
      {/* 開催中のオークション - 大型バナー */}
      {loading ? (
        <Skeleton variant="rectangular" height={160} />
      ) : liveAuction ? (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
            color: 'white',
            py: { xs: 3, md: 4 },
            px: 2,
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: '#ef4444',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                LIVE
              </Box>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                オークション開催中！
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
              {liveAuction.title}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/participant/auction/${liveAuction.id}/live`)}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              今すぐ参加する
            </Button>
          </Container>
        </Box>
      ) : null}

      {/* 次回開催予定 */}
      {loading ? (
        <Container maxWidth="lg" sx={{ pt: 3 }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
        </Container>
      ) : !liveAuction && scheduledAuction ? (
        <Box sx={{ bgcolor: '#f0f7ff', py: { xs: 3, md: 4 }, px: 2 }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EventIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
                次回開催予定
              </Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
              {scheduledAuction.title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <EventIcon fontSize="small" color="action" />
                <Typography variant="body1">{formatDate(scheduledAuction.event_date)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body1">{scheduledAuction.start_time || '未定'}〜</Typography>
              </Box>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  bgcolor: 'primary.main',
                  color: 'white',
                  px: 1.5,
                  py: 0.25,
                  borderRadius: 1,
                  fontWeight: 700,
                  fontSize: '0.875rem',
                }}
              >
                {getDaysUntil(scheduledAuction.event_date)}
              </Box>
            </Box>
            {scheduledAuction.description && (
              <Typography variant="body2" color="text.secondary">
                {scheduledAuction.description}
              </Typography>
            )}
          </Container>
        </Box>
      ) : liveAuction && scheduledAuction ? (
        <Container maxWidth="lg" sx={{ pt: 3 }}>
          <Card sx={{ border: '1px solid', borderColor: 'primary.100' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EventIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
                  次回開催予定
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                {scheduledAuction.title}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(scheduledAuction.event_date)} {scheduledAuction.start_time || '未定'}〜
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.75,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {getDaysUntil(scheduledAuction.event_date)}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Container>
      ) : !liveAuction && !scheduledAuction && !loading ? (
        <Container maxWidth="lg" sx={{ pt: 3 }}>
          <Card sx={{ bgcolor: 'grey.50' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <GavelIcon sx={{ fontSize: 40, color: 'grey.400', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                現在開催中のオークションはありません
              </Typography>
              <Typography variant="body2" color="text.secondary">
                次回開催が決まり次第お知らせします
              </Typography>
            </CardContent>
          </Card>
        </Container>
      ) : null}

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* お知らせ */}
        <Box sx={{ mb: 5 }}>
          <AnnouncementList title="お知らせ" />
        </Box>

        {/* 広告 */}
        {sponsoredAds.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Card
              sx={{
                bgcolor: '#FAFAFA',
                border: '1px solid',
                borderColor: 'grey.200',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  color: 'text.secondary',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                SPONSORED
              </Box>
              <CardContent sx={{ p: 2.5 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={3}>
                    <Box
                      component="img"
                      src={sponsoredAds[0].image_url}
                      alt={sponsoredAds[0].title}
                      sx={{ width: '100%', maxWidth: 120, height: 'auto', borderRadius: 1.5 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {sponsoredAds[0].title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                      {sponsoredAds[0].description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        提供: {sponsoredAds[0].advertiser}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                        href={sponsoredAds[0].link_url}
                        target="_blank"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        詳しく見る
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}
      </Container>
    </Box>
  );
}

