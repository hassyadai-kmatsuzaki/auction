import { useEffect, useState } from 'react';
import {
  Box, Typography, Rating, Chip, Paper, List, ListItem,
  ListItemText, ListItemAvatar, Avatar, Divider, CircularProgress,
} from '@mui/material';
import { Star, ThumbUp, ThumbDown, Remove } from '@mui/icons-material';
import axios from '../../lib/axios';

interface ReviewSummary {
  total: number;
  average: number | null;
  positive: number;
  neutral: number;
  negative: number;
  recent_reviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    role: string;
    created_at: string;
    reviewer: { id: number; name: string };
  }>;
}

interface UserReviewSummaryProps {
  userId: number;
  compact?: boolean;
}

export default function UserReviewSummary({ userId, compact = false }: UserReviewSummaryProps) {
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/participant/reviews/user/${userId}`)
      .then(res => setData(res.data.data))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <CircularProgress size={20} />;
  if (!data || data.total === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        まだ評価がありません
      </Typography>
    );
  }

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Rating value={data.average} precision={0.1} size="small" readOnly />
        <Typography variant="body2">
          {data.average} ({data.total}件)
        </Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold">{data.average}</Typography>
          <Rating value={data.average} precision={0.1} readOnly />
          <Typography variant="body2" color="text.secondary">{data.total}件の評価</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip icon={<ThumbUp />} label={`良い ${data.positive}`} color="success" size="small" variant="outlined" />
          <Chip icon={<Remove />} label={`普通 ${data.neutral}`} size="small" variant="outlined" />
          <Chip icon={<ThumbDown />} label={`悪い ${data.negative}`} color="error" size="small" variant="outlined" />
        </Box>
      </Box>

      {data.recent_reviews.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>最近の評価</Typography>
          <List dense>
            {data.recent_reviews.map((review) => (
              <ListItem key={review.id} disablePadding sx={{ mb: 1 }}>
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                    {review.reviewer.name.charAt(0)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{review.reviewer.name}</Typography>
                      <Rating value={review.rating} size="small" readOnly />
                      <Chip
                        label={review.role === 'buyer' ? '購入者' : '出品者'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={review.comment}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Paper>
  );
}
