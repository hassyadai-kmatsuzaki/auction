/**
 * デモ共通ホーム画面
 * ガイド付き・ガイドなし両方で使用
 */
import {
  Box, Container, Typography, Button, Card, CardContent, Chip, Stack, Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  ArrowForward as ArrowForwardIcon,
  Announcement as AnnouncementIcon,
} from '@mui/icons-material';
import {
  MOCK_AUCTIONS, MOCK_ANNOUNCEMENTS,
  getDaysUntil, formatDate, formatDateTime,
} from './mockData';

interface DemoHomeProps {
  onGoToItems: () => void;
  /** ガイドモードの場合にステップ案内を表示 */
  isGuided?: boolean;
}

export function DemoHome({ onGoToItems, isGuided = false }: DemoHomeProps) {
  const auction = MOCK_AUCTIONS[0];

  return (
    <Box>
      {/* Next auction banner */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
        color: 'white', py: { xs: 3, md: 4 }, px: 2,
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <EventIcon />
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>開催予定オークション</Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {auction.title}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {formatDate(auction.event_date)} {auction.start_time}〜
            </Typography>
            <Chip label={getDaysUntil(auction.event_date)} size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} />
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>{auction.description}</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />}
              onClick={onGoToItems}
              sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, '&:hover': { bgcolor: 'grey.100' } }}>
              出品一覧を見る
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pt: 3 }}>
        {/* Guide tooltip (only for guided mode) */}
        {isGuided && (
          <Alert severity="info" icon={<ArrowForwardIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold">ガイド付きデモ: ステップ 1/5</Typography>
            <Typography variant="body2">
              まずはオークションのホーム画面です。「出品一覧を見る」ボタンを押して、出品されている商品を確認しましょう。
            </Typography>
          </Alert>
        )}

        {/* Announcements */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnnouncementIcon />
            お知らせ
          </Typography>
          <Stack spacing={2}>
            {MOCK_ANNOUNCEMENTS.slice(0, 3).map((a) => (
              <Card key={a.id} sx={{ border: a.is_important ? 2 : 0, borderColor: 'error.main' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {a.is_important && <Chip label="重要" size="small" color="error" />}
                    <Typography variant="caption" color="text.secondary">{formatDateTime(a.published_at)}</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold">{a.title}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
