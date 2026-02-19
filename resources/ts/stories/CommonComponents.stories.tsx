import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Chip, Divider, Badge, IconButton, Avatar, Button, Card, CardContent, Menu, MenuItem } from '@mui/material';
import { Notifications, Help, SwapHoriz, Gavel, Event, AttachMoney, Announcement } from '@mui/icons-material';

const meta: Meta = { title: 'Common/Components', tags: ['autodocs'] };
export default meta;

/** お知らせリスト */
export const AnnouncementListExample: StoryObj = {
  name: 'お知らせリスト',
  render: () => {
    const items = [
      { id: 1, title: '第18回 春の特別オークション開催のお知らせ', published_at: '2026-02-19', is_important: true },
      { id: 2, title: 'システムメンテナンスのお知らせ（2/25）', published_at: '2026-02-18', is_important: false },
      { id: 3, title: '利用規約の改定について', published_at: '2026-02-15', is_important: false },
    ];
    return (
      <Paper sx={{ maxWidth: 480 }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Announcement color="primary" />
          <Typography variant="h6" fontWeight="bold">お知らせ</Typography>
        </Box>
        <Divider />
        <List disablePadding>
          {items.map((item) => (
            <ListItem key={item.id} divider sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <ListItemText
                primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {item.is_important && <Chip label="重要" color="error" size="small" />}
                  <Typography variant="body2">{item.title}</Typography>
                </Box>}
                secondary={item.published_at}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  },
};

/** ヘッダー通知ベル */
export const HeaderNotificationsBell: StoryObj = {
  name: 'ヘッダー通知ベル',
  render: () => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'grey.100', p: 2, borderRadius: 2 }}>
      <Badge badgeContent={3} color="error">
        <IconButton><Notifications /></IconButton>
      </Badge>
      <Badge badgeContent={0}><IconButton><Notifications /></IconButton></Badge>
      <IconButton><Help /></IconButton>
    </Box>
  ),
};

/** ロール切り替え */
export const RoleSwitcherExample: StoryObj = {
  name: 'ロール切り替え',
  render: () => {
    const roles = [
      { name: 'participant', label: '参加者画面' },
      { name: 'seller', label: '出品者画面' },
      { name: 'admin', label: '管理者画面' },
    ];
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'grey.100', p: 2, borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">参加者画面</Typography>
        <IconButton size="small"><SwapHoriz /></IconButton>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {roles.map((r) => (
            <Chip key={r.name} label={r.label} size="small"
              variant={r.name === 'participant' ? 'filled' : 'outlined'}
              color={r.name === 'participant' ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }} />
          ))}
        </Box>
      </Box>
    );
  },
};
