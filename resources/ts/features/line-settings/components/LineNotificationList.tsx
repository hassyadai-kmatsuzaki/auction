import React from 'react';
import { Card, CardContent, Typography, Box, Switch, List, ListItem, ListItemText, Divider, CircularProgress, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lineApi, type LineNotificationSetting } from '@/api/participant/lineApi';

const NOTIFICATIONS_KEY = ['line-notifications'] as const;

export const LineNotificationList = () => {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: lineApi.getNotifications,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (settings: { type: string; is_enabled: boolean }[]) =>
      lineApi.updateNotifications(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });

  const handleToggle = (type: string, currentEnabled: boolean) => {
    if (!notifications) return;
    const updated = notifications.map((n) =>
      n.type === type ? { type: n.type, is_enabled: !currentEnabled } : { type: n.type, is_enabled: n.is_enabled }
    );
    mutation.mutate(updated);
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (!notifications?.length) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>📩 LINE通知設定</Typography>
        <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
          <Typography variant="caption">LINE連携後、受け取りたい通知を選択できます。</Typography>
        </Alert>
        <List disablePadding>
          {notifications.map((n, i) => (
            <React.Fragment key={n.type}>
              {i > 0 && <Divider />}
              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary={n.label}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                />
                <Switch
                  checked={n.is_enabled}
                  onChange={() => handleToggle(n.type, n.is_enabled)}
                  size="small"
                  color="success"
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};
