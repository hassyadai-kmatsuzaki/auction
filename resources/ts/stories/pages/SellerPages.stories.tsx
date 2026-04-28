import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip, Paper, Tabs, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Divider, TextField, Stepper, Step, StepLabel,
  Alert, Stack, MenuItem, Select, FormControl, InputLabel, IconButton, List, ListItem, ListItemText,
  Avatar, LinearProgress, InputAdornment,
} from '@mui/material';
import {
  Gavel, EmojiEvents, AttachMoney, Inventory, ArrowForward, CloudUpload, Add, Edit, Visibility,
  LocalShipping, Receipt, AccountBalance, Person, CalendarMonth, Search, ContentCopy, DownloadOutlined,
  Storefront, Verified, History,
} from '@mui/icons-material';

const meta: Meta = { title: 'Pages/出品者', tags: ['autodocs'] };
export default meta;

/** 出品者ダッシュボード */
export const Dashboard: StoryObj = {
  name: 'ダッシュボード',
  render: () => (
    <Box>
      <Box sx={{ p: 2.5, mb: 3, borderRadius: 2, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid', borderColor: 'success.200' }}>
        <Typography variant="h6" fontWeight="bold">こんにちは、○○ファーム 様</Typography>
        <Typography variant="body2" color="text.secondary">本日もよろしくお願いします</Typography>
      </Box>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>お知らせ</Typography>
      <List component={Paper} sx={{ mb: 3 }}>
        {[
          { t: '出品申込締切が近づいています', new: true },
          { t: '第18回 春の特別オークション 開催のお知らせ', new: true },
          { t: '手数料変更のお知らせ', new: false },
        ].map((a) => (
          <ListItem key={a.t} divider><ListItemText primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{a.new && <Chip label="NEW" size="small" color="error" />}{a.t}</Box>} /></ListItem>
        ))}
      </List>
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
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>クイックアクション</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Button variant="contained" fullWidth size="large" startIcon={<Add />}>出品申込</Button></Grid>
        <Grid item xs={12} md={4}><Button variant="outlined" fullWidth size="large" startIcon={<History />}>出品履歴</Button></Grid>
        <Grid item xs={12} md={4}><Button variant="outlined" fullWidth size="large" startIcon={<AccountBalance />}>精算情報</Button></Grid>
      </Grid>
    </Box>
  ),
};

/** 出品申請 */
export const SubmitItem: StoryObj = {
  name: '出品申請',
  render: () => (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>出品申請</Typography>
      <Stepper activeStep={0} sx={{ mb: 4 }}>
        {['基本情報', '画像・動画', '個体情報', '確認'].map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>基本情報</Typography>
        <Alert severity="info" sx={{ mb: 3 }}>画像・動画は管理者側で一括撮影することも可能です。</Alert>
        <Stack spacing={2.5}>
          <FormControl fullWidth><InputLabel>オークション</InputLabel><Select label="オークション" defaultValue=""><MenuItem value="">選択してください</MenuItem><MenuItem value="18">第18回 春の特別オークション (2026/04/03)</MenuItem></Select></FormControl>
          <TextField label="品種名" fullWidth required placeholder="例: 幹之メダカ（フルボディ）" />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label="数量" type="number" fullWidth required defaultValue={1} /></Grid>
            <Grid item xs={6}><TextField label="開始価格" type="number" fullWidth required InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }} /></Grid>
          </Grid>
          <TextField label="個体情報・詳細説明" fullWidth multiline rows={4} helperText="管理者入力時の参考にいたします" />
        </Stack>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" size="large">次へ</Button></Box>
      </Paper>
    </Box>
  ),
};

/** 出品履歴 */
export const ItemHistory: StoryObj = {
  name: '出品履歴',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>出品履歴</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '総出品数', v: 234 }, { l: '落札数', v: 198, c: 'success' }, { l: '総売上', v: '¥3.45M', c: 'primary' }, { l: '平均落札価格', v: '¥17,400', c: 'info' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h5" fontWeight="bold" color={(s.c as any) ? `${s.c}.main` : 'inherit'}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Paper sx={{ mb: 2 }}><Tabs value={0}><Tab label="すべて" /><Tab label="出品予定・審査中" /><Tab label="落札済み" /><Tab label="不落札・キャンセル" /></Tabs></Paper>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField placeholder="品種名で検索" size="small" InputProps={{ startAdornment: <Search fontSize="small" /> }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>オークション</InputLabel><Select label="オークション" defaultValue="all"><MenuItem value="all">すべて</MenuItem></Select></FormControl>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>品種名</TableCell><TableCell>オークション</TableCell><TableCell align="right">数量</TableCell><TableCell align="right">開始価格</TableCell><TableCell align="right">落札価格</TableCell><TableCell>ステータス</TableCell><TableCell>落札者</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { name: '幹之メダカ', auction: '第17回', qty: 5, start: 3000, won: 3500, status: '落札済み', buyer: '田中太郎' },
              { name: '三色ラメ', auction: '第17回', qty: 3, start: 4000, won: 5000, status: '落札済み', buyer: '佐藤花子' },
              { name: '楊貴妃', auction: '第17回', qty: 10, start: 1500, won: null, status: '不落札', buyer: '-' },
              { name: 'みゆき新品種', auction: '第18回', qty: 2, start: 8000, won: null, status: '審査中', buyer: '-' },
            ].map((item) => (
              <TableRow key={item.name + item.auction}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.auction}</TableCell>
                <TableCell align="right">{item.qty}</TableCell>
                <TableCell align="right">¥{item.start.toLocaleString()}</TableCell>
                <TableCell align="right">{item.won ? `¥${item.won.toLocaleString()}` : '-'}</TableCell>
                <TableCell><Chip label={item.status} size="small" color={item.status === '落札済み' ? 'success' : item.status === '審査中' ? 'warning' : 'default'} /></TableCell>
                <TableCell>{item.buyer}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 出品詳細 */
export const ItemDetail: StoryObj = {
  name: '出品詳細',
  render: () => (
    <Box sx={{ maxWidth: 900 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box><Typography variant="h4" fontWeight="bold">幹之メダカ（フルボディ）</Typography><Typography variant="body2" color="text.secondary">第17回 大感謝祭オークション / No.5</Typography></Box>
        <Chip label="落札済み" color="success" />
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Box sx={{ aspectRatio: '4/3', bgcolor: 'grey.200', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">画像プレビュー</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>取引情報</Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">数量</Typography><Typography variant="body2" fontWeight="bold">5匹</Typography></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">開始価格</Typography><Typography variant="body2" fontWeight="bold">¥3,000</Typography></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">落札価格</Typography><Typography variant="h6" fontWeight="bold" color="success.main">¥3,500</Typography></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">落札者</Typography><Typography variant="body2" fontWeight="bold">田中太郎</Typography></Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">手数料</Typography><Typography variant="body2">¥1,750</Typography></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">受取金額</Typography><Typography variant="h6" fontWeight="bold" color="primary.main">¥15,750</Typography></Box>
            </Stack>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  ),
};

/** 売上・精算 */
export const SalesSettlement: StoryObj = {
  name: '売上・精算',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>売上・精算</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '累計受取金額', v: '¥3,124,500', c: 'primary' }, { l: '累計売上', v: '¥3,856,000', c: 'success' }, { l: '累計手数料', v: '¥385,600', c: 'warning' }, { l: '精算完了回数', v: '12回' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h5" fontWeight="bold" color={(s.c as any) ? `${s.c}.main` : 'inherit'}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>月別売上推移</Typography>
            <Box sx={{ height: 200, bgcolor: 'grey.50', borderRadius: 1, display: 'flex', alignItems: 'flex-end', gap: 1, p: 2 }}>
              {[40, 65, 50, 80, 70, 95].map((h, i) => (
                <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'stretch' }}>
                  <Box sx={{ height: `${h}%`, bgcolor: 'primary.main', borderRadius: '4px 4px 0 0' }} />
                  <Typography variant="caption" align="center">{i + 9}月</Typography>
                </Box>
              ))}
            </Box>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>振込先</Typography>
            <Stack spacing={1}>
              <Box><Typography variant="caption" color="text.secondary">銀行</Typography><Typography variant="body2" fontWeight="bold">○○銀行 △△支店</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">口座</Typography><Typography variant="body2" fontWeight="bold">普通 1234567</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">名義</Typography><Typography variant="body2" fontWeight="bold">ヤマダ タロウ</Typography></Box>
              <Button size="small" variant="outlined" startIcon={<Edit />}>変更</Button>
            </Stack>
          </CardContent></Card>
        </Grid>
      </Grid>
      <Card><CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">精算履歴</Typography>
          <Button variant="outlined" size="small" startIcon={<DownloadOutlined />}>CSV出力</Button>
        </Box>
        <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>オークション</TableCell><TableCell align="right">出品数</TableCell><TableCell align="right">売上</TableCell><TableCell align="right">手数料</TableCell><TableCell align="right">受取金額</TableCell><TableCell>振込日</TableCell><TableCell>ステータス</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { a: '第17回 大感謝祭', items: 12, sales: 856000, fee: 85600, net: 770400, date: '2026/02/28', status: '振込済み' },
              { a: '第16回 新春', items: 8, sales: 432000, fee: 43200, net: 388800, date: '2026/01/30', status: '振込済み' },
            ].map((s) => (
              <TableRow key={s.a}><TableCell>{s.a}</TableCell><TableCell align="right">{s.items}</TableCell><TableCell align="right">¥{s.sales.toLocaleString()}</TableCell><TableCell align="right">¥{s.fee.toLocaleString()}</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>¥{s.net.toLocaleString()}</TableCell><TableCell>{s.date}</TableCell><TableCell><Chip label={s.status} size="small" color="success" /></TableCell></TableRow>
            ))}
          </TableBody>
        </Table></TableContainer>
      </CardContent></Card>
    </Box>
  ),
};

/** 配送状況 */
export const Shipping: StoryObj = {
  name: '配送状況',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>配送状況</Typography>
      <Alert severity="info" sx={{ mb: 3 }}>発送完了後、伝票番号を入力してください</Alert>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>品種</TableCell><TableCell>落札者</TableCell><TableCell>配送先</TableCell><TableCell>伝票番号</TableCell><TableCell>ステータス</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { no: 1, name: '幹之メダカ', buyer: '田中太郎', address: '東京都千代田区...', tracking: '', status: '発送待ち' },
              { no: 3, name: '三色ラメ', buyer: '佐藤花子', address: '大阪府大阪市...', tracking: '1234-5678-9012', status: '発送済み' },
            ].map((w) => (
              <TableRow key={w.no}>
                <TableCell>{w.no}</TableCell>
                <TableCell>{w.name}</TableCell>
                <TableCell>{w.buyer}</TableCell>
                <TableCell sx={{ maxWidth: 200 }}><Typography variant="caption" noWrap>{w.address}</Typography></TableCell>
                <TableCell>
                  {w.tracking
                    ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{w.tracking}<IconButton size="small"><ContentCopy fontSize="small" /></IconButton></Box>
                    : <Box sx={{ display: 'flex', gap: 1 }}><TextField size="small" placeholder="伝票番号" /><Button size="small" variant="contained">登録</Button></Box>}
                </TableCell>
                <TableCell><Chip label={w.status} size="small" color={w.status === '発送済み' ? 'success' : 'warning'} icon={<LocalShipping />} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 出品者プロフィール */
export const Profile: StoryObj = {
  name: 'プロフィール',
  render: () => (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>プロフィール</Typography>
      <Card sx={{ mb: 3 }}><CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar sx={{ width: 80, height: 80 }}><Storefront /></Avatar>
          <Box><Typography variant="h6" fontWeight="bold">○○ファーム</Typography><Typography variant="body2" color="text.secondary">代表: 山田太郎</Typography></Box>
        </Box>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>基本情報</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField label="屋号" fullWidth defaultValue="○○ファーム" /></Grid>
          <Grid item xs={6}><TextField label="法人名" fullWidth defaultValue="株式会社○○" /></Grid>
          <Grid item xs={6}><TextField label="代表者" fullWidth defaultValue="山田太郎" /></Grid>
          <Grid item xs={6}><TextField label="事業者登録番号" fullWidth /></Grid>
          <Grid item xs={6}><TextField label="メール" fullWidth defaultValue="yamada@example.com" /></Grid>
          <Grid item xs={6}><TextField label="電話" fullWidth defaultValue="03-1234-5678" /></Grid>
          <Grid item xs={12}><TextField label="住所" fullWidth /></Grid>
        </Grid>
      </CardContent></Card>
      <Card sx={{ mb: 3 }}><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>口座情報</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField label="銀行名" fullWidth /></Grid>
          <Grid item xs={6}><TextField label="支店名" fullWidth /></Grid>
          <Grid item xs={4}><FormControl fullWidth><InputLabel>口座種別</InputLabel><Select label="口座種別" defaultValue="ordinary"><MenuItem value="ordinary">普通</MenuItem><MenuItem value="checking">当座</MenuItem></Select></FormControl></Grid>
          <Grid item xs={4}><TextField label="口座番号" fullWidth /></Grid>
          <Grid item xs={4}><TextField label="口座名義" fullWidth /></Grid>
        </Grid>
      </CardContent></Card>
      <Card sx={{ mb: 3 }}><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>SNS</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField label="Instagram" fullWidth placeholder="@username" /></Grid>
          <Grid item xs={6}><TextField label="X (Twitter)" fullWidth placeholder="@username" /></Grid>
        </Grid>
      </CardContent></Card>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" size="large">保存</Button></Box>
    </Box>
  ),
};
