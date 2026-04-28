import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Button, Container, Stack } from '@mui/material';
import { ErrorOutline, Block, Home, ArrowBack } from '@mui/icons-material';

const meta: Meta = { title: 'Pages/エラー', tags: ['autodocs'] };
export default meta;

/** 404 - Not Found */
export const NotFound: StoryObj = {
  name: '404 ページが見つかりません',
  render: () => (
    <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
      <ErrorOutline sx={{ fontSize: 96, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h1" fontWeight="bold" color="text.secondary" sx={{ fontSize: '6rem' }}>404</Typography>
      <Typography variant="h5" fontWeight="bold" gutterBottom>ページが見つかりません</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        お探しのページは移動または削除された可能性があります
      </Typography>
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button variant="outlined" startIcon={<ArrowBack />}>戻る</Button>
        <Button variant="contained" startIcon={<Home />}>ホームへ</Button>
      </Stack>
    </Container>
  ),
};

/** 403 - Forbidden */
export const Forbidden: StoryObj = {
  name: '403 アクセス権限がありません',
  render: () => (
    <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
      <Block sx={{ fontSize: 96, color: 'error.main', mb: 2 }} />
      <Typography variant="h1" fontWeight="bold" color="error.main" sx={{ fontSize: '6rem' }}>403</Typography>
      <Typography variant="h5" fontWeight="bold" gutterBottom>アクセスできません</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        このページを閲覧する権限がありません
      </Typography>
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button variant="outlined" startIcon={<ArrowBack />}>戻る</Button>
        <Button variant="contained" startIcon={<Home />}>ホームへ</Button>
      </Stack>
    </Container>
  ),
};
