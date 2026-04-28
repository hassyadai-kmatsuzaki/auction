import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, ListSubheader, Avatar, Chip, Badge, Divider, Container,
  TextField, InputAdornment, Menu, MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon, Search, Notifications, Help, AccountCircle, Dashboard, Gavel, Storefront,
  Person, AdminPanelSettings, Settings, Logout, Storage, Receipt, AttachMoney, Insights,
  Psychology, ShowChart, Warning, Recommend, EmojiEvents, History, AccountBalance, LocalShipping,
  Home as HomeIcon, MeetingRoom, Favorite, MenuBook,
} from '@mui/icons-material';

const meta: Meta = { title: 'Layouts/レイアウト', tags: ['autodocs'] };
export default meta;

const SIDEBAR_WIDTH = 240;

/** 管理者レイアウト */
export const AdminLayout: StoryObj = {
  name: '管理者レイアウト',
  render: () => (
    <Box sx={{ display: 'flex', minHeight: 600 }}>
      <Box component="nav" sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold" color="primary.main">Auction Port</Typography>
        </Toolbar>
        <List dense subheader={<ListSubheader>メイン</ListSubheader>}>
          {[
            { i: <Dashboard />, t: 'ダッシュボード', selected: true },
            { i: <Gavel />, t: 'オークション' },
            { i: <Storage />, t: '生体管理' },
            { i: <EmojiEvents />, t: '落札者管理' },
            { i: <Receipt />, t: '帳票管理' },
          ].map((item) => (
            <ListItemButton key={item.t} selected={item.selected}>
              <ListItemIcon>{item.i}</ListItemIcon>
              <ListItemText primary={item.t} />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <List dense subheader={<ListSubheader>ユーザー</ListSubheader>}>
          {[{ i: <Storefront />, t: '出品者' }, { i: <Person />, t: '買受者' }, { i: <AccountCircle />, t: 'ユーザー' }].map((item) => (
            <ListItemButton key={item.t}><ListItemIcon>{item.i}</ListItemIcon><ListItemText primary={item.t} /></ListItemButton>
          ))}
        </List>
        <Divider />
        <List dense subheader={<ListSubheader>AI・分析</ListSubheader>}>
          {[
            { i: <Insights />, t: 'AI分析' },
            { i: <Psychology />, t: '画像認識' },
            { i: <ShowChart />, t: '価格予測' },
            { i: <Warning />, t: '不正検知' },
            { i: <Recommend />, t: 'レコメンド' },
          ].map((item) => (
            <ListItemButton key={item.t}><ListItemIcon>{item.i}</ListItemIcon><ListItemText primary={item.t} /></ListItemButton>
          ))}
        </List>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'grey.50' }}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar>
            <TextField placeholder="検索..." size="small" sx={{ flex: 1, maxWidth: 360 }} InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
            <Box sx={{ flexGrow: 1 }} />
            <Badge badgeContent={3} color="error"><IconButton><Notifications /></IconButton></Badge>
            <IconButton><Help /></IconButton>
            <Avatar sx={{ ml: 1 }}>管</Avatar>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Typography variant="h4" fontWeight="bold">ダッシュボード</Typography>
          <Typography variant="body2" color="text.secondary">ここにメインコンテンツが表示されます</Typography>
        </Container>
      </Box>
    </Box>
  ),
};

/** 出品者レイアウト */
export const SellerLayout: StoryObj = {
  name: '出品者レイアウト',
  render: () => (
    <Box sx={{ display: 'flex', minHeight: 600 }}>
      <Box component="nav" sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight="bold" color="primary.main">Auction Port</Typography>
          <Chip label="出品者" size="small" color="success" />
        </Toolbar>
        <List dense subheader={<ListSubheader>メイン</ListSubheader>}>
          {[
            { i: <Dashboard />, t: 'ダッシュボード', selected: true },
            { i: <Gavel />, t: '出品申込' },
            { i: <History />, t: '出品履歴' },
            { i: <AttachMoney />, t: '売上・精算' },
            { i: <LocalShipping />, t: '配送状況' },
          ].map((item) => (
            <ListItemButton key={item.t} selected={item.selected}>
              <ListItemIcon>{item.i}</ListItemIcon>
              <ListItemText primary={item.t} />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <List dense subheader={<ListSubheader>アカウント</ListSubheader>}>
          {[{ i: <Storefront />, t: 'プロフィール' }, { i: <Settings />, t: '設定' }, { i: <Logout />, t: 'ログアウト' }].map((item) => (
            <ListItemButton key={item.t}><ListItemIcon>{item.i}</ListItemIcon><ListItemText primary={item.t} /></ListItemButton>
          ))}
        </List>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'grey.50' }}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton><Help /></IconButton>
            <Badge badgeContent={2} color="error"><IconButton><Notifications /></IconButton></Badge>
            <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'success.main' }}><Storefront /></Avatar>
              <Box><Typography variant="body2" fontWeight="bold">○○ファーム</Typography><Typography variant="caption" color="text.secondary">山田太郎</Typography></Box>
            </Box>
          </Toolbar>
        </AppBar>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Typography variant="h4" fontWeight="bold">出品者ダッシュボード</Typography>
          <Typography variant="body2" color="text.secondary">出品者向けメインコンテンツ</Typography>
        </Container>
      </Box>
    </Box>
  ),
};

/** 参加者レイアウト */
export const ParticipantLayout: StoryObj = {
  name: '参加者レイアウト',
  render: () => (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold" color="primary.main" sx={{ mr: 4 }}>Auction Port</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[
              { i: <HomeIcon fontSize="small" />, t: 'ホーム', active: true },
              { i: <Gavel fontSize="small" />, t: 'オークション' },
              { i: <Favorite fontSize="small" />, t: 'お気に入り' },
              { i: <EmojiEvents fontSize="small" />, t: '落札一覧' },
              { i: <MenuBook fontSize="small" />, t: 'マニュアル' },
            ].map((nav) => (
              <Box key={nav.t} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1, borderRadius: 1, color: nav.active ? 'primary.main' : 'text.primary', bgcolor: nav.active ? 'primary.50' : 'transparent', fontWeight: nav.active ? 'bold' : 'normal', cursor: 'pointer' }}>
                {nav.i}
                <Typography variant="body2">{nav.t}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton><Help /></IconButton>
          <Badge badgeContent={3} color="error"><IconButton><Notifications /></IconButton></Badge>
          <Avatar sx={{ ml: 1 }}>田</Avatar>
        </Toolbar>
      </AppBar>
      <Box sx={{ bgcolor: 'grey.50', minHeight: 540 }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography variant="h4" fontWeight="bold">参加者ホーム</Typography>
          <Typography variant="body2" color="text.secondary">ヘッダーナビ + メインコンテンツ</Typography>
        </Container>
      </Box>
    </Box>
  ),
};

/** ライブオークション ワークスペース */
export const AuctionWorkspace: StoryObj = {
  name: 'オークション会場ワークスペース',
  render: () => (
    <Box sx={{ minHeight: 600 }}>
      <AppBar position="static" color="default" elevation={1} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold">第17回 大感謝祭オークション</Typography>
          <Chip label="LIVE" color="error" size="small" sx={{ ml: 2, fontWeight: 'bold' }} />
          <Box sx={{ flexGrow: 1 }} />
          <Chip label="リアルタイム接続中" color="success" size="small" sx={{ mr: 1 }} />
          <IconButton><Help /></IconButton>
          <Avatar sx={{ ml: 1 }}>田</Avatar>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex', height: 540 }}>
        <Box component="aside" sx={{ width: 200, p: 2, borderRight: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">レーン</Typography>
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} sx={{ p: 1, my: 0.5, borderRadius: 1, bgcolor: i === 1 ? 'primary.50' : 'transparent', cursor: 'pointer' }}>
              <Typography variant="body2" fontWeight="bold">レーン {i}</Typography>
            </Box>
          ))}
        </Box>
        <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'grey.100' }}>
          <Typography variant="h5" fontWeight="bold">ライブオークション会場</Typography>
          <Typography variant="body2" color="text.secondary">入札用メインエリア</Typography>
        </Box>
      </Box>
    </Box>
  ),
};
