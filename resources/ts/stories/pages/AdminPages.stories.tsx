import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip, Paper, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Divider, IconButton, Badge, Alert, Switch, FormControlLabel,
  Avatar, TextField, InputAdornment, List, ListItem, ListItemText, LinearProgress, Stepper, Step, StepLabel,
  MenuItem, Select, FormControl, InputLabel, Stack, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, SkipNext, People, FiberManualRecord, Refresh, MeetingRoom, NoMeetingRoom,
  Gavel, AttachMoney, LocalShipping, Settings, LiveTv, List as ListIcon, Image as ImageIcon,
  Upload as UploadIcon, Download as DownloadIcon, Add, Edit, Delete, Search, Visibility, EmojiEvents,
  Description, Receipt, Verified, Psychology, ShowChart, Warning, Recommend, Insights, Storage,
  Person, Store, AccountBalance, CalendarMonth, FilterList, ContentCopy, CheckCircle, Send,
} from '@mui/icons-material';

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
          { label: '今月の開催回数', value: '3', color: '#059669' },
          { label: '総売上（今月）', value: '¥3,245,000', color: '#3B82F6' },
          { label: '総出品数', value: '342', color: '#F59E0B' },
          { label: '登録参加者数', value: '156', color: '#6366F1' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card><CardContent><Typography variant="caption" color="text.secondary">{s.label}</Typography><Typography variant="h4" fontWeight="bold" sx={{ color: s.color }}>{s.value}</Typography></CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>売上推移</Typography>
            <Box sx={{ height: 200, bgcolor: 'grey.50', borderRadius: 1, display: 'flex', alignItems: 'flex-end', gap: 1, p: 2 }}>
              {[40, 65, 50, 80, 70, 95, 60].map((h, i) => (
                <Box key={i} sx={{ flex: 1, height: `${h}%`, bgcolor: 'primary.main', borderRadius: '4px 4px 0 0' }} />
              ))}
            </Box>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>承認待ちユーザー</Typography>
            <List disablePadding>
              {[{ n: '田中太郎', t: '出品者' }, { n: '鈴木花子', t: '参加者' }].map((u) => (
                <ListItem key={u.n} secondaryAction={<Button size="small" variant="contained">承認</Button>}>
                  <ListItemText primary={u.n} secondary={u.t} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
        </Grid>
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
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'success.300' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}><MeetingRoom sx={{ color: 'success.main', fontSize: 28 }} /><Box><Typography variant="subtitle1" fontWeight="bold">待機室の公開状態</Typography><Typography variant="body2" color="text.secondary">現在：手動公開中</Typography></Box></Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}><Button variant="outlined" color="success" disabled startIcon={<MeetingRoom />}>今すぐ公開</Button><Button variant="contained" color="warning" startIcon={<NoMeetingRoom />}>閉鎖に戻す</Button></Box>
          </Box>
        </CardContent>
      </Card>
      <Card sx={{ mb: 3 }}><CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2 }}><Button variant="outlined" color="warning" startIcon={<Pause />}>一時停止</Button><Button variant="outlined" color="error" startIcon={<Stop />}>終了</Button></Box>
          <Box sx={{ display: 'flex', gap: 3 }}>{[{ l: '入札中', v: '4', c: '#059669' }, { l: '落札済み', v: '23', c: '#3B82F6' }, { l: '残り', v: '115', c: 'inherit' }].map((s) => (<Box key={s.l} sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h6" fontWeight="bold" sx={{ color: s.c }}>{s.v}</Typography></Box>))}</Box>
        </Box>
      </CardContent></Card>
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

/** ライブオークション一覧 */
export const LiveAuctions: StoryObj = {
  name: 'ライブオークション一覧',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>ライブオークション</Typography>
      <Grid container spacing={3}>
        {[
          { t: '第17回 大感謝祭', d: '2026/02/19', s: 'live', items: 142 },
          { t: '第18回 春の特別', d: '2026/04/03', s: 'scheduled', items: 0 },
        ].map((a) => (
          <Grid item xs={12} md={6} key={a.t}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" fontWeight="bold">{a.t}</Typography>
                  <Chip label={a.s === 'live' ? '開催中' : '予定'} color={a.s === 'live' ? 'success' : 'primary'} icon={a.s === 'live' ? <PlayArrow /> : undefined} />
                </Box>
                <Typography variant="body2" color="text.secondary">{a.d} ・ 出品 {a.items} 件</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button variant="contained" startIcon={<LiveTv />} color={a.s === 'live' ? 'success' : 'primary'}>ライブ管理</Button>
                  <Button variant="outlined" startIcon={<ListIcon />}>出品一覧</Button>
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
          <Button variant="contained" startIcon={<Add />}>新規登録</Button>
        </Box>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>画像</TableCell><TableCell>品種名</TableCell><TableCell align="right">数量</TableCell><TableCell align="right">開始価格</TableCell><TableCell>プレミアム</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                <TableCell>{i}</TableCell>
                <TableCell><Box sx={{ width: 40, height: 40, bgcolor: 'grey.200', borderRadius: 1 }} /></TableCell>
                <TableCell>サンプル生体 {i}</TableCell>
                <TableCell align="right">{i}匹</TableCell>
                <TableCell align="right">¥{(i * 5000).toLocaleString()}</TableCell>
                <TableCell>{i === 1 && <Chip label="プレミアム" size="small" color="warning" />}</TableCell>
                <TableCell><Chip label="登録済み" size="small" /></TableCell>
                <TableCell><IconButton size="small"><Edit fontSize="small" /></IconButton><IconButton size="small"><Delete fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 生体登録・編集 */
export const ItemForm: StoryObj = {
  name: '生体登録・編集',
  render: () => (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>生体登録</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <TextField label="出品者" fullWidth select defaultValue=""><MenuItem value="">選択してください</MenuItem></TextField>
          <TextField label="品種名" fullWidth required placeholder="例: 幹之メダカ（フルボディ）" />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label="数量" type="number" fullWidth defaultValue={1} /></Grid>
            <Grid item xs={6}><TextField label="開始価格" type="number" fullWidth InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }} /></Grid>
          </Grid>
          <FormControlLabel control={<Switch />} label="プレミアム出品" />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>画像（最大20枚）</Typography>
            <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
              <UploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">クリックまたはドラッグ&ドロップ</Typography>
            </Box>
          </Box>
          <Button variant="outlined" startIcon={<Psychology />}>AI画像分析を実行</Button>
          <TextField label="個体情報" fullWidth multiline rows={3} />
        </Stack>
      </Paper>
    </Box>
  ),
};

/** オークション管理 */
export const AuctionManagement: StoryObj = {
  name: 'オークション管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">オークション管理</Typography><Button variant="contained" startIcon={<Add />}>新規作成</Button></Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead><TableRow><TableCell>タイトル</TableCell><TableCell>開催日</TableCell><TableCell>ステータス</TableCell><TableCell align="right">出品数</TableCell><TableCell align="right">売上</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { t: '第17回 大感謝祭', d: '2026/02/19', s: 'live', c: 142, sales: 1245000 },
              { t: '第18回 春の特別', d: '2026/04/03', s: 'scheduled', c: 0, sales: 0 },
              { t: '第16回 新春', d: '2026/01/15', s: 'finished', c: 98, sales: 856000 },
            ].map((a) => (
              <TableRow key={a.t}>
                <TableCell>{a.t}</TableCell>
                <TableCell>{a.d}</TableCell>
                <TableCell><Chip label={a.s === 'live' ? '開催中' : a.s === 'scheduled' ? '予定' : '終了'} color={a.s === 'live' ? 'success' : a.s === 'scheduled' ? 'primary' : 'default'} size="small" /></TableCell>
                <TableCell align="right">{a.c}</TableCell>
                <TableCell align="right">¥{a.sales.toLocaleString()}</TableCell>
                <TableCell><Button size="small">詳細</Button><Button size="small">出品</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** オークション作成・編集 */
export const AuctionForm: StoryObj = {
  name: 'オークション作成・編集',
  render: () => (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>オークション作成</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <TextField label="タイトル" fullWidth required placeholder="第19回 春の特別オークション" />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label="開催日" type="date" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={6}><TextField label="開始時刻" type="time" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
          <TextField label="説明" fullWidth multiline rows={3} />
          <Divider />
          <Typography variant="subtitle1" fontWeight="bold">手数料設定</Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}><TextField label="出品手数料率" type="number" fullWidth InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} defaultValue={10} /></Grid>
            <Grid item xs={4}><TextField label="買受者手数料率" type="number" fullWidth InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} defaultValue={5} /></Grid>
            <Grid item xs={4}><TextField label="最低手数料" type="number" fullWidth InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }} defaultValue={500} /></Grid>
          </Grid>
          <Alert severity="info">10万円の落札の場合、出品者受取: ¥90,000、買受者支払: ¥105,000</Alert>
          <Button variant="contained" size="large">保存</Button>
        </Stack>
      </Paper>
    </Box>
  ),
};

/** 落札者管理 */
export const WonItemManagement: StoryObj = {
  name: '落札者管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">落札者管理</Typography><Button variant="outlined" startIcon={<DownloadIcon />}>CSV出力</Button></Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>品種</TableCell><TableCell>落札者</TableCell><TableCell align="right">落札価格</TableCell><TableCell>入金</TableCell><TableCell>伝票番号</TableCell><TableCell>配送</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { no: 1, name: '幹之メダカ', buyer: '田中太郎', price: 19250, payment: '入金済み', tracking: '1234-5678-9012', shipping: '発送済み' },
              { no: 3, name: '三色ラメ', buyer: '鈴木次郎', price: 16500, payment: '入金待ち', tracking: '', shipping: '発送待ち' },
            ].map((w) => (
              <TableRow key={w.no}>
                <TableCell>{w.no}</TableCell>
                <TableCell>{w.name}</TableCell>
                <TableCell>{w.buyer}</TableCell>
                <TableCell align="right">¥{w.price.toLocaleString()}</TableCell>
                <TableCell><Chip label={w.payment} size="small" color={w.payment === '入金済み' ? 'success' : 'warning'} /></TableCell>
                <TableCell>{w.tracking ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{w.tracking}<IconButton size="small"><ContentCopy fontSize="small" /></IconButton></Box> : <Button size="small" variant="outlined">入力</Button>}</TableCell>
                <TableCell><Chip label={w.shipping} size="small" color={w.shipping === '発送済み' ? 'success' : 'default'} /></TableCell>
                <TableCell><IconButton size="small"><Visibility fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 落札オークション一覧 */
export const WonItemAuctions: StoryObj = {
  name: '落札オークション一覧',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>落札オークション一覧</Typography>
      <Grid container spacing={3}>
        {[
          { t: '第17回 大感謝祭', d: '2026/02/19', won: 142, paid: 89, shipped: 67 },
          { t: '第16回 新春', d: '2026/01/15', won: 98, paid: 95, shipped: 95 },
        ].map((a) => (
          <Grid item xs={12} md={6} key={a.t}>
            <Card><CardContent>
              <Typography variant="h6" fontWeight="bold">{a.t}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{a.d}</Typography>
              <Grid container spacing={1}>
                <Grid item xs={4}><Box sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">落札</Typography><Typography variant="h6" fontWeight="bold">{a.won}</Typography></Box></Grid>
                <Grid item xs={4}><Box sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">入金済</Typography><Typography variant="h6" fontWeight="bold" color="success.main">{a.paid}</Typography></Box></Grid>
                <Grid item xs={4}><Box sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">発送済</Typography><Typography variant="h6" fontWeight="bold" color="primary.main">{a.shipped}</Typography></Box></Grid>
              </Grid>
              <Button variant="contained" fullWidth sx={{ mt: 2 }}>落札者管理を開く</Button>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  ),
};

/** 出品オークション別管理 */
export const ItemManagementAuctions: StoryObj = {
  name: '出品オークション別管理',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>出品管理</Typography>
      <Grid container spacing={3}>
        {[
          { t: '第18回 春の特別', d: '2026/04/03', items: 23, sellers: 8 },
          { t: '第17回 大感謝祭', d: '2026/02/19', items: 142, sellers: 28 },
        ].map((a) => (
          <Grid item xs={12} md={6} key={a.t}>
            <Card><CardContent>
              <Typography variant="h6" fontWeight="bold">{a.t}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{a.d}</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip icon={<Storage />} label={`${a.items}件出品`} />
                <Chip icon={<Person />} label={`${a.sellers}出品者`} />
              </Box>
              <Button variant="contained" fullWidth>出品一覧を開く</Button>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  ),
};

/** 出品者順序管理 */
export const SellerOrder: StoryObj = {
  name: '出品者順序管理',
  render: () => (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box><Typography variant="h4" fontWeight="bold">出品者順序管理</Typography><Typography variant="body2" color="text.secondary">第18回 春の特別オークション</Typography></Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<Refresh />}>ランダム化</Button>
          <Button variant="contained" startIcon={<Insights />}>レーンに自動割り当て</Button>
        </Box>
      </Box>
      <Alert severity="info" sx={{ mb: 2 }}>ドラッグ&ドロップで出品者の順序を変更できます。確定後、レーンに自動割り当てしてください。</Alert>
      <Stack spacing={1}>
        {[
          { order: 1, name: '○○ファーム', items: 12 },
          { order: 2, name: '△△養魚場', items: 8 },
          { order: 3, name: '□□ブリード', items: 5 },
          { order: 4, name: '××爬虫類', items: 15 },
        ].map((s) => (
          <Card key={s.name}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>{s.order}</Avatar>
              <Box sx={{ flex: 1 }}><Typography variant="subtitle1" fontWeight="bold">{s.name}</Typography><Typography variant="caption" color="text.secondary">出品 {s.items} 件</Typography></Box>
              <Button size="small">詳細</Button>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  ),
};

/** レーン割当 */
export const LaneAssignment: StoryObj = {
  name: 'レーン割当',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>レーン割当</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>第17回 大感謝祭オークション</Typography>
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((lane) => (
          <Grid item xs={12} md={3} key={lane}>
            <Card>
              <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5, textAlign: 'center', fontWeight: 'bold' }}>レーン {lane}</Box>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{36 + lane}件割当済み</Typography>
                <List dense disablePadding>
                  {[1, 2, 3].map((i) => (
                    <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                      <ListItemText primary={`No.${lane * 100 + i} サンプル生体`} primaryTypographyProps={{ variant: 'caption' }} />
                    </ListItem>
                  ))}
                  <ListItem sx={{ px: 0 }}><Typography variant="caption" color="text.secondary">他 {30 + lane}件...</Typography></ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Button variant="outlined" startIcon={<Refresh />}>自動割当</Button>
        <Button variant="contained">保存</Button>
      </Box>
    </Box>
  ),
};

/** 出品者管理 */
export const SellerManagement: StoryObj = {
  name: '出品者管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">出品者管理</Typography><Button variant="contained" startIcon={<Add />}>新規登録</Button></Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '総出品者数', v: 28 }, { l: '有効', v: 25, c: 'success' }, { l: '承認待ち', v: 2, c: 'warning' }, { l: '停止', v: 1, c: 'error' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color={(s.c as any) ? `${s.c}.main` : 'inherit'}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Paper sx={{ mb: 2 }}><Tabs value={0}><Tab label="すべて (28)" /><Tab label="有効 (25)" /><Tab label="承認待ち (2)" /><Tab label="停止 (1)" /></Tabs></Paper>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>屋号</TableCell><TableCell>代表者</TableCell><TableCell>連絡先</TableCell><TableCell align="right">出品数</TableCell><TableCell align="right">売上</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { name: '○○ファーム', rep: '山田太郎', email: 'yamada@example.com', items: 45, sales: 856000, status: '有効' },
              { name: '△△養魚場', rep: '佐藤花子', email: 'sato@example.com', items: 32, sales: 612000, status: '有効' },
              { name: '□□ブリード', rep: '鈴木一郎', email: 'suzuki@example.com', items: 0, sales: 0, status: '承認待ち' },
            ].map((s) => (
              <TableRow key={s.name}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.rep}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell align="right">{s.items}</TableCell>
                <TableCell align="right">¥{s.sales.toLocaleString()}</TableCell>
                <TableCell><Chip label={s.status} size="small" color={s.status === '有効' ? 'success' : 'warning'} /></TableCell>
                <TableCell>{s.status === '承認待ち' ? <Button size="small" variant="contained">承認</Button> : <Button size="small">詳細</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 出品者詳細 */
export const SellerDetail: StoryObj = {
  name: '出品者詳細',
  render: () => (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>○○ファーム</Typography>
      <Paper sx={{ mb: 2 }}><Tabs value={0}><Tab label="基本情報" /><Tab label="口座情報" /><Tab label="出品履歴" /><Tab label="統計" /></Tabs></Paper>
      <Card><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>基本情報</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField label="屋号" fullWidth defaultValue="○○ファーム" /></Grid>
          <Grid item xs={6}><TextField label="法人名" fullWidth defaultValue="株式会社○○" /></Grid>
          <Grid item xs={6}><TextField label="代表者" fullWidth defaultValue="山田太郎" /></Grid>
          <Grid item xs={6}><TextField label="メール" fullWidth defaultValue="yamada@example.com" /></Grid>
          <Grid item xs={6}><TextField label="電話" fullWidth defaultValue="03-0000-0000" /></Grid>
          <Grid item xs={6}><TextField label="事業者登録番号" fullWidth /></Grid>
          <Grid item xs={12}><TextField label="住所" fullWidth /></Grid>
          <Grid item xs={6}><TextField label="個別出品手数料率" type="number" fullWidth InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} defaultValue={10} /></Grid>
        </Grid>
        <Box sx={{ mt: 3 }}><Button variant="contained">保存</Button></Box>
      </CardContent></Card>
    </Box>
  ),
};

/** 買受者管理 */
export const BuyerManagement: StoryObj = {
  name: '買受者管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">買受者管理</Typography><Button variant="contained" startIcon={<Add />}>新規登録</Button></Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '総買受者数', v: 156 }, { l: '有効', v: 142, c: 'success' }, { l: '承認待ち', v: 8, c: 'warning' }, { l: '停止', v: 6, c: 'error' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color={(s.c as any) ? `${s.c}.main` : 'inherit'}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>名前</TableCell><TableCell>連絡先</TableCell><TableCell align="right">落札数</TableCell><TableCell align="right">総額</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { name: '田中太郎', email: 'tanaka@example.com', count: 23, total: 425000, status: '有効' },
              { name: '佐藤花子', email: 'sato@example.com', count: 12, total: 188000, status: '有効' },
              { name: '高橋一郎', email: 'taka@example.com', count: 0, total: 0, status: '承認待ち' },
            ].map((b) => (
              <TableRow key={b.name}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.email}</TableCell>
                <TableCell align="right">{b.count}</TableCell>
                <TableCell align="right">¥{b.total.toLocaleString()}</TableCell>
                <TableCell><Chip label={b.status} size="small" color={b.status === '有効' ? 'success' : 'warning'} /></TableCell>
                <TableCell>{b.status === '承認待ち' ? <Button size="small" variant="contained">承認</Button> : <Button size="small">詳細</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 買受者詳細 */
export const BuyerDetail: StoryObj = {
  name: '買受者詳細',
  render: () => (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>田中太郎</Typography>
      <Paper sx={{ mb: 2 }}><Tabs value={0}><Tab label="基本情報" /><Tab label="入札履歴" /><Tab label="落札履歴" /><Tab label="統計" /></Tabs></Paper>
      <Card><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>基本情報</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField label="名前" fullWidth defaultValue="田中太郎" /></Grid>
          <Grid item xs={6}><TextField label="メール" fullWidth defaultValue="tanaka@example.com" /></Grid>
          <Grid item xs={6}><TextField label="電話" fullWidth defaultValue="090-0000-0000" /></Grid>
          <Grid item xs={6}><TextField label="郵便番号" fullWidth /></Grid>
          <Grid item xs={12}><TextField label="配送先住所" fullWidth multiline rows={2} /></Grid>
        </Grid>
        <Box sx={{ mt: 3 }}><Button variant="contained">保存</Button></Box>
      </CardContent></Card>
    </Box>
  ),
};

/** お知らせ管理 */
export const AnnouncementManagement: StoryObj = {
  name: 'お知らせ管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">お知らせ管理</Typography><Button variant="contained" startIcon={<Add />}>新規作成</Button></Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>タイトル</TableCell><TableCell>公開対象</TableCell><TableCell>公開日時</TableCell><TableCell>優先度</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { t: '第18回 春の特別オークション開催のお知らせ', target: '全員', date: '2026/02/19 10:00', priority: '通常', status: '公開中' },
              { t: 'システムメンテナンス（2/25）', target: '全員', date: '2026/02/18 09:00', priority: '重要', status: '公開中' },
              { t: '出品者向け：手数料変更', target: '出品者', date: '2026/02/15 12:00', priority: '通常', status: '下書き' },
            ].map((a) => (
              <TableRow key={a.t}>
                <TableCell>{a.t}</TableCell>
                <TableCell><Chip label={a.target} size="small" /></TableCell>
                <TableCell>{a.date}</TableCell>
                <TableCell>{a.priority === '重要' ? <Chip label="重要" size="small" color="error" /> : a.priority}</TableCell>
                <TableCell><Chip label={a.status} size="small" color={a.status === '公開中' ? 'success' : 'default'} /></TableCell>
                <TableCell><Switch defaultChecked={a.status === '公開中'} /><IconButton size="small"><Edit fontSize="small" /></IconButton><IconButton size="small"><Delete fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** お知らせ作成・編集 */
export const AnnouncementForm: StoryObj = {
  name: 'お知らせ作成・編集',
  render: () => (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>お知らせ作成</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <TextField label="タイトル" fullWidth required />
          <TextField label="本文" fullWidth multiline rows={6} required />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth><InputLabel>公開対象</InputLabel>
                <Select label="公開対象" defaultValue="all"><MenuItem value="all">全員</MenuItem><MenuItem value="seller">出品者</MenuItem><MenuItem value="buyer">買受者</MenuItem></Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth><InputLabel>優先度</InputLabel>
                <Select label="優先度" defaultValue="normal"><MenuItem value="normal">通常</MenuItem><MenuItem value="important">重要</MenuItem></Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}><TextField label="公開日時" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} md={6}><TextField label="有効期限" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
          <Box sx={{ display: 'flex', gap: 1 }}><Button variant="outlined">プレビュー</Button><Button variant="contained">保存</Button></Box>
        </Stack>
      </Paper>
    </Box>
  ),
};

/** ユーザー管理 */
export const UserManagement: StoryObj = {
  name: 'ユーザー管理（旧）',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">ユーザー管理</Typography><Button variant="contained" startIcon={<Add />}>新規登録</Button></Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField placeholder="名前・メールで検索" size="small" InputProps={{ startAdornment: <Search fontSize="small" /> }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>タイプ</InputLabel><Select label="タイプ" defaultValue="all"><MenuItem value="all">すべて</MenuItem><MenuItem value="admin">管理者</MenuItem><MenuItem value="seller">出品者</MenuItem><MenuItem value="buyer">買受者</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>ステータス</InputLabel><Select label="ステータス" defaultValue="all"><MenuItem value="all">すべて</MenuItem><MenuItem value="approved">有効</MenuItem><MenuItem value="pending">承認待ち</MenuItem></Select></FormControl>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>ID</TableCell><TableCell>名前</TableCell><TableCell>メール</TableCell><TableCell>タイプ</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[1, 2, 3, 4].map((i) => (
              <TableRow key={i}><TableCell>{i}</TableCell><TableCell>ユーザー {i}</TableCell><TableCell>user{i}@example.com</TableCell><TableCell>{i === 1 ? '管理者' : i === 2 ? '出品者' : '買受者'}</TableCell><TableCell><Chip label="有効" size="small" color="success" /></TableCell><TableCell><Button size="small">詳細</Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** ユーザー詳細 */
export const UserDetail: StoryObj = {
  name: 'ユーザー詳細（旧）',
  render: () => (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>ユーザー詳細</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label="名前" fullWidth defaultValue="田中太郎" /></Grid>
            <Grid item xs={6}><TextField label="メール" fullWidth defaultValue="tanaka@example.com" /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth><InputLabel>タイプ</InputLabel><Select label="タイプ" defaultValue="buyer"><MenuItem value="admin">管理者</MenuItem><MenuItem value="seller">出品者</MenuItem><MenuItem value="buyer">買受者</MenuItem></Select></FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth><InputLabel>ステータス</InputLabel><Select label="ステータス" defaultValue="approved"><MenuItem value="approved">有効</MenuItem><MenuItem value="pending">承認待ち</MenuItem><MenuItem value="suspended">停止</MenuItem></Select></FormControl>
            </Grid>
          </Grid>
          <Button variant="contained">保存</Button>
        </Stack>
      </Paper>
    </Box>
  ),
};

/** ユーザー新規作成 */
export const UserCreate: StoryObj = {
  name: 'ユーザー新規作成',
  render: () => (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>ユーザー新規登録</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <TextField label="名前" fullWidth required />
          <TextField label="メール" type="email" fullWidth required />
          <TextField label="パスワード" type="password" fullWidth required />
          <FormControl fullWidth><InputLabel>タイプ</InputLabel><Select label="タイプ" defaultValue=""><MenuItem value="admin">管理者</MenuItem><MenuItem value="seller">出品者</MenuItem><MenuItem value="buyer">買受者</MenuItem></Select></FormControl>
          <Button variant="contained">登録</Button>
        </Stack>
      </Paper>
    </Box>
  ),
};

/** 帳票管理 */
export const DocumentManagement: StoryObj = {
  name: '帳票管理',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>帳票管理</Typography>
      <Paper sx={{ mb: 2 }}><Tabs value={0}><Tab icon={<Receipt />} iconPosition="start" label="請求書" /><Tab icon={<AttachMoney />} iconPosition="start" label="支払通知書" /><Tab icon={<Verified />} iconPosition="start" label="保証書" /></Tabs></Paper>
      <Card><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>請求書発行</Typography>
        <Stack spacing={2.5}>
          <FormControl fullWidth><InputLabel>オークション</InputLabel><Select label="オークション" defaultValue=""><MenuItem value="">選択してください</MenuItem><MenuItem value="17">第17回 大感謝祭</MenuItem></Select></FormControl>
          <FormControl fullWidth><InputLabel>落札者</InputLabel><Select label="落札者" defaultValue=""><MenuItem value="">選択してください</MenuItem><MenuItem value="1">田中太郎</MenuItem></Select></FormControl>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<Visibility />}>プレビュー</Button>
            <Button variant="contained" startIcon={<DownloadIcon />}>PDF出力</Button>
          </Box>
        </Stack>
      </CardContent></Card>
    </Box>
  ),
};

/** 支払い管理 */
export const PaymentManagement: StoryObj = {
  name: '支払い管理',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>支払い管理</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '入金待ち', v: 23, c: 'warning' }, { l: '入金済み', v: 89, c: 'success' }, { l: '期限超過', v: 4, c: 'error' }].map((s) => (
          <Grid item xs={4} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color={`${s.c}.main`}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>請求書番号</TableCell><TableCell>落札者</TableCell><TableCell align="right">金額</TableCell><TableCell>支払期限</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}><TableCell>INV-2026-{1000 + i}</TableCell><TableCell>買受者 {i}</TableCell><TableCell align="right">¥{(i * 25000).toLocaleString()}</TableCell><TableCell>2026/03/0{i}</TableCell><TableCell><Chip label={i === 1 ? '入金済み' : '入金待ち'} size="small" color={i === 1 ? 'success' : 'warning'} /></TableCell><TableCell><Button size="small">確認</Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** プラン管理 */
export const PlanManagement: StoryObj = {
  name: 'プラン管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">プラン管理</Typography><Button variant="contained" startIcon={<Add />}>新規プラン</Button></Box>
      <Grid container spacing={3}>
        {[
          { name: 'スタンダード', price: 0, features: ['月10件まで出品', '基本サポート'], color: 'default' },
          { name: 'プロ', price: 9800, features: ['無制限出品', 'プレミアム機能', '優先サポート'], color: 'primary' },
          { name: 'エンタープライズ', price: 29800, features: ['無制限出品', 'API連携', '専任担当者'], color: 'warning' },
        ].map((p) => (
          <Grid item xs={12} md={4} key={p.name}>
            <Card sx={{ border: p.color === 'primary' ? '2px solid' : '1px solid', borderColor: p.color === 'primary' ? 'primary.main' : 'divider' }}>
              <CardContent>
                <Typography variant="h5" fontWeight="bold">{p.name}</Typography>
                <Typography variant="h4" fontWeight="bold" color={p.color === 'primary' ? 'primary.main' : 'inherit'} sx={{ my: 1 }}>¥{p.price.toLocaleString()}<Typography component="span" variant="body2">/月</Typography></Typography>
                <List dense>{p.features.map((f) => <ListItem key={f} sx={{ px: 0 }}><CheckCircle fontSize="small" color="success" sx={{ mr: 1 }} />{f}</ListItem>)}</List>
                <Button variant="outlined" fullWidth>編集</Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  ),
};

/** サブスクリプション管理 */
export const SubscriptionManagement: StoryObj = {
  name: 'サブスクリプション管理',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>サブスクリプション管理</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '総契約数', v: 156 }, { l: '有効', v: 142, c: 'success' }, { l: '解約待ち', v: 8, c: 'warning' }, { l: '今月の収益', v: '¥456,800', c: 'primary' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h5" fontWeight="bold" color={(s.c as any) ? `${s.c}.main` : 'inherit'}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>ユーザー</TableCell><TableCell>プラン</TableCell><TableCell>契約日</TableCell><TableCell>次回課金日</TableCell><TableCell>ステータス</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}><TableCell>ユーザー {i}</TableCell><TableCell>{i === 1 ? 'エンタープライズ' : 'プロ'}</TableCell><TableCell>2025/12/0{i}</TableCell><TableCell>2026/05/0{i}</TableCell><TableCell><Chip label="有効" size="small" color="success" /></TableCell><TableCell><Button size="small">詳細</Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** 種別管理 */
export const SpeciesTypeManagement: StoryObj = {
  name: '種別管理',
  render: () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h4" fontWeight="bold">種別管理</Typography><Button variant="contained" startIcon={<Add />}>新規追加</Button></Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>種別名</TableCell><TableCell>カテゴリ</TableCell><TableCell align="right">出品数</TableCell><TableCell>表示順</TableCell><TableCell>操作</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              { name: 'メダカ', cat: '魚類', count: 234 },
              { name: 'グッピー', cat: '魚類', count: 89 },
              { name: 'ヒョウモントカゲモドキ', cat: '爬虫類', count: 56 },
              { name: 'ボールパイソン', cat: '爬虫類', count: 32 },
            ].map((s, i) => (
              <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell><Chip label={s.cat} size="small" /></TableCell><TableCell align="right">{s.count}</TableCell><TableCell>{i + 1}</TableCell><TableCell><IconButton size="small"><Edit fontSize="small" /></IconButton><IconButton size="small"><Delete fontSize="small" /></IconButton></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  ),
};

/** AI分析ダッシュボード */
export const AIAnalytics: StoryObj = {
  name: 'AI分析ダッシュボード',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>AI分析ダッシュボード</Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[{ l: '画像分析数（今月）', v: '1,245' }, { l: 'AI精度', v: '94.2%' }, { l: '不正検知数', v: '3' }, { l: 'レコメンドCTR', v: '8.4%' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color="primary.main">{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Grid container spacing={2}>
        {[
          { i: <ImageIcon />, t: '画像認識', d: 'AI による品種判定' },
          { i: <ShowChart />, t: '価格予測', d: '過去データから予測' },
          { i: <Warning />, t: '不正検知', d: '異常な入札パターンを検出' },
          { i: <Recommend />, t: 'レコメンド', d: 'パーソナライズされた推薦' },
        ].map((f) => (
          <Grid item xs={12} md={6} key={f.t}>
            <Card><CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: 'primary.50', color: 'primary.main', borderRadius: 2 }}>{f.i}</Box>
                <Box sx={{ flex: 1 }}><Typography variant="h6" fontWeight="bold">{f.t}</Typography><Typography variant="body2" color="text.secondary">{f.d}</Typography></Box>
                <Button variant="outlined">開く</Button>
              </Box>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  ),
};

/** AI画像認識 */
export const AIImageRecognition: StoryObj = {
  name: 'AI画像認識',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>AI画像認識</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>画像アップロード</Typography>
            <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center', mb: 2 }}>
              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">画像をドラッグ&ドロップまたはクリック</Typography>
            </Box>
            <FormControlLabel control={<Switch />} label="AI学習データに含める" />
            <Button variant="contained" fullWidth size="large" startIcon={<Psychology />}>分析開始</Button>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>分析結果</Typography>
            <Alert severity="success" sx={{ mb: 2 }}>品種判定: 幹之メダカ（信頼度 96.4%）</Alert>
            <Stack spacing={2}>
              {[{ l: '体型スコア', v: 88 }, { l: '色彩スコア', v: 92 }, { l: '模様スコア', v: 85 }].map((s) => (
                <Box key={s.l}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">{s.l}</Typography><Typography variant="body2" fontWeight="bold">{s.v}</Typography></Box><LinearProgress variant="determinate" value={s.v} /></Box>
              ))}
            </Stack>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">推奨開始価格</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">¥3,200 〜 ¥4,500</Typography>
            </Box>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  ),
};

/** AI価格予測 */
export const AIPricePrediction: StoryObj = {
  name: 'AI価格予測',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>AI価格予測</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>予測フォーム</Typography>
            <Stack spacing={2}>
              <FormControl fullWidth><InputLabel>品種</InputLabel><Select label="品種" defaultValue=""><MenuItem value="medaka">幹之メダカ</MenuItem></Select></FormControl>
              <TextField label="数量" type="number" fullWidth defaultValue={5} />
              <FormControl fullWidth><InputLabel>品質</InputLabel><Select label="品質" defaultValue="A"><MenuItem value="S">S（特級）</MenuItem><MenuItem value="A">A（上）</MenuItem><MenuItem value="B">B（中）</MenuItem></Select></FormControl>
              <Button variant="contained" startIcon={<ShowChart />} size="large">予測実行</Button>
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>予測結果</Typography>
            <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2, mb: 2 }}>
              <Typography variant="caption" color="text.secondary">予測価格範囲</Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main">¥18,500 〜 ¥24,000</Typography>
              <Typography variant="caption" color="text.secondary">信頼度: 87%</Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>市場トレンド</Typography>
            <Box sx={{ height: 150, bgcolor: 'grey.50', borderRadius: 1, display: 'flex', alignItems: 'flex-end', gap: 0.5, p: 1 }}>
              {[55, 62, 70, 65, 78, 80, 85, 82, 90].map((h, i) => <Box key={i} sx={{ flex: 1, height: `${h}%`, bgcolor: 'primary.main', borderRadius: '2px 2px 0 0' }} />)}
            </Box>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  ),
};

/** AI不正検知 */
export const AIFraudDetection: StoryObj = {
  name: 'AI不正検知',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>AI不正検知</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: '本日の検知', v: 3, c: 'error' }, { l: '対応中', v: 2, c: 'warning' }, { l: '解決済み', v: 28, c: 'success' }].map((s) => (
          <Grid item xs={4} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color={`${s.c}.main`}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>重要度</InputLabel><Select label="重要度" defaultValue="all"><MenuItem value="all">すべて</MenuItem><MenuItem value="high">高</MenuItem><MenuItem value="mid">中</MenuItem><MenuItem value="low">低</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>ステータス</InputLabel><Select label="ステータス" defaultValue="open"><MenuItem value="open">未対応</MenuItem><MenuItem value="progress">対応中</MenuItem><MenuItem value="resolved">解決</MenuItem></Select></FormControl>
      </Box>
      <Stack spacing={1}>
        {[
          { sev: 'high', t: '異常な入札パターン検出', desc: 'ユーザーIDが短時間に大量入札', date: '10分前' },
          { sev: 'mid', t: '画像の重複検出', desc: '出品画像が他の出品と一致', date: '1時間前' },
          { sev: 'low', t: 'ログイン異常', desc: '通常と異なるIPからログイン', date: '3時間前' },
        ].map((a) => (
          <Card key={a.t}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Warning color={a.sev === 'high' ? 'error' : a.sev === 'mid' ? 'warning' : 'info'} />
            <Box sx={{ flex: 1 }}><Typography variant="subtitle2" fontWeight="bold">{a.t}</Typography><Typography variant="body2" color="text.secondary">{a.desc}</Typography></Box>
            <Typography variant="caption" color="text.secondary">{a.date}</Typography>
            <Button size="small" variant="outlined">詳細</Button>
          </CardContent></Card>
        ))}
      </Stack>
    </Box>
  ),
};

/** AIレコメンド */
export const AIRecommendations: StoryObj = {
  name: 'AIレコメンド',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>AIレコメンド</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: 'CTR', v: '8.4%' }, { l: 'CVR', v: '2.1%' }, { l: '推薦精度', v: '91.3%' }].map((s) => (
          <Grid item xs={4} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color="primary.main">{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Card><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>アルゴリズム性能比較</Typography>
        <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>アルゴリズム</TableCell><TableCell align="right">CTR</TableCell><TableCell align="right">CVR</TableCell><TableCell align="right">精度</TableCell></TableRow></TableHead>
          <TableBody>
            {[{ n: '協調フィルタリング', c: '7.2%', v: '1.8%', a: '88.4%' }, { n: 'コンテンツベース', c: '6.5%', v: '1.5%', a: '85.2%' }, { n: 'ハイブリッド', c: '8.4%', v: '2.1%', a: '91.3%' }].map((r) => (
              <TableRow key={r.n}><TableCell>{r.n}</TableCell><TableCell align="right">{r.c}</TableCell><TableCell align="right">{r.v}</TableCell><TableCell align="right">{r.a}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table></TableContainer>
      </CardContent></Card>
    </Box>
  ),
};

/** レポート */
export const Reports: StoryObj = {
  name: 'レポート',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>レポート自動生成</Typography>
      <Card sx={{ mb: 3 }}><CardContent>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup value="month" size="small"><ToggleButton value="week">週次</ToggleButton><ToggleButton value="month">月次</ToggleButton><ToggleButton value="custom">カスタム</ToggleButton></ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>レポート種別</InputLabel><Select label="レポート種別" defaultValue="summary"><MenuItem value="summary">取引サマリー</MenuItem><MenuItem value="species">品種別分析</MenuItem><MenuItem value="user">ユーザー分析</MenuItem></Select></FormControl>
          <Button variant="contained" startIcon={<Insights />}>生成</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />}>PDF</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />}>Excel</Button>
        </Box>
      </CardContent></Card>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>売上推移</Typography>
            <Box sx={{ height: 200, bgcolor: 'grey.50', borderRadius: 1, display: 'flex', alignItems: 'flex-end', gap: 0.5, p: 2 }}>
              {[40, 65, 50, 80, 70, 95, 60, 85, 75, 90, 80, 100].map((h, i) => <Box key={i} sx={{ flex: 1, height: `${h}%`, bgcolor: 'primary.main', borderRadius: '2px 2px 0 0' }} />)}
            </Box>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>品種別ランキング</Typography>
            <List dense>{['幹之メダカ', '三色ラメ', 'ヒョウモントカゲモドキ', 'ボールパイソン'].map((n, i) => (<ListItem key={n} sx={{ px: 0 }}><ListItemText primary={`${i + 1}. ${n}`} /></ListItem>))}</List>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  ),
};

/** スケーリング */
export const Scaling: StoryObj = {
  name: 'スケーリング監視',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>スケーリング監視</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ l: 'CPU使用率', v: '42%', c: 'success' }, { l: 'メモリ', v: '68%', c: 'warning' }, { l: '同時接続数', v: '342', c: 'primary' }, { l: 'キュー待機', v: '12', c: 'info' }].map((s) => (
          <Grid item xs={6} md={3} key={s.l}><Card><CardContent><Typography variant="caption" color="text.secondary">{s.l}</Typography><Typography variant="h4" fontWeight="bold" color={`${s.c}.main`}>{s.v}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Card><CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>サーバーステータス</Typography>
        <List>{['Web Server (EC2)', 'Database (RDS)', 'Redis Queue', 'WebSocket Server'].map((s) => (
          <ListItem key={s} secondaryAction={<Chip label="Healthy" size="small" color="success" />}><ListItemText primary={s} secondary="auction.example.com" /></ListItem>
        ))}</List>
      </CardContent></Card>
    </Box>
  ),
};

/** デザインシステム */
export const DesignSystem: StoryObj = {
  name: 'デザインシステム',
  render: () => (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>デザインシステム</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>カラーパレット、タイポグラフィ、コンポーネント一覧（管理者向けプレビュー）</Typography>
      <Grid container spacing={2}>
        {['Primary', 'Secondary', 'Success', 'Warning', 'Error', 'Info'].map((p) => (
          <Grid item xs={6} md={4} key={p}><Card><CardContent><Typography variant="subtitle2">{p}</Typography><Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}><Box sx={{ flex: 1, height: 32, bgcolor: `${p.toLowerCase()}.light` }} /><Box sx={{ flex: 1, height: 32, bgcolor: `${p.toLowerCase()}.main` }} /><Box sx={{ flex: 1, height: 32, bgcolor: `${p.toLowerCase()}.dark` }} /></Box></CardContent></Card></Grid>
        ))}
      </Grid>
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
