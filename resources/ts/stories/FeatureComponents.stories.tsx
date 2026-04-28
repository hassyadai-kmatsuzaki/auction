import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Paper, Stack, Divider, Avatar, Rating, IconButton,
  TextField, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel, List, ListItem, ListItemText, ListItemIcon, ListItemAvatar,
  LinearProgress, ToggleButton, ToggleButtonGroup, Alert, CircularProgress, Grid, Accordion,
  AccordionSummary, AccordionDetails, Badge,
} from '@mui/material';
import {
  Shuffle, DragIndicator, ExpandMore, Close, PriceCheck, Image as ImageIcon, ThumbUp, ThumbDown,
  Remove, Star, Send, NotificationsActive, Lock, QrCode2, Smartphone, ContentCopy, ArrowForward,
  CheckCircle, Tune, Email, Sms, Notifications, Lightbulb, ArrowDropDown, MoreVert, Add, Edit,
  PlayCircleOutline,
} from '@mui/icons-material';

const meta: Meta = { title: 'Feature/Components', tags: ['autodocs'] };
export default meta;

/** 出品者順序ランダム化ボタン */
export const RandomizeButton: StoryObj = {
  name: 'AdminSellerOrder/ランダム化ボタン',
  render: () => (
    <Stack spacing={3} sx={{ maxWidth: 480 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">通常状態</Typography>
        <Button variant="outlined" startIcon={<Shuffle />}>ランダム化</Button>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">処理中</Typography>
        <Button variant="outlined" startIcon={<CircularProgress size={20} />} disabled>ランダム化</Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>確認ダイアログ</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>出品者の表示順序をランダムに並び替えます。よろしいですか?</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button>キャンセル</Button>
          <Button variant="contained">ランダム化実行</Button>
        </Box>
      </Paper>
    </Stack>
  ),
};

/** 出品者一覧 (Admin) */
export const SellerOrderList: StoryObj = {
  name: 'AdminSellerOrder/出品者順序リスト',
  render: () => (
    <Paper sx={{ maxWidth: 600 }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold">出品者順序</Typography>
        <Button size="small" variant="outlined" startIcon={<Shuffle />}>ランダム化</Button>
      </Box>
      <Divider />
      <List disablePadding>
        {[
          { order: 1, name: '○○ファーム', items: 12 },
          { order: 2, name: '△△養魚場', items: 8 },
          { order: 3, name: '□□ブリード', items: 5 },
          { order: 4, name: '××爬虫類', items: 15 },
        ].map((s) => (
          <ListItem key={s.name} divider>
            <ListItemIcon><DragIndicator color="action" /></ListItemIcon>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>{s.order}</Avatar>
            <ListItemText primary={s.name} secondary={`出品 ${s.items} 件`} />
            <IconButton><MoreVert /></IconButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  ),
};

/** 出品者ごとの出品アコーディオン */
export const SellerOrderAccordion: StoryObj = {
  name: 'AdminSellerOrder/出品者アコーディオン',
  render: () => (
    <Stack spacing={1} sx={{ maxWidth: 720 }}>
      {[
        { order: 1, name: '○○ファーム', items: 3, open: true },
        { order: 2, name: '△△養魚場', items: 2, open: false },
      ].map((seller) => (
        <Accordion key={seller.name} defaultExpanded={seller.open}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <DragIndicator color="action" sx={{ mr: 1 }} />
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>{seller.order}</Avatar>
            <Typography sx={{ flex: 1 }}>{seller.name}</Typography>
            <Chip label={`${seller.items}件`} size="small" />
          </AccordionSummary>
          <AccordionDetails>
            <List disablePadding>
              {Array.from({ length: seller.items }).map((_, i) => (
                <ListItem key={i} divider>
                  <Box sx={{ width: 40, height: 40, bgcolor: 'grey.200', borderRadius: 1, mr: 2 }} />
                  <ListItemText primary={`サンプル生体 ${i + 1}`} secondary={`No.${seller.order * 100 + i + 1}`} />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  ),
};

/** 出品者管理用 ItemCard */
export const AdminSellerItemCard: StoryObj = {
  name: 'AdminSellerOrder/アイテムカード',
  render: () => (
    <Stack direction="row" spacing={2}>
      {[
        { no: 1, name: '幹之メダカ', price: 3000, premium: false },
        { no: 2, name: '三色ラメ', price: 5000, premium: true },
      ].map((item) => (
        <Card key={item.no} sx={{ width: 220 }}>
          <Box sx={{ position: 'relative', aspectRatio: '4/3', bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.premium && <Chip label="プレミアム" color="warning" size="small" sx={{ position: 'absolute', top: 4, left: 4 }} />}
            <Typography variant="caption" color="text.secondary">NO IMAGE</Typography>
          </Box>
          <CardContent sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">No.{item.no}</Typography>
            <Typography variant="subtitle2" noWrap>{item.name}</Typography>
            <Typography variant="body2" color="primary.main" fontWeight="bold">¥{item.price.toLocaleString()}</Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  ),
};

/** 出品者ごとの生体一覧 */
export const SellerItemsList: StoryObj = {
  name: 'AdminSellerOrder/出品者の生体一覧',
  render: () => (
    <Paper sx={{ maxWidth: 720, p: 2 }}>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>○○ファームの出品</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>ドラッグ&ドロップで順番を変更できます</Typography>
      <Stack spacing={1}>
        {[1, 2, 3].map((i) => (
          <Paper key={i} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
            <DragIndicator color="action" />
            <Box sx={{ width: 48, height: 48, bgcolor: 'grey.200', borderRadius: 1 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">No.{i * 10}</Typography>
              <Typography variant="subtitle2">サンプル生体 {i}</Typography>
            </Box>
            <Typography variant="body2" fontWeight="bold" color="primary.main">¥{(i * 5000).toLocaleString()}</Typography>
            <IconButton size="small"><Edit fontSize="small" /></IconButton>
          </Paper>
        ))}
      </Stack>
    </Paper>
  ),
};

/** 商品詳細ダイアログ */
export const ItemDetailDialog: StoryObj = {
  name: 'AuctionLive/商品詳細ダイアログ',
  render: () => (
    <Box sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.5)', minHeight: 700 }}>
      <Paper sx={{ maxWidth: 800, mx: 'auto' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">No.5 幹之メダカ（フルボディ）</Typography>
          <IconButton><Close /></IconButton>
        </Box>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ aspectRatio: '4/3', bgcolor: 'grey.200', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">画像プレビュー</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {[1, 2, 3].map((i) => (
                  <Box key={i} sx={{ width: 56, height: 56, bgcolor: 'grey.300', borderRadius: 1, position: 'relative', border: i === 1 ? '2px solid' : '2px solid transparent', borderColor: i === 1 ? 'primary.main' : 'transparent' }}>
                    {i === 3 && <PlayCircleOutline sx={{ position: 'absolute', inset: 0, m: 'auto', color: 'white', fontSize: 24, bgcolor: 'rgba(0,0,0,0.3)' }} />}
                  </Box>
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Chip label="プレミアム" color="warning" size="small" sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary">現在単価</Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main">¥3,500<Typography component="span" variant="body2" color="text.secondary">/1匹</Typography></Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                <Avatar sx={{ width: 32, height: 32 }}>○</Avatar>
                <Typography variant="body2">○○ファーム</Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 2 }}>個体情報: 体型・色彩共に良好。半年前から育成。</Typography>
              <Box sx={{ mt: 2 }}>
                <Chip label="残り 5秒" color="warning" sx={{ fontWeight: 'bold' }} />
              </Box>
              <Button variant="contained" color="success" fullWidth size="large" sx={{ mt: 2 }}>入札する</Button>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip icon={<PriceCheck />} label="上限設定" variant="outlined" />
                <IconButton size="small"><Star color="warning" /></IconButton>
              </Box>
            </Grid>
          </Grid>
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button>閉じる</Button>
        </Box>
      </Paper>
    </Box>
  ),
};

/** 入札上限設定モーダル */
export const BidLimitModal: StoryObj = {
  name: 'BidLimit/上限設定モーダル',
  render: () => (
    <Box sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.5)', minHeight: 600 }}>
      <Paper sx={{ maxWidth: 480, mx: 'auto' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><PriceCheck color="primary" /> 入札上限設定</Typography>
          <IconButton><Close /></IconButton>
        </Box>
        <Divider />
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>幹之メダカ（フルボディ）</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">現在単価</Typography>
            <Typography variant="h5" fontWeight="bold" color="primary.main">¥3,500</Typography>
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>上限を超える価格になった場合、自動的に入札が解除されます</Alert>
          <Typography variant="subtitle2" gutterBottom>クイック設定</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            {[{ l: '1.5x', v: 5250 }, { l: '2x', v: 7000 }, { l: '2.5x', v: 8750 }, { l: '3x', v: 10500 }].map((q) => (
              <Chip key={q.l} label={`${q.l} (¥${q.v.toLocaleString()})`} variant="outlined" sx={{ cursor: 'pointer' }} clickable />
            ))}
          </Stack>
          <TextField label="上限価格" fullWidth type="number" InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }} defaultValue={7000} />
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button color="error">解除</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button>キャンセル</Button>
            <Button variant="contained">設定</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  ),
};

/** LINE通知設定リスト */
export const LineNotificationList: StoryObj = {
  name: 'LineSettings/通知設定リスト',
  render: () => (
    <Paper sx={{ maxWidth: 480, p: 2 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>LINE通知設定</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>受け取りたい通知を選択してください</Typography>
      <List disablePadding>
        {[
          { t: 'オークション開催のお知らせ', d: '開催前日と当日に通知', enabled: true },
          { t: 'お気に入り出品の開始', d: 'お気に入り出品が始まる5分前', enabled: true },
          { t: '入札中の状況', d: '上限到達時など', enabled: false },
          { t: '落札確定', d: '落札時に通知', enabled: true },
          { t: '入金確認', d: '管理者が入金確認した時', enabled: true },
          { t: '商品発送', d: '商品が発送された時', enabled: false },
        ].map((n) => (
          <ListItem key={n.t} divider secondaryAction={<Switch defaultChecked={n.enabled} />}>
            <ListItemText primary={n.t} secondary={n.d} />
          </ListItem>
        ))}
      </List>
    </Paper>
  ),
};

/** Googleログインボタン */
export const GoogleLoginButton: StoryObj = {
  name: 'Auth/Googleログインボタン',
  render: () => (
    <Stack spacing={2} sx={{ maxWidth: 360 }}>
      <Button variant="outlined" fullWidth size="large" startIcon={
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" />
        </svg>
      } sx={{ textTransform: 'none', borderColor: '#dadce0', color: '#3c4043' }}>Googleでログイン</Button>
      <Button variant="outlined" fullWidth size="large" disabled startIcon={<CircularProgress size={20} />} sx={{ textTransform: 'none' }}>Googleでログイン</Button>
    </Stack>
  ),
};

/** レビュー作成ダイアログ */
export const ReviewDialog: StoryObj = {
  name: 'Reviews/レビュー作成ダイアログ',
  render: () => (
    <Box sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.5)', minHeight: 500 }}>
      <Paper sx={{ maxWidth: 480, mx: 'auto' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold">取引相手を評価する</Typography>
          <Typography variant="body2" color="text.secondary">○○ファーム との取引</Typography>
        </Box>
        <Divider />
        <Stack spacing={3} sx={{ p: 3 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>評価</Typography>
            <Rating defaultValue={5} size="large" />
          </Box>
          <Box>
            <Typography variant="subtitle2" gutterBottom>カテゴリ評価</Typography>
            <Stack spacing={1}>
              {['梱包・配送', 'コミュニケーション', '商品状態'].map((cat) => (
                <Box key={cat} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{cat}</Typography>
                  <Rating defaultValue={5} size="small" />
                </Box>
              ))}
            </Stack>
          </Box>
          <TextField label="コメント" fullWidth multiline rows={3} placeholder="ご感想や次の方への参考情報をお書きください" />
        </Stack>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button>キャンセル</Button>
          <Button variant="contained" startIcon={<Send />}>送信</Button>
        </Box>
      </Paper>
    </Box>
  ),
};

/** ユーザー評価サマリー */
export const UserReviewSummary: StoryObj = {
  name: 'Reviews/ユーザー評価サマリー',
  render: () => (
    <Stack spacing={3} sx={{ maxWidth: 520 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">コンパクト表示</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Rating value={4.6} precision={0.1} size="small" readOnly />
          <Typography variant="body2">4.6 (28件)</Typography>
        </Box>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" fontWeight="bold">4.6</Typography>
            <Rating value={4.6} precision={0.1} readOnly />
            <Typography variant="body2" color="text.secondary">28件の評価</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip icon={<ThumbUp />} label="良い 24" color="success" size="small" variant="outlined" />
            <Chip icon={<Remove />} label="普通 3" size="small" variant="outlined" />
            <Chip icon={<ThumbDown />} label="悪い 1" color="error" size="small" variant="outlined" />
          </Stack>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>最近の評価</Typography>
        <List dense>
          {[
            { name: '田中', rating: 5, role: '購入者', comment: '丁寧な梱包、健康な状態で届きました' },
            { name: '鈴木', rating: 4, role: '購入者', comment: '到着まで少し時間がかかりました' },
          ].map((r, i) => (
            <ListItem key={i} disablePadding sx={{ mb: 1 }}>
              <ListItemAvatar><Avatar sx={{ width: 32, height: 32 }}>{r.name[0]}</Avatar></ListItemAvatar>
              <ListItemText primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">{r.name}</Typography>
                  <Rating value={r.rating} size="small" readOnly />
                  <Chip label={r.role} size="small" variant="outlined" />
                </Box>
              } secondary={r.comment} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Stack>
  ),
};

/** 通知環境設定パネル */
export const NotificationPreferencesPanel: StoryObj = {
  name: 'Notifications/環境設定パネル',
  render: () => (
    <Paper sx={{ maxWidth: 600, p: 3 }}>
      <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tune /> 通知設定
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>イベント別に通知方法をカスタマイズできます</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 1, alignItems: 'center', mb: 1 }}>
        <Box />
        <Email fontSize="small" sx={{ mx: 1 }} titleAccess="メール" />
        <Notifications fontSize="small" sx={{ mx: 1 }} titleAccess="プッシュ" />
        <Sms fontSize="small" sx={{ mx: 1 }} titleAccess="LINE" />
      </Box>
      <Divider sx={{ mb: 1 }} />
      {[
        { l: 'オークション開催', mail: true, push: true, line: false },
        { l: 'お気に入り出品の開始', mail: false, push: true, line: true },
        { l: '入札状況', mail: false, push: true, line: true },
        { l: '落札確定', mail: true, push: true, line: true },
        { l: '入金確認', mail: true, push: false, line: true },
        { l: '商品発送', mail: true, push: false, line: false },
      ].map((row) => (
        <Box key={row.l} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2">{row.l}</Typography>
          <Switch defaultChecked={row.mail} size="small" />
          <Switch defaultChecked={row.push} size="small" />
          <Switch defaultChecked={row.line} size="small" />
        </Box>
      ))}
    </Paper>
  ),
};

/** 2要素認証設定 */
export const TwoFactorSettings: StoryObj = {
  name: 'Settings/2要素認証',
  render: () => (
    <Stack spacing={2} sx={{ maxWidth: 600 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: 'primary.50', color: 'primary.main', borderRadius: 2 }}><Lock /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="bold">2要素認証</Typography>
            <Typography variant="body2" color="text.secondary">アプリで生成されるコードでセキュリティを強化</Typography>
          </Box>
          <Chip label="無効" color="default" size="small" />
        </Box>
        <Button variant="contained" startIcon={<QrCode2 />}>2要素認証を有効化</Button>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>セットアップ手順</Typography>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>1</Avatar>
            <Box>
              <Typography variant="body2" fontWeight="bold">認証アプリをインストール</Typography>
              <Typography variant="body2" color="text.secondary">Google Authenticator や 1Password 等</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>2</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight="bold">QRコードをスキャン</Typography>
              <Box sx={{ width: 160, height: 160, bgcolor: 'grey.200', mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode2 sx={{ fontSize: 96, color: 'grey.500' }} />
              </Box>
              <Typography variant="caption" color="text.secondary">または手動キー: <code>JBSWY3DPEHPK3PXP</code></Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>3</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight="bold">確認コードを入力</Typography>
              <TextField fullWidth size="small" inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '0.5rem' } }} sx={{ mt: 1, maxWidth: 200 }} />
            </Box>
          </Box>
        </Stack>
        <Button variant="contained" sx={{ mt: 2 }}>有効化</Button>
      </Paper>
    </Stack>
  ),
};

/** チュートリアルガイド */
export const TutorialGuide: StoryObj = {
  name: 'Tutorial/チュートリアルガイド',
  render: () => (
    <Box sx={{ position: 'relative', minHeight: 400, bgcolor: 'grey.100', p: 4, borderRadius: 2 }}>
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 2 }} />
      <Card sx={{ position: 'relative', maxWidth: 480, mx: 'auto', mt: 8 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'warning.main' }}><Lightbulb /></Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">STEP 2/5</Typography>
              <Typography variant="h6" fontWeight="bold">入札ボタンを使ってみよう</Typography>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ mb: 2 }}>
            「入札する」ボタンを押すと、入札に参加できます。再度押すと取り消しができます。
          </Typography>
          <LinearProgress variant="determinate" value={40} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button>スキップ</Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button>戻る</Button>
              <Button variant="contained" endIcon={<ArrowForward />}>次へ</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  ),
};
