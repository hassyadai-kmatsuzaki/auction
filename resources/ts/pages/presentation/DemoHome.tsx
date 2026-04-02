/**
 * デモ共通ホーム画面
 * 実際の Home.tsx と同じデザインを再現
 */
import {
  Box, Container, Typography, Button, Card, CardContent, Grid, Chip, Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  ArrowForward as ArrowForwardIcon,
  ListAlt as ListAltIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  MOCK_AUCTIONS, MOCK_ANNOUNCEMENTS,
  getDaysUntil, formatDate, formatDateTime,
} from './mockData';

interface DemoHomeProps {
  onGoToItems: () => void;
  onGoToWaitingRoom?: () => void;
  /** ガイドモードの場合にステップ案内を表示 */
  isGuided?: boolean;
}

// 広告データ（実際のHome.tsxと同じ構造）
const sponsoredAds = [
  {
    id: 1,
    title: '高品質メダカ用飼料「極」新発売！',
    description: '色揚げ効果抜群！プロブリーダー推奨の最高級飼料。今なら初回購入20%OFF',
    image_url: '/img/noimage.png',
    link_url: 'https://example.com/feed',
    advertiser: 'メダカフード株式会社',
  },
];

export function DemoHome({ onGoToItems, onGoToWaitingRoom, isGuided = false }: DemoHomeProps) {
  const auction = MOCK_AUCTIONS[0];

  return (
    <Box>
      {/* 次回開催予定 - 実際のHome.tsxと同じスタイル */}
      <Box sx={{ bgcolor: '#f0f7ff', py: { xs: 3, md: 4 }, px: 2 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <EventIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
              次回開催予定
            </Typography>
          </Box>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
            {auction.title}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <EventIcon fontSize="small" color="action" />
              <Typography variant="body1">{formatDate(auction.event_date)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AccessTimeIcon fontSize="small" color="action" />
              <Typography variant="body1">{auction.start_time || '未定'}〜</Typography>
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
              {getDaysUntil(auction.event_date)}
            </Box>
          </Box>
          {auction.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {auction.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={onGoToWaitingRoom}
              sx={{
                fontWeight: 700,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
              }}
            >
              待機室へ入室
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<ListAltIcon />}
              onClick={onGoToItems}
              sx={{
                fontWeight: 700,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
              }}
            >
              出品一覧
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Guide tooltip (only for guided mode) */}
        {isGuided && (
          <Alert severity="info" icon={<ArrowForwardIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold">ガイド付きデモ: ステップ 1/5</Typography>
            <Typography variant="body2">
              まずはオークションのホーム画面です。「出品一覧」ボタンを押して、出品されている商品を確認しましょう。
            </Typography>
          </Alert>
        )}

        {/* お知らせ - 実際のHome.tsxと同じAnnouncementListスタイル */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            お知らせ
          </Typography>
          {MOCK_ANNOUNCEMENTS.slice(0, 3).map((a) => (
            <Card key={a.id} sx={{ mb: 1.5, border: a.is_important ? 2 : 0, borderColor: 'error.main' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {a.is_important && <Chip label="重要" size="small" color="error" />}
                  <Typography variant="caption" color="text.secondary">{formatDateTime(a.published_at)}</Typography>
                </Box>
                <Typography variant="subtitle2" fontWeight="bold">{a.title}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* 広告 - 実際のHome.tsxと同じスタイル */}
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
