import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Typography, Container, Card, CardContent, Button, Grid, Paper, Chip, Stack, Avatar,
  IconButton, List, ListItem, ListItemText, Divider, Alert, LinearProgress,
} from '@mui/material';
import {
  PlayArrow, AutoAwesome, MeetingRoom, Favorite, Home as HomeIcon, ViewModule,
  ArrowForward, ArrowBack, Lightbulb, EmojiEvents, Star, Timer,
} from '@mui/icons-material';

const meta: Meta = { title: 'Pages/プレゼンテーション・デモ', tags: ['autodocs'] };
export default meta;

/** プレゼンテーションエントリー */
export const Presentation: StoryObj = {
  name: 'プレゼンテーション エントリー',
  render: () => (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', display: 'flex', alignItems: 'center', py: 4 }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" fontWeight="bold" gutterBottom>Auction Port</Typography>
          <Typography variant="h6" sx={{ opacity: 0.8 }}>本物のオークション体験を、いますぐ。</Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.95)', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Lightbulb color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h5" fontWeight="bold" gutterBottom>ガイド付きデモ</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ホーム → 出品一覧 → 待機室 → オークション → 落札管理を、説明付きで体験できます
                </Typography>
                <Button variant="contained" fullWidth size="large" startIcon={<PlayArrow />}>ガイド付きデモを開始</Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.95)', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <AutoAwesome color="warning" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h5" fontWeight="bold" gutterBottom>ガイドなしデモ</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  2レーン × 3匹、CPU10人によるリアルなオークションを自由に体験
                </Typography>
                <Button variant="outlined" fullWidth size="large" startIcon={<PlayArrow />}>フリーモードを開始</Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  ),
};

/** デモモードセレクター */
export const DemoModeSelector: StoryObj = {
  name: 'デモモード選択',
  render: () => (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>体験モードを選択</Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>初めての方はガイド付きデモがおすすめです</Typography>
      <Grid container spacing={3}>
        {[
          { i: <Lightbulb />, t: 'ガイド付き', d: '操作を順番に体験', primary: true },
          { i: <AutoAwesome />, t: 'フリーモード', d: '自由に操作', primary: false },
        ].map((m) => (
          <Grid item xs={12} md={6} key={m.t}>
            <Card sx={{ height: '100%', border: m.primary ? '2px solid' : '1px solid', borderColor: m.primary ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: m.primary ? 'primary.main' : 'grey.300' }}>{m.i}</Avatar>
                <Typography variant="h6" fontWeight="bold">{m.t}</Typography>
                <Typography variant="body2" color="text.secondary">{m.d}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  ),
};

/** デモレイアウト */
export const DemoLayout: StoryObj = {
  name: 'デモレイアウト',
  render: () => (
    <Box>
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'primary.main', color: 'white', py: 1, px: 2, display: 'flex', alignItems: 'center', gap: 2, zIndex: 10 }}>
        <Chip label="DEMO" color="warning" size="small" />
        <Typography variant="body2" sx={{ flex: 1 }}>ガイド付きデモ - ホーム画面</Typography>
        <Button size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }} startIcon={<ArrowBack />}>戻る</Button>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h5" fontWeight="bold">デモコンテンツがここに表示されます</Typography>
        <Typography variant="body2" color="text.secondary">画面上部にはデモ進行用のヘッダーが固定表示されます</Typography>
      </Container>
    </Box>
  ),
};

/** デモホーム */
export const DemoHome: StoryObj = {
  name: 'デモ - ホーム',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Alert severity="info" sx={{ mb: 3 }} icon={<Lightbulb />}>
        <Typography variant="body2"><strong>STEP 1/5:</strong> オークションのホーム画面です。「参加する」ボタンから次に進みましょう。</Typography>
      </Alert>
      <Card sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)', color: 'white', mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Chip label="LIVE" color="error" size="small" sx={{ mb: 1 }} />
          <Typography variant="h4" fontWeight="bold">第17回 大感謝祭オークション</Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>2026/02/19 14:00〜</Typography>
          <Button variant="contained" sx={{ mt: 2, bgcolor: 'white', color: 'primary.main' }} endIcon={<ArrowForward />}>参加する</Button>
        </CardContent>
      </Card>
    </Container>
  ),
};

/** デモ - 出品一覧 */
export const DemoItemList: StoryObj = {
  name: 'デモ - 出品一覧',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Alert severity="info" sx={{ mb: 3 }} icon={<Lightbulb />}>
        <Typography variant="body2"><strong>STEP 2/5:</strong> 出品一覧です。気になる出品はハートアイコンでお気に入りに追加できます。</Typography>
      </Alert>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>出品一覧（{6}件）</Typography>
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid item xs={6} md={4} key={i}>
            <Card>
              <Box sx={{ position: 'relative', aspectRatio: '4/3', bgcolor: 'grey.200' }}>
                <IconButton sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.85)' }}><Favorite color={i % 2 === 0 ? 'error' : 'disabled'} /></IconButton>
              </Box>
              <CardContent><Typography variant="subtitle2" fontWeight="bold">サンプル {i}</Typography><Typography variant="h6" color="primary.main">¥{(i * 5000).toLocaleString()}</Typography></CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  ),
};

/** デモ - お気に入り */
export const DemoFavorites: StoryObj = {
  name: 'デモ - お気に入り',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Alert severity="info" sx={{ mb: 3 }} icon={<Lightbulb />}>
        <Typography variant="body2"><strong>STEP 3/5:</strong> お気に入りに追加した出品はここから確認できます。当日に向けて注目銘柄をまとめましょう。</Typography>
      </Alert>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><Favorite color="error" /> お気に入り</Typography>
      <Grid container spacing={2}>
        {[1, 2, 3].map((i) => (
          <Grid item xs={12} sm={4} key={i}>
            <Card>
              <Box sx={{ aspectRatio: '1/1', bgcolor: 'grey.200' }} />
              <CardContent><Typography variant="subtitle1" fontWeight="bold">お気に入り{i}</Typography><Typography variant="h6" color="primary.main">¥{(i * 8000).toLocaleString()}</Typography></CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  ),
};

/** デモ - 待機室 */
export const DemoWaitingRoom: StoryObj = {
  name: 'デモ - 待機室',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Alert severity="info" sx={{ mb: 3 }} icon={<Lightbulb />}>
        <Typography variant="body2"><strong>STEP 4/5:</strong> 待機室で開始時刻を待ちます。開始と同時にライブオークション画面に切り替わります。</Typography>
      </Alert>
      <Card sx={{ bgcolor: 'primary.50', textAlign: 'center', py: 6 }}>
        <CardContent>
          <MeetingRoom sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" fontWeight="bold" color="primary.main">待機室</Typography>
          <Typography variant="body1" sx={{ mt: 1, mb: 3 }}>第17回 大感謝祭オークション</Typography>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: 'white', px: 3, py: 1.5, borderRadius: 2 }}>
            <Timer color="primary" />
            <Typography variant="h5" fontWeight="bold">開始まで 00:05:23</Typography>
          </Box>
          <LinearProgress variant="determinate" value={70} sx={{ mt: 3, height: 8, borderRadius: 1 }} />
        </CardContent>
      </Card>
    </Container>
  ),
};

/** デモ - ガイド付き */
export const GuidedDemo: StoryObj = {
  name: 'デモ - ガイド付き',
  render: () => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 1, px: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip label="ガイド付きデモ" color="warning" size="small" />
        <Typography variant="body2">STEP 2/5: 出品一覧</Typography>
        <Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={40} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} /></Box>
        <Button size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }}>スキップ</Button>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Card sx={{ p: 3, mb: 3, border: '2px solid', borderColor: 'warning.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'warning.main' }}><Lightbulb /></Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">気になる出品をお気に入りに追加してみましょう</Typography>
              <Typography variant="body2" color="text.secondary">右上のハートアイコンをクリックすると追加されます</Typography>
            </Box>
            <Button variant="contained" endIcon={<ArrowForward />}>次へ</Button>
          </Box>
        </Card>
      </Container>
    </Box>
  ),
};

/** デモ - フリーモード */
export const FreeDemo: StoryObj = {
  name: 'デモ - フリーモード',
  render: () => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 1, px: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip label="フリーモード" color="warning" size="small" />
        <Typography variant="body2">CPU 10人と入札中 - 第○回 デモオークション</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }}>終了</Button>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={2}>
          {[1, 2].map((lane) => (
            <Grid item xs={12} md={6} key={lane}>
              <Card sx={{ border: lane === 1 ? '3px solid' : '1px solid', borderColor: lane === 1 ? 'success.main' : 'divider' }}>
                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5, fontWeight: 'bold', textAlign: 'center' }}>レーン {lane}</Box>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold">サンプル生体 {lane}</Typography>
                  <Typography variant="caption" color="text.secondary">現在単価</Typography>
                  <Typography variant="h3" color="primary.main" fontWeight="bold">¥{(lane * 25000).toLocaleString()}</Typography>
                  <Chip label={`残り ${lane * 2}秒`} color={lane === 1 ? 'error' : 'warning'} sx={{ mt: 1 }} />
                  <Button variant={lane === 1 ? 'contained' : 'outlined'} fullWidth size="large" sx={{ mt: 2 }}>{lane === 1 ? '入札中' : '入札する'}</Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  ),
};

/** デモ - 落札後ガイド */
export const PostAuctionGuide: StoryObj = {
  name: 'デモ - 落札後ガイド',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card sx={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', mb: 3 }}>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          <EmojiEvents sx={{ fontSize: 80, color: 'warning.main', mb: 1 }} />
          <Typography variant="h4" fontWeight="bold" color="warning.dark">落札おめでとうございます！</Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>3件の落札がありました</Typography>
        </CardContent>
      </Card>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>落札後の流れ</Typography>
      <List component={Paper}>
        {[
          { step: 1, t: '請求書の確認', d: '管理者が請求書を発行します' },
          { step: 2, t: '入金', d: '指定の口座に振込（3営業日以内）' },
          { step: 3, t: '配送先確認', d: '管理画面で配送先を確認' },
          { step: 4, t: '商品到着', d: '入金確認後、5営業日以内に発送' },
        ].map((s) => (
          <ListItem key={s.step} divider>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>{s.step}</Avatar>
            <ListItemText primary={s.t} secondary={s.d} primaryTypographyProps={{ fontWeight: 'bold' }} />
          </ListItem>
        ))}
      </List>
    </Container>
  ),
};
