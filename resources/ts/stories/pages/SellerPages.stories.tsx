import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider, TextField, Stepper, Step, StepLabel, Alert } from '@mui/material';
import { Gavel, EmojiEvents, AttachMoney, Inventory, ArrowForward, CloudUpload } from '@mui/icons-material';

const meta: Meta = { title: 'Pages/出品者', tags: ['autodocs'] };
export default meta;

/** 出品者ダッシュボード */
export const Dashboard: StoryObj = {
  name: 'ダッシュボード',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>出品者ダッシュボード</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: '出品中', value: '23', icon: <Inventory sx={{ color: '#3B82F6' }} /> },
          { label: '落札済み', value: '45', icon: <EmojiEvents sx={{ color: '#F59E0B' }} /> },
          { label: '売上合計', value: '¥856,000', icon: <AttachMoney sx={{ color: '#059669' }} /> },
          { label: '次回オークション', value: '4/3', icon: <Gavel sx={{ color: '#6366F1' }} /> },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>{s.icon}<Box><Typography variant="caption" color="text.secondary">{s.label}</Typography><Typography variant="h5" fontWeight="bold">{s.value}</Typography></Box></CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>直近の出品</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>品種名</TableCell><TableCell align="right">開始価格</TableCell><TableCell>ステータス</TableCell></TableRow></TableHead>
          <TableBody>
            {[{ no: 1, name: '幹之メダカ（フルボディ）', price: 3000, status: '落札済み' }, { no: 2, name: '三色ラメ幹之', price: 5000, status: '出品中' }, { no: 3, name: '楊貴妃', price: 2000, status: '不成立' }].map((item) => (
              <TableRow key={item.no}><TableCell>{item.no}</TableCell><TableCell>{item.name}</TableCell><TableCell align="right">¥{item.price.toLocaleString()}</TableCell>
                <TableCell><Chip label={item.status} size="small" color={item.status === '落札済み' ? 'success' : item.status === '出品中' ? 'primary' : 'default'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 出品申請 */
export const SubmitItem: StoryObj = {
  name: '出品申請',
  render: () => (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>出品申請</Typography>
      <Stepper activeStep={0} sx={{ mb: 4 }}>
        {['基本情報', '個体情報', '確認'].map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>基本情報</Typography>
        <Alert severity="info" sx={{ mb: 3 }}>画像・動画は管理者側で一括撮影いたしますので、アップロードは不要です。</Alert>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="品種名" fullWidth required placeholder="例: 幹之メダカ（フルボディ）" />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label="匹数" type="number" fullWidth required defaultValue={1} /></Grid>
            <Grid item xs={6}><TextField label="開始価格" type="number" fullWidth required InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography> }} /></Grid>
          </Grid>
          <TextField label="個体情報・詳細説明" fullWidth multiline rows={4} helperText="管理者入力時の参考にいたします（買受者に表示を保証するものではありません）" />
        </Box>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" size="large">次へ</Button></Box>
      </Paper>
    </Box>
  ),
};
