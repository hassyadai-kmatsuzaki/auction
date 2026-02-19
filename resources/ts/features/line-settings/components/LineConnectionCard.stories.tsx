import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Card, CardContent, Typography, Box, Button, Avatar, Chip, Alert, Switch, List, ListItem, ListItemText, Divider } from '@mui/material';

const meta: Meta = { title: 'LINE連携/Components', tags: ['autodocs'] };
export default meta;

export const Connected: StoryObj = {
  name: '連携済み',
  render: () => (
    <Card sx={{ maxWidth: 480 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>📱 LINE連携</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: '#06C755' }}>M</Avatar>
          <Box sx={{ flex: 1 }}><Typography variant="body2" fontWeight="bold">松崎 光平</Typography><Typography variant="caption" color="text.secondary">連携日: 2026/02/19</Typography></Box>
          <Chip label="連携済み" color="success" size="small" />
        </Box>
        <Button variant="outlined" color="error" size="small">連携解除</Button>
      </CardContent>
    </Card>
  ),
};

export const NotConnected: StoryObj = {
  name: '未連携',
  render: () => (
    <Card sx={{ maxWidth: 480 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>📱 LINE連携</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          LINEと連携すると、落札通知やオークション開始通知をLINEで受け取れます。
        </Typography>
        <Button variant="contained" sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#05B04C' } }}>
          LINEと連携する
        </Button>
      </CardContent>
    </Card>
  ),
};

export const NotificationSettings: StoryObj = {
  name: '通知設定',
  render: () => {
    const items = [
      { label: 'オークション開始通知', on: true },
      { label: '落札通知', on: true },
      { label: '入金催促', on: true },
      { label: '発送完了通知', on: false },
      { label: 'オークション予告（前日）', on: true },
      { label: '指値発動通知', on: true },
      { label: '新規オークション通知', on: false },
      { label: 'お気に入り順番接近通知', on: true },
    ];
    return (
      <Card sx={{ maxWidth: 480 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>📩 LINE通知設定</Typography>
          <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
            <Typography variant="caption">LINE連携後、受け取りたい通知を選択できます。</Typography>
          </Alert>
          <List disablePadding>
            {items.map((n, i) => (
              <React.Fragment key={n.label}>
                {i > 0 && <Divider />}
                <ListItem sx={{ px: 0 }}>
                  <ListItemText primary={n.label} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                  <Switch checked={n.on} size="small" color="success" />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  },
};
