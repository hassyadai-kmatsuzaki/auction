import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Chip, Paper, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider, IconButton, Badge, Alert, Switch, FormControlLabel, Avatar, TextField, InputAdornment } from '@mui/material';
import { PlayArrow, Pause, Stop, SkipNext, People, FiberManualRecord, Refresh, MeetingRoom, NoMeetingRoom, Gavel, AttachMoney, LocalShipping, Settings, LiveTv, List as ListIcon, Image as ImageIcon, Upload as UploadIcon, Download as DownloadIcon } from '@mui/icons-material';

const meta: Meta = { title: 'Pages/管理者', tags: ['autodocs'] };
export default meta;

/** 管理者ダッシュボード */
export const Dashboard: StoryObj = {
  name: 'ダッシュボード',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>管理者ダッシュボード</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: '開催中オークション', value: '1', color: '#059669' },
          { label: '総出品数', value: '342', color: '#3B82F6' },
          { label: '本日の売上', value: '¥1,245,000', color: '#F59E0B' },
          { label: '登録ユーザー', value: '156', color: '#6366F1' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card><CardContent><Typography variant="caption" color="text.secondary">{s.label}</Typography><Typography variant="h4" fontWeight="bold" sx={{ color: s.color }}>{s.value}</Typography></CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  ),
};

/** ライブコントロール */
export const LiveControl: StoryObj = {
  name: 'ライブコントロール',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box><Typography variant="h4" fontWeight="bold">ライブオークション管理</Typography><Typography variant="body2" color="text.secondary">第17回 大感謝祭オークション</Typography></Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}><IconButton><Refresh /></IconButton><Chip label="LIVE 開催中" color="error" icon={<FiberManualRecord sx={{ fontSize: 12 }} />} /></Box>
      </Box>
      {/* 待機室手動公開パネル */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'success.300' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}><MeetingRoom sx={{ color: 'success.main', fontSize: 28 }} /><Box><Typography variant="subtitle1" fontWeight="bold">待機室の公開状態</Typography><Typography variant="body2" color="text.secondary">現在：手動公開中</Typography></Box></Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}><Button variant="outlined" color="success" disabled startIcon={<MeetingRoom />}>今すぐ公開</Button><Button variant="contained" color="warning" startIcon={<NoMeetingRoom />}>閉鎖に戻す</Button></Box>
          </Box>
        </CardContent>
      </Card>
      {/* コントロールパネル */}
      <Card sx={{ mb: 3 }}><CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2 }}><Button variant="outlined" color="warning" startIcon={<Pause />}>一時停止</Button><Button variant="outlined" color="error" startIcon={<Stop />}>終了</Button></Box>
          <Box sx={{ display: 'flex', gap: 3 }}>{[{ l: '入札中', v: '4', c: '#059669' }, { l: '落札済み', v: '23', c: '#3B82F6' }, { l: '残り', v: '115', c: 'inherit' }].map((s) => (<Box key={s.l} sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h6" fontWeight="bold" sx={{ color: s.c }}>{s.v}</Typography></Box>))}</Box>
        </Box>
      </CardContent></Card>
      {/* レーンカード */}
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card>
              <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5 }}><Typography variant="subtitle1" align="center" fontWeight="bold">レーン {i}</Typography></Box>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">No.{i * 20 + 10}</Typography>
                <Typography variant="subtitle1" fontWeight="bold">サンプル生体 {i}</Typography>
                <Typography variant="h5" color="success.main" fontWeight="bold">¥{(i * 15000).toLocaleString()}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Chip icon={<People sx={{ fontSize: 14 }} />} label={`${i}人入札中`} size="small" color="primary" />
                  <IconButton size="small" color="primary"><SkipNext /></IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  ),
};

/** 生体管理 */
export const ItemManagement: StoryObj = {
  name: '生体管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box><Typography variant="h4" fontWeight="bold">生体管理</Typography><Typography variant="body2" color="text.secondary">第17回 大感謝祭オークション (2026/02/19)</Typography></Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />}>テンプレート</Button>
          <Button variant="outlined" startIcon={<UploadIcon />}>一括インポート</Button>
          <Button variant="outlined" startIcon={<ImageIcon />}>画像一括アップロード</Button>
          <Button variant="contained">新規登録</Button>
        </Box>
      </Box>
    </Box>
  ),
};

/** オークション管理 */
export const AuctionManagement: StoryObj = {
  name: 'オークション管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">オークション管理</Typography><Button variant="contained">新規作成</Button></Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead><TableRow><TableCell>タイトル</TableCell><TableCell>開催日</TableCell><TableCell>ステータス</TableCell><TableCell align="right">出品数</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[{ t: '第17回 大感謝祭', d: '2026/02/19', s: 'live', c: 142 }, { t: '第18回 春の特別', d: '2026/04/03', s: 'scheduled', c: 0 }].map((a) => (
              <TableRow key={a.t}><TableCell>{a.t}</TableCell><TableCell>{a.d}</TableCell><TableCell><Chip label={a.s === 'live' ? '開催中' : '予定'} color={a.s === 'live' ? 'success' : 'primary'} size="small" /></TableCell><TableCell align="right">{a.c}</TableCell><TableCell><Button size="small">詳細</Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** システム設定 */
export const SystemSettings: StoryObj = {
  name: 'システム設定',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Box><Typography variant="h4" fontWeight="bold">システム設定</Typography><Typography variant="body2" color="text.secondary">オークションシステムの各種設定を管理します</Typography></Box><Button variant="contained" size="large">すべて保存</Button></Box>
      <Paper sx={{ mb: 3 }}><Tabs value={0}><Tab icon={<Settings />} iconPosition="start" label="システム" /><Tab icon={<Gavel />} iconPosition="start" label="オークション" /><Tab icon={<AttachMoney />} iconPosition="start" label="料金設定" /><Tab icon={<LocalShipping />} iconPosition="start" label="配送・梱包" /></Tabs></Paper>
      <Card><CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>入札ルール（システムデフォルト）</Typography>
        <Alert severity="info" sx={{ mb: 3 }}>この設定はシステム全体のデフォルト値です。</Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}><TextField fullWidth label="価格上昇率" type="number" value="10" InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} helperText="複数人入札時の上昇率" /></Grid>
          <Grid item xs={12} sm={4}><TextField fullWidth label="カウントダウン（通常）" type="number" value="10" InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }} inputProps={{ step: 0.5 }} helperText="0〜1人入札時" /></Grid>
          <Grid item xs={12} sm={4}><TextField fullWidth label="カウントダウン（競合）" type="number" value="1" InputProps={{ endAdornment: <InputAdornment position="end">秒</InputAdornment> }} inputProps={{ step: 0.5 }} helperText="2人以上入札時" /></Grid>
        </Grid>
      </CardContent></Card>
    </Box>
  ),
};
