import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Paper, TextField, Button, Divider, Link, Checkbox, FormControlLabel } from '@mui/material';

const meta: Meta = { title: 'Pages/認証', tags: ['autodocs'] };
export default meta;

/** ログイン */
export const Login: StoryObj = {
  name: 'ログイン',
  render: () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', bgcolor: 'grey.50' }}>
      <Paper sx={{ p: 4, maxWidth: 440, width: '100%' }}>
        <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>ログイン</Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>オークションに参加するにはログインが必要です</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="メールアドレス" type="email" fullWidth />
          <TextField label="パスワード" type="password" fullWidth />
          <FormControlLabel control={<Checkbox />} label="ログイン状態を維持する" />
          <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>ログイン</Button>
        </Box>
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Link href="#" variant="body2">パスワードを忘れた方</Link>
          <Link href="#" variant="body2">新規登録</Link>
        </Box>
      </Paper>
    </Box>
  ),
};

/** 新規登録 */
export const Register: StoryObj = {
  name: '新規登録',
  render: () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', bgcolor: 'grey.50' }}>
      <Paper sx={{ p: 4, maxWidth: 440, width: '100%' }}>
        <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>新規登録</Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>アカウントを作成してオークションに参加しましょう</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="お名前" fullWidth required />
          <TextField label="メールアドレス" type="email" fullWidth required />
          <TextField label="パスワード" type="password" fullWidth required helperText="8文字以上" />
          <TextField label="パスワード（確認）" type="password" fullWidth required />
          <FormControlLabel control={<Checkbox />} label={<Typography variant="body2">利用規約・プライバシーポリシーに同意する</Typography>} />
          <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>登録する</Button>
        </Box>
        <Divider sx={{ my: 3 }} />
        <Typography variant="body2" align="center">
          すでにアカウントをお持ちの方は<Link href="#">ログイン</Link>
        </Typography>
      </Paper>
    </Box>
  ),
};
