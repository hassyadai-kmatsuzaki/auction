import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Alert,
  Divider,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  Gavel as GavelIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import type { Announcement, Auction } from '../../types';

// Mock データ
const mockAnnouncements: Announcement[] = [
  {
    id: 1,
    title: '11月12日オークション開催のお知らせ',
    content: '本日10:00よりオークションを開催いたします。全120個体の出品を予定しております。',
    is_published: true,
    published_at: '2025-11-11T17:00:00Z',
    priority: 'high',
    created_by: 1,
    is_read: false,
    created_at: '2025-11-11T17:00:00Z',
  },
  {
    id: 2,
    title: 'プレミアムプランのご案内',
    content: '個別撮影による高品質な動画・画像をご覧いただけるプレミアムプランをご用意しております。',
    is_published: true,
    published_at: '2025-11-10T10:00:00Z',
    priority: 'normal',
    created_by: 1,
    is_read: true,
    created_at: '2025-11-10T10:00:00Z',
  },
  {
    id: 3,
    title: 'システムメンテナンスのお知らせ',
    content: '11月15日(水) 2:00-4:00の間、システムメンテナンスを実施いたします。',
    is_published: true,
    published_at: '2025-11-09T10:00:00Z',
    priority: 'low',
    created_by: 1,
    is_read: true,
    created_at: '2025-11-09T10:00:00Z',
  },
];

const mockCurrentAuction: Auction = {
  id: 1,
  title: '2025年11月オークション',
  event_date: '2025-11-12',
  start_time: '10:00:00',
  status: 'live',
  description: '全120個体の出品を予定しております',
  total_items: 120,
};

export default function ParticipantHome() {
  const navigate = useNavigate();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'normal':
        return 'primary';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '重要';
      case 'normal':
        return '通常';
      case 'low':
        return '参考';
      default:
        return '';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 開催中のオークション */}
      {mockCurrentAuction.status === 'live' && (
        <Alert
          severity="success"
          icon={<GavelIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(`/participant/auction/${mockCurrentAuction.id}/live`)}
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
            {mockCurrentAuction.title} - 全{mockCurrentAuction.total_items}個体
          </Typography>
        </Alert>
      )}

      <Typography variant="h4" gutterBottom>
        <CampaignIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        お知らせ
      </Typography>

      <Grid container spacing={3}>
        {mockAnnouncements.map((announcement) => (
          <Grid item xs={12} key={announcement.id}>
            <Card
              sx={{
                bgcolor: !announcement.is_read ? 'action.hover' : 'background.paper',
                border: announcement.priority === 'high' ? 2 : 0,
                borderColor: 'error.main',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Chip
                    label={getPriorityLabel(announcement.priority)}
                    color={getPriorityColor(announcement.priority)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {!announcement.is_read && (
                    <Chip label="未読" color="primary" size="small" sx={{ mr: 1 }} />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(announcement.created_at).toLocaleString('ja-JP')}
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom>
                  {announcement.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {announcement.content}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small">詳細を見る</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 次回開催予定 */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="h5" gutterBottom>
          <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          次回開催予定
        </Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <EventIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    開催日
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ ml: 4 }}>
                  2025年12月10日（水）
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
                  10:00〜
                </Typography>
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              生体数や詳細は追ってお知らせいたします。
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

