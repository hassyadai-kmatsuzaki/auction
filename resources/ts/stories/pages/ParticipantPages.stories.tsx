import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardMedia, CardActions,
  Button, Chip, Paper, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Divider, Container, IconButton,
  Alert, CircularProgress,
} from '@mui/material';
import {
  PlayArrow, Gavel, Event, AccessTime, ArrowForward, People,
  EmojiEvents, Timer, MeetingRoom, PriceCheck, Wifi, Refresh,
  Favorite, FavoriteBorder, ViewModule, ArrowBack,
} from '@mui/icons-material';

const meta: Meta = { title: 'Pages/参加者', tags: ['autodocs'] };
export default meta;

/** 参加者ホーム */
export const Home: StoryObj = {
  name: 'ホーム',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>ホーム</Typography>
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlayArrow sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box><Typography variant="h6" fontWeight="bold" color="success.dark">オークション開催中！</Typography><Typography variant="body2" color="text.secondary">第17回 大感謝祭オークション</Typography></Box>
          </Box>
          <Button variant="contained" color="success" size="large" endIcon={<ArrowForward />}>今すぐ参加する</Button>
        </Box>
      </Paper>
      <Grid container spacing={3}>
        {[{ title: '落札数', value: '12', icon: <EmojiEvents color="warning" /> }, { title: '入札中', value: '3', icon: <Gavel color="primary" /> }, { title: '合計金額', value: '¥245,000', icon: <EmojiEvents color="success" /> }].map((s) => (
          <Grid item xs={12} md={4} key={s.title}>
            <Card><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {s.icon}<Box><Typography variant="caption" color="text.secondary">{s.title}</Typography><Typography variant="h5" fontWeight="bold">{s.value}</Typography></Box>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  ),
};

/** オークション一覧 */
export const AuctionList: StoryObj = {
  name: 'オークション一覧',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><Gavel /> オークション一覧</Typography>
      <Paper sx={{ mb: 3 }}><Tabs value={0} variant="fullWidth"><Tab label="開催中・予定 (2)" /><Tab label="開催中 (1)" /><Tab label="予定 (1)" /><Tab label="終了 (25)" /></Tabs></Paper>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '2px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}><Typography variant="h6" fontWeight="bold">第17回 大感謝祭オークション</Typography><Chip icon={<PlayArrow />} label="開催中" color="success" size="small" /></Box>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}><Grid item xs={6}><Box sx={{ display: 'flex', gap: 1 }}><Event fontSize="small" color="primary" /><Box><Typography variant="caption" color="text.secondary">開催日</Typography><Typography variant="body2" fontWeight="bold">2026年2月19日(木)</Typography></Box></Box></Grid><Grid item xs={6}><Box sx={{ display: 'flex', gap: 1 }}><AccessTime fontSize="small" color="primary" /><Box><Typography variant="caption" color="text.secondary">開始時刻</Typography><Typography variant="body2" fontWeight="bold">14:00:00〜</Typography></Box></Box></Grid></Grid>
            </CardContent>
            <CardActions sx={{ p: 3, pt: 0 }}><Button variant="contained" color="success" fullWidth size="large" endIcon={<ArrowForward />}>オークション会場へ</Button></CardActions>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}><Typography variant="h6" fontWeight="bold">第18回 春の特別オークション</Typography><Chip label="開催予定" color="primary" size="small" variant="outlined" /></Box>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}><Grid item xs={6}><Box sx={{ display: 'flex', gap: 1 }}><Event fontSize="small" color="primary" /><Box><Typography variant="caption" color="text.secondary">開催日</Typography><Typography variant="body2" fontWeight="bold">2026年4月3日(金)</Typography></Box></Box></Grid><Grid item xs={6}><Box sx={{ display: 'flex', gap: 1 }}><AccessTime fontSize="small" color="primary" /><Box><Typography variant="caption" color="text.secondary">開始時刻</Typography><Typography variant="body2" fontWeight="bold">13:00:00〜</Typography></Box></Box></Grid></Grid>
            </CardContent>
            <CardActions sx={{ p: 3, pt: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                <Button variant="outlined" size="large" sx={{ flex: 1 }}>出品一覧</Button>
                <Button variant="contained" size="large" startIcon={<MeetingRoom />} sx={{ flex: 1 }}>待機室へ入室</Button>
              </Box>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Container>
  ),
};

/** ライブオークション画面 */
export const AuctionLive: StoryObj = {
  name: 'ライブオークション',
  render: () => (
    <Box sx={{ bgcolor: 'grey.100', minHeight: '100vh' }}>
      <Paper sx={{ p: 2, mb: 2 }}><Container maxWidth="xl"><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box><Typography variant="h5" fontWeight="bold">第17回 大感謝祭オークション</Typography><Typography variant="body2" color="text.secondary">4/6レーン進行中</Typography></Box>
        <Box sx={{ display: 'flex', gap: 1 }}><IconButton><Refresh /></IconButton><Chip label="リアルタイム接続中" color="success" icon={<Wifi />} size="small" /><Chip label="開催中" color="success" icon={<PlayArrow />} /></Box>
      </Box></Container></Paper>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {[
            { lane: 'レーン 1', no: 110, name: 'ニシアフリカトカゲモドキ', price: 25000, seconds: 5, bidders: 0, bidding: false, preBid: true },
            { lane: 'レーン 2', no: 77, name: 'クレステッドゲッコー', price: 35000, seconds: 5, bidders: 2, bidding: true, preBid: false },
            { lane: 'レーン 3', no: 55, name: 'ボールパイソン クラウン', price: 80000, seconds: 1, bidders: 3, bidding: true, preBid: false },
            { lane: 'レーン 4', no: 23, name: 'レオパードゲッコー', price: 15000, seconds: 8, bidders: 1, bidding: false, preBid: false },
          ].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.no}>
              <Card sx={{ border: item.bidding ? 3 : 1, borderColor: item.bidding ? 'success.main' : 'divider' }}>
                <Box sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'primary.main', color: 'white', px: 2, py: 0.5, borderRadius: 1, fontWeight: 'bold', zIndex: 1, fontSize: '0.85rem' }}>{item.lane}</Box>
                <Chip label="プレミアム" color="warning" size="small" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} />
                <Box sx={{ aspectRatio: '3/2', bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}><Typography color="text.secondary">NO IMAGE</Typography></Box>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">No.{item.no}</Typography>
                  <Typography variant="h6" gutterBottom>{item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">現在単価</Typography>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">¥{item.price.toLocaleString()} <Typography component="span" variant="body2" color="text.secondary">/1匹</Typography></Typography>
                  {item.preBid ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, my: 1, bgcolor: 'info.50', border: '2px solid', borderColor: 'info.200', borderRadius: 1, p: 1.5 }}>
                      <Timer sx={{ color: 'info.main', fontSize: 20 }} /><Typography variant="body1" fontWeight="bold" color="info.main">入札開始まで {item.seconds}秒</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 2, my: 1 }}>
                      <Chip label={`残り ${item.seconds}秒`} size="small" color={item.bidders >= 2 ? 'error' : item.seconds <= 3 ? 'warning' : 'default'} sx={{ fontWeight: 'bold' }} />
                      {item.bidders > 0 && <Chip icon={<People />} label="入札中" size="small" color="error" />}
                    </Box>
                  )}
                  <Chip icon={<PriceCheck />} label="上限設定" size="small" variant="outlined" sx={{ cursor: 'pointer' }} />
                </CardContent>
                <CardActions>
                  <Button fullWidth variant={item.bidding ? 'contained' : 'outlined'} color={item.bidding ? 'success' : 'primary'} size="large">
                    {item.preBid ? '入札準備中...' : item.bidding ? '入札中' : '入札する'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  ),
};

/** 落札一覧 */
export const WonItems: StoryObj = {
  name: '落札一覧',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><EmojiEvents color="warning" /> 落札一覧</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>品種</TableCell><TableCell align="right">単価</TableCell><TableCell align="right">数量</TableCell><TableCell align="right">合計(税込)</TableCell><TableCell>支払状況</TableCell></TableRow></TableHead>
          <TableBody>
            {[{ no: 1, name: '幹之メダカ（フルボディ）', price: 3500, qty: 5, total: 19250, status: '入金済み' }, { no: 3, name: '三色ラメ幹之', price: 5000, qty: 3, total: 16500, status: '入金待ち' }].map((item) => (
              <TableRow key={item.no}>
                <TableCell>{item.no}</TableCell><TableCell>{item.name}</TableCell>
                <TableCell align="right">¥{item.price.toLocaleString()}/1匹</TableCell>
                <TableCell align="right">{item.qty}匹</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{item.total.toLocaleString()}</TableCell>
                <TableCell><Chip label={item.status} size="small" color={item.status === '入金済み' ? 'success' : 'warning'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  ),
};
