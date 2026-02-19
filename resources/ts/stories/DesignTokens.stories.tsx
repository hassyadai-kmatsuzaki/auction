import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Grid, Paper, Chip, Button, TextField, Card, CardContent, Divider, Alert, IconButton, Avatar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Gavel, PlayArrow, Pause, People, Timer, PriceCheck, MeetingRoom, EmojiEvents } from '@mui/icons-material';

const meta: Meta = { title: 'Design System/Tokens', tags: ['autodocs'] };
export default meta;

/** カラーパレット */
export const Colors: StoryObj = {
  name: 'カラーパレット',
  render: () => {
    const theme = useTheme();
    const palettes = [
      { name: 'Primary', colors: theme.palette.primary },
      { name: 'Secondary', colors: theme.palette.secondary },
      { name: 'Error', colors: theme.palette.error },
      { name: 'Warning', colors: theme.palette.warning },
      { name: 'Info', colors: theme.palette.info },
      { name: 'Success', colors: theme.palette.success },
    ];
    const greys = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

    return (
      <Box>
        <Typography variant="h4" gutterBottom fontWeight="bold">カラーパレット</Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {palettes.map(({ name, colors }) => (
            <Grid item xs={6} md={4} key={name}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>{name}</Typography>
                {['light', 'main', 'dark'].map((variant) => (
                  <Box key={variant} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 40, height: 24, borderRadius: 1, bgcolor: (colors as any)[variant] }} />
                    <Typography variant="caption">{variant}: {(colors as any)[variant]}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Typography variant="h5" gutterBottom fontWeight="bold">グレースケール</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {greys.map((g) => (
            <Box key={g} sx={{ textAlign: 'center' }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: `grey.${g}`, border: '1px solid', borderColor: 'divider' }} />
              <Typography variant="caption">{g}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  },
};

/** タイポグラフィ */
export const TypographyScale: StoryObj = {
  name: 'タイポグラフィ',
  render: () => {
    const variants = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'caption', 'button'] as const;
    return (
      <Box>
        <Typography variant="h4" gutterBottom fontWeight="bold">タイポグラフィスケール</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Font: DM Sans / Noto Sans JP</Typography>
        {variants.map((v) => (
          <Box key={v} sx={{ mb: 2, display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <Typography variant="caption" sx={{ minWidth: 80, color: 'text.secondary' }}>{v}</Typography>
            <Typography variant={v}>オークション会場 Auction Port</Typography>
          </Box>
        ))}
      </Box>
    );
  },
};

/** ボタン */
export const Buttons: StoryObj = {
  name: 'ボタン',
  render: () => (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">ボタン</Typography>
      {(['contained', 'outlined', 'text'] as const).map((variant) => (
        <Box key={variant} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{variant}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(['primary', 'secondary', 'success', 'error', 'warning', 'info'] as const).map((color) => (
              <Button key={color} variant={variant} color={color}>{color}</Button>
            ))}
            <Button variant={variant} disabled>disabled</Button>
          </Box>
        </Box>
      ))}
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>サイズ</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button variant="contained" size="small">Small</Button>
        <Button variant="contained" size="medium">Medium</Button>
        <Button variant="contained" size="large">Large</Button>
      </Box>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>アイコン付き</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" color="success" startIcon={<PlayArrow />}>オークション開始</Button>
        <Button variant="outlined" color="warning" startIcon={<Pause />}>一時停止</Button>
        <Button variant="contained" startIcon={<MeetingRoom />}>待機室へ入室</Button>
        <Button variant="outlined" startIcon={<PriceCheck />}>上限設定</Button>
      </Box>
    </Box>
  ),
};

/** チップ */
export const Chips: StoryObj = {
  name: 'チップ・バッジ',
  render: () => (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">チップ・バッジ</Typography>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>ステータス</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip label="開催中" color="success" icon={<PlayArrow />} />
        <Chip label="開催予定" color="primary" variant="outlined" />
        <Chip label="終了" variant="outlined" />
        <Chip label="入札中" color="error" icon={<People />} />
        <Chip label="プレミアム" color="warning" />
        <Chip label="LIVE" color="error" size="small" />
        <Chip label="リアルタイム接続中" color="success" size="small" />
        <Chip label="ポーリング中" color="warning" size="small" />
      </Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>カウントダウン</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip label="残り 10秒" size="small" />
        <Chip label="残り 3秒" size="small" color="warning" sx={{ fontWeight: 'bold' }} />
        <Chip label="残り 1秒" size="small" color="error" sx={{ fontWeight: 'bold' }} />
      </Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>指値</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip icon={<PriceCheck />} label="上限設定" size="small" variant="outlined" />
        <Chip icon={<PriceCheck />} label="上限: ¥50,000" size="small" color="primary" />
        <Chip icon={<PriceCheck />} label="上限: ¥50,000" size="small" variant="outlined" sx={{ textDecoration: 'line-through', opacity: 0.6 }} />
      </Box>
    </Box>
  ),
};

/** カード */
export const Cards: StoryObj = {
  name: 'カード',
  render: () => (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">カード</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">通常カード</Typography>
              <Typography variant="body2" color="text.secondary">border-radius: 16px、薄いボーダー付き</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ border: '2px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="h6">入札中カード</Typography>
              <Typography variant="body2" color="text.secondary">success.main のボーダーで入札状態を表現</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={6} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6">Elevated Paper</Typography>
            <Typography variant="body2" color="text.secondary">ダイアログ・オーバーレイ用</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  ),
};

/** フォーム */
export const Forms: StoryObj = {
  name: 'フォーム入力',
  render: () => (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">フォーム</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="オークション名" fullWidth helperText="255文字以内" />
        <TextField label="開始価格" type="number" fullWidth InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography> }} />
        <TextField label="カウントダウン秒数" type="number" fullWidth inputProps={{ step: 0.5 }} InputProps={{ endAdornment: <Typography sx={{ ml: 1 }}>秒</Typography> }} />
        <TextField label="検索" fullWidth size="small" placeholder="品種名で検索..." />
        <TextField label="無効" fullWidth disabled value="編集不可" />
        <TextField label="エラー" fullWidth error helperText="入力値が不正です" />
      </Box>
    </Box>
  ),
};

/** アラート */
export const Alerts: StoryObj = {
  name: 'アラート・通知',
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 560 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">アラート・通知</Typography>
      <Alert severity="success">入札に参加しました</Alert>
      <Alert severity="error">入札の切り替えに失敗しました</Alert>
      <Alert severity="warning">¥50,000 の上限に達したため自動的に入札オフになりました</Alert>
      <Alert severity="info">システムデフォルト設定を使用しています</Alert>
    </Box>
  ),
};

/** アイコン一覧 */
export const Icons: StoryObj = {
  name: 'アイコン',
  render: () => {
    const icons = [
      { icon: <Gavel />, name: 'Gavel（オークション）' },
      { icon: <PlayArrow />, name: 'PlayArrow（開始・入札）' },
      { icon: <Pause />, name: 'Pause（一時停止）' },
      { icon: <People />, name: 'People（入札者）' },
      { icon: <Timer />, name: 'Timer（カウントダウン）' },
      { icon: <PriceCheck />, name: 'PriceCheck（指値）' },
      { icon: <MeetingRoom />, name: 'MeetingRoom（入室）' },
      { icon: <EmojiEvents />, name: 'EmojiEvents（落札）' },
    ];
    return (
      <Box>
        <Typography variant="h4" gutterBottom fontWeight="bold">アイコン</Typography>
        <Grid container spacing={2}>
          {icons.map(({ icon, name }) => (
            <Grid item xs={6} md={3} key={name}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {icon}
                <Typography variant="caption">{name}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  },
};
