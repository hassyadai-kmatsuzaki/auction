import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardMedia, CardActions,
  Button, Chip, Paper, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Divider, Container, IconButton,
  Alert, CircularProgress, Stack, List, ListItem, ListItemText, ListItemIcon,
  Avatar, Switch, FormControlLabel, TextField, MenuItem, Select, FormControl, InputLabel, Badge,
} from '@mui/material';
import {
  PlayArrow, Gavel, Event, AccessTime, ArrowForward, People,
  EmojiEvents, Timer, MeetingRoom, PriceCheck, Wifi, Refresh,
  Favorite, FavoriteBorder, ViewModule, ArrowBack, MenuBook, Search,
  Notifications, Settings as SettingsIcon, Lock, Logout, ChevronRight,
  PlayCircle, LocalShipping, Receipt,
} from '@mui/icons-material';

const meta: Meta = { title: 'Pages/参加者', tags: ['autodocs'] };
export default meta;

/** 参加者ホーム */
export const Home: StoryObj = {
  name: 'ホーム',
  render: () => (
    <Box>
      <Box sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)', color: 'white', py: 4, px: 2 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: '#ef4444', px: 1.5, py: 0.5, borderRadius: 1, fontSize: '0.8rem', fontWeight: 800 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />LIVE
            </Box>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>オークション開催中！</Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>第17回 大感謝祭オークション</Typography>
          <Button variant="contained" size="large" endIcon={<ArrowForward />} sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 700, px: 4, '&:hover': { bgcolor: 'grey.100' } }}>今すぐ参加する</Button>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ pt: 3 }}>
        <Card sx={{ border: '1px solid', borderColor: 'primary.100', mb: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Event sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle2" color="primary.main" fontWeight={600}>次回開催予定</Typography>
            </Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>第18回 春の特別オークション</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">2026年4月3日(金) 13:00〜</Typography>
              <Box sx={{ bgcolor: 'primary.50', color: 'primary.main', px: 1, py: 0.25, borderRadius: 0.75, fontWeight: 700, fontSize: '0.75rem' }}>あと37日</Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
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

/** オークション出品一覧（事前確認） */
export const AuctionItems: StoryObj = {
  name: 'オークション出品一覧',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton size="small"><ArrowBack /></IconButton>
        <Typography variant="h5" fontWeight="bold">第18回 春の特別オークション 出品一覧</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>2026年4月3日(金) 13:00〜 / 全 23 件</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField placeholder="品種名で検索" size="small" InputProps={{ startAdornment: <Search fontSize="small" /> }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>並び替え</InputLabel><Select label="並び替え" defaultValue="number"><MenuItem value="number">出品番号順</MenuItem><MenuItem value="price">価格順</MenuItem></Select></FormControl>
      </Box>
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Card>
              <Box sx={{ position: 'relative', aspectRatio: '4/3', bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">NO IMAGE</Typography>
                <IconButton sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.85)' }}>{i % 2 === 0 ? <Favorite color="error" /> : <FavoriteBorder />}</IconButton>
                {i === 1 && <Chip label="プレミアム" color="warning" size="small" sx={{ position: 'absolute', top: 8, left: 8 }} />}
              </Box>
              <CardContent>
                <Typography variant="caption" color="text.secondary">No.{i}</Typography>
                <Typography variant="subtitle1" fontWeight="bold">サンプル生体 {i}</Typography>
                <Typography variant="body2" color="text.secondary">数量: {i}匹</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>開始価格</Typography>
                <Typography variant="h6" color="primary.main" fontWeight="bold">¥{(i * 5000).toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
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
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>次の商品</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
            {[
              { lane: 1, no: 111, name: 'ヒョウモントカゲモドキ', price: 18000 },
              { lane: 1, no: 112, name: 'コーンスネーク', price: 12000 },
              { lane: 2, no: 78, name: 'フトアゴヒゲトカゲ', price: 25000 },
              { lane: 3, no: 56, name: 'ボールパイソン パステル', price: 45000 },
            ].map((item) => (
              <Box key={item.no} sx={{ flexShrink: 0, width: 140, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ width: '100%', aspectRatio: '3/2', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary">NO IMAGE</Typography>
                </Box>
                <Box sx={{ p: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 0.25 }}>
                    <Chip label={`L${item.lane}`} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} color="primary" variant="outlined" />
                  </Box>
                  <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>{item.name}</Typography>
                  <Typography variant="caption" color="primary.main" fontWeight="bold">¥{item.price.toLocaleString()}〜</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
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
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>品種</TableCell><TableCell align="right">単価</TableCell><TableCell align="right">数量</TableCell><TableCell align="right">合計(税込)</TableCell><TableCell>支払状況</TableCell><TableCell>配送</TableCell></TableRow></TableHead>
          <TableBody>
            {[{ no: 1, name: '幹之メダカ（フルボディ）', price: 3500, qty: 5, total: 19250, status: '入金済み', delivery: '発送済み' }, { no: 3, name: '三色ラメ幹之', price: 5000, qty: 3, total: 16500, status: '入金待ち', delivery: '発送前' }].map((item) => (
              <TableRow key={item.no}>
                <TableCell>{item.no}</TableCell><TableCell>{item.name}</TableCell>
                <TableCell align="right">¥{item.price.toLocaleString()}/1匹</TableCell>
                <TableCell align="right">{item.qty}匹</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{item.total.toLocaleString()}</TableCell>
                <TableCell><Chip label={item.status} size="small" color={item.status === '入金済み' ? 'success' : 'warning'} /></TableCell>
                <TableCell><Chip label={item.delivery} size="small" color={item.delivery === '発送済み' ? 'success' : 'default'} icon={<LocalShipping />} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  ),
};

/** お気に入り */
export const Favorites: StoryObj = {
  name: 'お気に入り',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><Favorite color="error" /> お気に入り</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>気になる出品をマークしてオークション当日に備えましょう</Typography>
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card>
              <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">NO IMAGE</Typography>
                <IconButton sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.85)' }}><Favorite color="error" /></IconButton>
              </Box>
              <CardContent>
                <Typography variant="caption" color="text.secondary">第18回 春の特別</Typography>
                <Typography variant="subtitle1" fontWeight="bold" noWrap>サンプル生体 {i}</Typography>
                <Typography variant="caption" color="text.secondary">開始価格</Typography>
                <Typography variant="h6" color="primary.main" fontWeight="bold">¥{(i * 5000).toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  ),
};

/** デモ */
export const Demo: StoryObj = {
  name: 'デモ',
  render: () => (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><PlayCircle color="primary" /> デモ体験</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>本番前に操作感を確認できます</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>ガイド付きデモ</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>初めての方向け。チュートリアルに沿って一歩ずつ操作を学べます</Typography>
              <Button variant="contained" fullWidth size="large" startIcon={<PlayArrow />}>ガイド付きデモを開始</Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>フリーモード</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>自由にデモ環境を操作。慣れた方向けです</Typography>
              <Button variant="outlined" fullWidth size="large" startIcon={<PlayArrow />}>フリーモードを開始</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  ),
};

/** マニュアル */
export const Manual: StoryObj = {
  name: 'マニュアル',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><MenuBook /> マニュアル</Typography>
      <List component={Paper}>
        {[
          { t: 'はじめに', d: 'オークションへの参加方法' },
          { t: '事前準備', d: 'アカウント登録、配送先設定' },
          { t: '当日の流れ', d: '待機室入室から落札確定まで' },
          { t: '入札の操作', d: '入札ボタン、上限設定の使い方' },
          { t: '落札後', d: '入金、商品到着までの流れ' },
          { t: 'よくある質問', d: 'トラブルシューティング' },
        ].map((c) => (
          <ListItem key={c.t} divider button>
            <ListItemText primary={c.t} secondary={c.d} primaryTypographyProps={{ fontWeight: 'bold' }} />
            <ChevronRight />
          </ListItem>
        ))}
      </List>
    </Container>
  ),
};

/** 設定 */
export const Settings: StoryObj = {
  name: '設定',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}><SettingsIcon /> 設定</Typography>
      <Stack spacing={2}>
        <Card><CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>プロフィール</Typography>
          <Stack spacing={2}>
            <TextField label="お名前" fullWidth defaultValue="田中太郎" />
            <TextField label="メールアドレス" fullWidth defaultValue="tanaka@example.com" />
            <TextField label="電話番号" fullWidth defaultValue="090-1234-5678" />
          </Stack>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>配送先住所</Typography>
          <Stack spacing={2}>
            <TextField label="郵便番号" fullWidth defaultValue="100-0001" />
            <TextField label="都道府県" fullWidth defaultValue="東京都" />
            <TextField label="市区町村以降" fullWidth defaultValue="千代田区千代田1-1" />
          </Stack>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>通知設定</Typography>
          <List disablePadding>
            <ListItem disablePadding secondaryAction={<Switch defaultChecked />}><ListItemIcon><Notifications /></ListItemIcon><ListItemText primary="メール通知" secondary="お知らせや落札確定をメールで受信" /></ListItem>
            <ListItem disablePadding secondaryAction={<Switch defaultChecked />}><ListItemIcon><Notifications /></ListItemIcon><ListItemText primary="プッシュ通知" secondary="ブラウザのプッシュ通知" /></ListItem>
          </List>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>セキュリティ</Typography>
          <List disablePadding>
            <ListItem disablePadding secondaryAction={<Button size="small">変更</Button>}><ListItemIcon><Lock /></ListItemIcon><ListItemText primary="パスワード変更" /></ListItem>
            <ListItem disablePadding secondaryAction={<Switch />}><ListItemIcon><Lock /></ListItemIcon><ListItemText primary="2要素認証" secondary="アプリ認証で安全性向上" /></ListItem>
          </List>
        </CardContent></Card>
        <Button variant="outlined" color="error" startIcon={<Logout />}>ログアウト</Button>
      </Stack>
    </Container>
  ),
};
