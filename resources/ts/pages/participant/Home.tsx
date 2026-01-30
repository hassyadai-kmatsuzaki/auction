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
  Alert,
  Divider,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import type { Auction } from '../../types';
import AnnouncementList from '../../components/AnnouncementList';
import axios from '../../lib/axios';

// 広告データ（将来的にはAPI化）
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
    image_url: '/img/medaka/01.png',
    link_url: 'https://example.com/feed',
    advertiser: 'メダカフード株式会社',
  },
];

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

  // 開催中のオークションを取得
  const liveAuction = auctions.find(a => a.status === 'live');
  // 次回開催予定のオークションを取得
  const scheduledAuction = auctions.find(a => a.status === 'scheduled');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    };
    return date.toLocaleDateString('ja-JP', options);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 開催中のオークション */}
      {loading ? (
        <Skeleton variant="rectangular" height={80} sx={{ mb: 3, borderRadius: 1 }} />
      ) : liveAuction && (
        <Alert
          severity="success"
          icon={<GavelIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(`/participant/auction/${liveAuction.id}/live`)}
            >
              参加する
            </Button>
          }
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            オークション開催中！
          </Typography>
          <Typography variant="body2">
            {liveAuction.title}
          </Typography>
        </Alert>
      )}

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
                    sx={{
                      width: '100%',
                      maxWidth: 120,
                      height: 'auto',
                      borderRadius: 1.5,
                    }}
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

      {/* 次回開催予定 */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="h5" gutterBottom>
          <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          次回開催予定
        </Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 1 }} />
        ) : scheduledAuction ? (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {scheduledAuction.title}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <EventIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      開催日
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ ml: 4 }}>
                    {formatDate(scheduledAuction.event_date)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AccessTimeIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      開始時刻
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ ml: 4 }}>
                    {scheduledAuction.start_time || '未定'}〜
                  </Typography>
                </Grid>
              </Grid>
              {scheduledAuction.description && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    {scheduledAuction.description}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                現在、予定されているオークションはありません。
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
}

