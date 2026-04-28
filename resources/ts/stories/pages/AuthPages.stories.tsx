import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Paper, TextField, Button, Divider, Link, Checkbox, FormControlLabel, Alert, Stack, CircularProgress } from '@mui/material';
import { Google, Smartphone, MailOutline, LockReset } from '@mui/icons-material';

const meta: Meta = { title: 'Pages/認証', tags: ['autodocs'] };
export default meta;

const AuthShell: React.FC<{ children: React.ReactNode; maxWidth?: number }> = ({ children, maxWidth = 440 }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', bgcolor: 'grey.50' }}>
    <Paper sx={{ p: 4, maxWidth, width: '100%' }}>{children}</Paper>
  </Box>
);

/** ログイン */
export const Login: StoryObj = {
  name: 'ログイン',
  render: () => (
    <AuthShell>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>ログイン</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>オークションに参加するにはログインが必要です</Typography>
      <Stack spacing={2}>
        <TextField label="メールアドレス" type="email" fullWidth />
        <TextField label="パスワード" type="password" fullWidth />
        <FormControlLabel control={<Checkbox />} label="ログイン状態を維持する" />
        <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>ログイン</Button>
        <Divider>または</Divider>
        <Button variant="outlined" size="large" fullWidth startIcon={<Google />}>Googleでログイン</Button>
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="#" variant="body2">パスワードを忘れた方</Link>
        <Link href="#" variant="body2">新規登録</Link>
      </Box>
    </AuthShell>
  ),
};

/** 新規登録 */
export const Register: StoryObj = {
  name: '新規登録',
  render: () => (
    <AuthShell>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>新規登録</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>アカウントを作成してオークションに参加しましょう</Typography>
      <Stack spacing={2}>
        <TextField label="お名前" fullWidth required />
        <TextField label="メールアドレス" type="email" fullWidth required />
        <TextField label="パスワード" type="password" fullWidth required helperText="8文字以上" />
        <TextField label="パスワード（確認）" type="password" fullWidth required />
        <FormControlLabel control={<Checkbox />} label={<Typography variant="body2">利用規約・プライバシーポリシーに同意する</Typography>} />
        <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>登録する</Button>
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" align="center">
        すでにアカウントをお持ちの方は<Link href="#">ログイン</Link>
      </Typography>
    </AuthShell>
  ),
};

/** パスワード再設定リクエスト */
export const ForgotPassword: StoryObj = {
  name: 'パスワード再設定リクエスト',
  render: () => (
    <AuthShell>
      <Box sx={{ textAlign: 'center', mb: 2 }}><MailOutline color="primary" sx={{ fontSize: 48 }} /></Box>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>パスワードを忘れた方</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>登録メールアドレス宛に再設定用のリンクをお送りします</Typography>
      <Stack spacing={2}>
        <TextField label="メールアドレス" type="email" fullWidth required />
        <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>送信</Button>
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" align="center"><Link href="#">ログイン画面に戻る</Link></Typography>
    </AuthShell>
  ),
};

/** パスワード再設定 */
export const ResetPassword: StoryObj = {
  name: 'パスワード再設定',
  render: () => (
    <AuthShell>
      <Box sx={{ textAlign: 'center', mb: 2 }}><LockReset color="primary" sx={{ fontSize: 48 }} /></Box>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>パスワードを再設定</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>新しいパスワードを設定してください</Typography>
      <Stack spacing={2}>
        <TextField label="新しいパスワード" type="password" fullWidth required helperText="8文字以上" />
        <TextField label="新しいパスワード（確認）" type="password" fullWidth required />
        <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>パスワードを更新</Button>
      </Stack>
    </AuthShell>
  ),
};

/** 初回パスワード設定 */
export const SetPassword: StoryObj = {
  name: '初回パスワード設定',
  render: () => (
    <AuthShell>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>パスワードを設定</Typography>
      <Alert severity="info" sx={{ mb: 3 }}>初めてご利用の方はパスワードを設定してください</Alert>
      <Stack spacing={2}>
        <TextField label="メールアドレス" type="email" fullWidth disabled defaultValue="user@example.com" />
        <TextField label="パスワード" type="password" fullWidth required helperText="8文字以上" />
        <TextField label="パスワード（確認）" type="password" fullWidth required />
        <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>設定する</Button>
      </Stack>
    </AuthShell>
  ),
};

/** 2要素認証 */
export const TwoFactorVerify: StoryObj = {
  name: '2要素認証',
  render: () => (
    <AuthShell>
      <Box sx={{ textAlign: 'center', mb: 2 }}><Smartphone color="primary" sx={{ fontSize: 48 }} /></Box>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>2要素認証</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>認証アプリに表示された6桁のコードを入力してください</Typography>
      <Stack spacing={2}>
        <TextField label="認証コード" fullWidth required inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' } }} />
        <Button variant="contained" size="large" fullWidth sx={{ py: 1.5 }}>認証</Button>
        <Button size="small">バックアップコードを使用</Button>
      </Stack>
    </AuthShell>
  ),
};

/** Google認証コールバック */
export const GoogleCallback: StoryObj = {
  name: 'Google認証コールバック',
  render: () => (
    <AuthShell>
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6" fontWeight="bold">Googleアカウントで認証しています...</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>このページを閉じないでください</Typography>
      </Box>
    </AuthShell>
  ),
};
