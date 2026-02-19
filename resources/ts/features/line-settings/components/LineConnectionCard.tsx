import React from 'react';
import { Card, CardContent, Box, Typography, Button, Avatar, Chip, CircularProgress } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lineApi } from '@/api/participant/lineApi';

const LINE_STATUS_KEY = ['line-status'] as const;

export const LineConnectionCard = () => {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: LINE_STATUS_KEY,
    queryFn: lineApi.getStatus,
    staleTime: 60_000,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const url = await lineApi.getRedirectUrl();
      window.location.href = url;
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: lineApi.unlink,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LINE_STATUS_KEY }),
  });

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="img" src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg"
            alt="LINE" sx={{ width: 24, height: 24 }} />
          LINE連携
        </Typography>

        {status?.linked ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
              {status.picture_url && <Avatar src={status.picture_url} sx={{ width: 40, height: 40 }} />}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="bold">{status.display_name || 'LINE ユーザー'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  連携日: {status.linked_at ? new Date(status.linked_at).toLocaleDateString('ja-JP') : '-'}
                </Typography>
              </Box>
              <Chip label="連携済み" color="success" size="small" />
            </Box>
            <Button variant="outlined" color="error" size="small" onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}>
              連携解除
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              LINEと連携すると、落札通知やオークション開始通知をLINEで受け取れます。
            </Typography>
            <Button variant="contained" color="success" onClick={() => linkMutation.mutate()}
              disabled={linkMutation.isPending}
              sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#05B04C' } }}>
              {linkMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'LINEと連携する'}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
