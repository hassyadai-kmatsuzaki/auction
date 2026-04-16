import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Rating, TextField, Typography, Alert, Box,
} from '@mui/material';
import axios from '../../lib/axios';

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  wonItemId: number;
  targetName: string;
  onSubmitted?: () => void;
}

export default function ReviewDialog({ open, onClose, wonItemId, targetName, onSubmitted }: ReviewDialogProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/participant/reviews', {
        won_item_id: wonItemId,
        rating,
        comment: comment || undefined,
      });
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '評価の送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>取引の評価</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {targetName} さんとの取引を評価してください
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Rating
            value={rating}
            onChange={(_, value) => setRating(value)}
            size="large"
          />
          <Typography variant="caption" color="text.secondary">
            {rating === 1 && '非常に悪い'}
            {rating === 2 && '悪い'}
            {rating === 3 && '普通'}
            {rating === 4 && '良い'}
            {rating === 5 && '非常に良い'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="コメント（任意）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            inputProps={{ maxLength: 500 }}
            helperText={`${comment.length}/500`}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!rating || loading}>
          {loading ? '送信中...' : '評価を送信'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
