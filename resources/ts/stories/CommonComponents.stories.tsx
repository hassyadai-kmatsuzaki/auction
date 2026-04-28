import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, ListItemIcon, Chip, Divider, Badge, IconButton,
  Avatar, Button, Card, CardContent, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, Stepper, Step, StepLabel, FormControl, InputLabel, Select, Alert, LinearProgress,
  Tooltip, Popover,
} from '@mui/material';
import {
  Notifications, Help, SwapHoriz, Gavel, Event, AttachMoney, Announcement, MenuBook, Person,
  Storefront, AdminPanelSettings, ChevronRight, Close, Lightbulb, AutoAwesome, CheckCircle, Schedule,
  CreditCard, LocalShipping, Star, Warning,
} from '@mui/icons-material';

const meta: Meta = { title: 'Common/Components', tags: ['autodocs'] };
export default meta;

/** お知らせリスト */
export const AnnouncementListExample: StoryObj = {
  name: 'お知らせリスト',
  render: () => {
    const items = [
      { id: 1, title: '第18回 春の特別オークション開催のお知らせ', published_at: '2026-02-19', is_important: true },
      { id: 2, title: 'システムメンテナンスのお知らせ（2/25）', published_at: '2026-02-18', is_important: false },
      { id: 3, title: '利用規約の改定について', published_at: '2026-02-15', is_important: false },
    ];
    return (
      <Paper sx={{ maxWidth: 480 }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Announcement color="primary" />
          <Typography variant="h6" fontWeight="bold">お知らせ</Typography>
        </Box>
        <Divider />
        <List disablePadding>
          {items.map((item) => (
            <ListItem key={item.id} divider sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <ListItemText
                primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {item.is_important && <Chip label="重要" color="error" size="small" />}
                  <Typography variant="body2">{item.title}</Typography>
                </Box>}
                secondary={item.published_at}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  },
};

/** ヘッダー通知ベル */
export const HeaderNotificationsBell: StoryObj = {
  name: 'ヘッダー通知ベル',
  render: () => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'grey.100', p: 2, borderRadius: 2 }}>
      <Badge badgeContent={3} color="error">
        <IconButton><Notifications /></IconButton>
      </Badge>
      <Badge badgeContent={0}><IconButton><Notifications /></IconButton></Badge>
      <IconButton><Help /></IconButton>
    </Box>
  ),
};

/** 通知ドロップダウン */
export const NotificationsDropdown: StoryObj = {
  name: '通知ドロップダウン',
  render: () => (
    <Paper sx={{ maxWidth: 360 }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight="bold">通知</Typography>
        <Button size="small">すべて既読</Button>
      </Box>
      <Divider />
      <List disablePadding>
        {[
          { i: <Gavel color="primary" />, t: '第17回オークションが開催中です', d: '5分前', unread: true },
          { i: <CheckCircle color="success" />, t: '入金確認完了', d: '1時間前', unread: true },
          { i: <LocalShipping color="primary" />, t: '商品が発送されました', d: '2時間前', unread: false },
          { i: <Star color="warning" />, t: 'お気に入りの出品が始まります', d: '昨日', unread: false },
        ].map((n, i) => (
          <ListItem key={i} divider sx={{ bgcolor: n.unread ? 'primary.50' : 'transparent' }}>
            <ListItemIcon>{n.i}</ListItemIcon>
            <ListItemText primary={n.t} secondary={n.d} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItem>
        ))}
      </List>
    </Paper>
  ),
};

/** ヘッダーヘルプメニュー */
export const HeaderHelp: StoryObj = {
  name: 'ヘッダーヘルプ',
  render: () => (
    <Paper sx={{ maxWidth: 280 }}>
      <List disablePadding>
        {[
          { i: <MenuBook fontSize="small" />, t: 'マニュアル' },
          { i: <Lightbulb fontSize="small" />, t: '使い方ツアー' },
          { i: <Help fontSize="small" />, t: 'よくある質問' },
          { i: <AutoAwesome fontSize="small" />, t: 'デモを試す' },
        ].map((item) => (
          <ListItem key={item.t} divider button>
            <ListItemIcon sx={{ minWidth: 36 }}>{item.i}</ListItemIcon>
            <ListItemText primary={item.t} primaryTypographyProps={{ variant: 'body2' }} />
            <ChevronRight fontSize="small" />
          </ListItem>
        ))}
      </List>
    </Paper>
  ),
};

/** ロール切り替え */
export const RoleSwitcherExample: StoryObj = {
  name: 'ロール切り替え',
  render: () => {
    const roles = [
      { name: 'participant', label: '参加者画面', icon: <Person fontSize="small" /> },
      { name: 'seller', label: '出品者画面', icon: <Storefront fontSize="small" /> },
      { name: 'admin', label: '管理者画面', icon: <AdminPanelSettings fontSize="small" /> },
    ];
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'grey.100', p: 2, borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">参加者画面</Typography>
        <IconButton size="small"><SwapHoriz /></IconButton>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {roles.map((r) => (
            <Chip key={r.name} icon={r.icon} label={r.label} size="small"
              variant={r.name === 'participant' ? 'filled' : 'outlined'}
              color={r.name === 'participant' ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }} />
          ))}
        </Box>
      </Box>
    );
  },
};

/** マニュアルビューア */
export const ManualViewer: StoryObj = {
  name: 'マニュアルビューア',
  render: () => (
    <Paper sx={{ maxWidth: 600, p: 3 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>事前準備</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>オークション参加前に以下を確認しておきましょう</Typography>
      <Stack spacing={2}>
        <Alert severity="info">アカウントが「承認済み」になっているかを確認してください</Alert>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>1. 配送先住所の登録</Typography>
          <Typography variant="body2">設定画面から配送先住所を登録します。落札後に商品をお届けする住所です。</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>2. 通知設定の確認</Typography>
          <Typography variant="body2">メール通知・プッシュ通知を有効にすると、開始時刻や落札確定をすぐに受け取れます。</Typography>
        </Box>
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button>← 前へ</Button>
        <Button variant="contained">次へ →</Button>
      </Box>
    </Paper>
  ),
};

/** デモツアーポップオーバー */
export const DemoTourPopover: StoryObj = {
  name: 'デモツアーポップオーバー',
  render: () => (
    <Box sx={{ position: 'relative', minHeight: 280, bgcolor: 'grey.100', p: 4, borderRadius: 2 }}>
      <Card sx={{ width: 200 }}>
        <CardContent>
          <Typography variant="subtitle2">サンプルアイテム</Typography>
          <Typography variant="h6" color="primary.main">¥25,000</Typography>
          <Button variant="contained" fullWidth sx={{ mt: 1 }}>入札</Button>
        </CardContent>
      </Card>
      <Card sx={{ position: 'absolute', top: 60, left: 240, maxWidth: 320, p: 2, border: '2px solid', borderColor: 'warning.main' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}><Lightbulb fontSize="small" /></Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">入札ボタン</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>このボタンで入札を開始/解除します。残り時間内なら何度でも切り替え可能です。</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">3 / 7</Typography>
              <Box>
                <Button size="small">スキップ</Button>
                <Button size="small" variant="contained">次へ</Button>
              </Box>
            </Box>
          </Box>
          <IconButton size="small"><Close fontSize="small" /></IconButton>
        </Box>
      </Card>
    </Box>
  ),
};

/** 配送先住所登録モーダル */
export const ShippingAddressRegisterModal: StoryObj = {
  name: '配送先住所登録モーダル',
  render: () => (
    <Box sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.5)', minHeight: 600 }}>
      <Paper sx={{ maxWidth: 500, mx: 'auto', p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>配送先住所の登録</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>落札商品をお届けする住所を登録してください</Alert>
        <Stack spacing={2}>
          <TextField label="お名前" fullWidth required />
          <TextField label="郵便番号" fullWidth required placeholder="100-0001" />
          <TextField label="都道府県" fullWidth required />
          <TextField label="市区町村以降" fullWidth required />
          <TextField label="電話番号" fullWidth required />
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button>キャンセル</Button>
          <Button variant="contained">登録</Button>
        </Box>
      </Paper>
    </Box>
  ),
};

/** サブスクリプションステータスカード */
export const SubscriptionStatusCard: StoryObj = {
  name: 'サブスクリプションカード',
  render: () => (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box><Typography variant="caption" color="text.secondary">現在のプラン</Typography><Typography variant="h6" fontWeight="bold">プロプラン</Typography></Box>
            <Chip label="有効" color="success" size="small" icon={<CheckCircle />} />
          </Box>
          <Typography variant="h4" fontWeight="bold" color="primary.main">¥9,800<Typography component="span" variant="body2">/月</Typography></Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, color: 'text.secondary' }}>
            <Schedule fontSize="small" />
            <Typography variant="body2">次回課金日: 2026/05/01</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <CreditCard fontSize="small" />
            <Typography variant="body2">VISA •••• 4242</Typography>
          </Box>
          <Button variant="outlined" fullWidth sx={{ mt: 2 }}>プランを変更</Button>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid', borderColor: 'warning.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Warning color="warning" />
            <Typography variant="subtitle2" fontWeight="bold">無料プラン</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>機能を最大限に活用するにはアップグレードしてください</Typography>
          <Button variant="contained" color="warning" fullWidth>プロプランにアップグレード</Button>
        </CardContent>
      </Card>
    </Stack>
  ),
};

/** サブスクリプション登録モーダル */
export const SubscriptionRegisterModal: StoryObj = {
  name: 'サブスクリプション登録モーダル',
  render: () => (
    <Box sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.5)', minHeight: 600 }}>
      <Paper sx={{ maxWidth: 480, mx: 'auto', p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>プロプランに登録</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>無料プランから即時アップグレードされます</Alert>
        <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">プロプラン</Typography><Typography variant="body2" fontWeight="bold">¥9,800/月</Typography></Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">消費税</Typography><Typography variant="body2">¥980</Typography></Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">合計</Typography><Typography variant="h6" fontWeight="bold" color="primary.main">¥10,780/月</Typography></Box>
        </Box>
        <Stack spacing={2}>
          <TextField label="カード番号" fullWidth placeholder="4242 4242 4242 4242" />
          <Box sx={{ display: 'flex', gap: 1 }}><TextField label="有効期限" placeholder="MM/YY" sx={{ flex: 1 }} /><TextField label="CVC" placeholder="123" sx={{ flex: 1 }} /></Box>
          <TextField label="カード名義" fullWidth />
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button>キャンセル</Button>
          <Button variant="contained">登録する</Button>
        </Box>
      </Paper>
    </Box>
  ),
};

/** ローディング・空・エラー状態 */
export const StateExamples: StoryObj = {
  name: '状態（ローディング/空/エラー）',
  render: () => (
    <Stack spacing={3} sx={{ maxWidth: 480 }}>
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">読み込み中...</Typography>
      </Paper>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ fontSize: 48, mb: 1 }}>📭</Box>
        <Typography variant="subtitle1" fontWeight="bold">データがありません</Typography>
        <Typography variant="body2" color="text.secondary">条件を変えて再度お試しください</Typography>
      </Paper>
      <Alert severity="error">データの取得に失敗しました。再読み込みしてください。</Alert>
    </Stack>
  ),
};
