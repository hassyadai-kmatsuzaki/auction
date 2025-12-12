import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Collapse,
  Avatar,
  Badge,
  InputBase,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Campaign as CampaignIcon,
  Event as EventIcon,
  Pets as PetsIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ExpandLess,
  ExpandMore,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  HelpOutline as HelpIcon,
  Gavel as GavelIcon,
  LiveTv as LiveTvIcon,
  EmojiEvents as TrophyIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Psychology as AIIcon,
  CameraAlt as CameraIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  Recommend as RecommendIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

const drawerWidth = 280;

// サイドバーのロゴコンポーネント
function Logo() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Box
        component="img"
        src="/img/logo.png"
        alt="MEDAKA AUCTION PORT"
        sx={{
          height: 48,
          width: '100%',
          objectFit: 'contain',
        }}
      />
    </Box>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [auctionMenuOpen, setAuctionMenuOpen] = React.useState(true);
  const [userMenuOpen, setUserMenuOpen] = React.useState(true);
  const [aiMenuOpen, setAiMenuOpen] = React.useState(true);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const menuItems = [
    { text: 'ダッシュボード', icon: <DashboardIcon />, path: '/admin/dashboard' },
    { text: 'お知らせ管理', icon: <CampaignIcon />, path: '/admin/announcements' },
    { text: '帳票管理', icon: <ReceiptIcon />, path: '/admin/documents' },
  ];

  const auctionSubItems = [
    { text: 'オークション一覧', icon: <EventIcon />, path: '/admin/auctions' },
    { text: '生体管理', icon: <PetsIcon />, path: '/admin/auctions/1/items' },
    { text: 'ライブ管理', icon: <LiveTvIcon />, path: '/admin/auctions/1/live' },
    { text: '落札者管理', icon: <TrophyIcon />, path: '/admin/auctions/1/won-items' },
  ];

  const userSubItems = [
    { text: '出品者登録一覧', icon: <StoreIcon />, path: '/admin/sellers' },
    { text: '買受者登録一覧', icon: <PersonIcon />, path: '/admin/buyers' },
  ];

  const aiSubItems = [
    { text: 'AI分析センター', icon: <AIIcon />, path: '/admin/ai-analytics' },
    { text: '画像認識', icon: <CameraIcon />, path: '/admin/ai/image-recognition' },
    { text: '価格予測', icon: <TimelineIcon />, path: '/admin/ai/price-prediction' },
    { text: '異常検知', icon: <WarningIcon />, path: '/admin/ai/fraud-detection' },
    { text: 'レコメンド', icon: <RecommendIcon />, path: '/admin/ai/recommendations' },
    { text: 'レポート', icon: <AssessmentIcon />, path: '/admin/reports' },
  ];

  const bottomMenuItems = [
    { text: '設定', icon: <SettingsIcon />, path: '/admin/settings' },
  ];

  const isPathActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ロゴエリア */}
      <Box sx={{ p: 2.5, pb: 2 }}>
        <Logo />
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* メインナビゲーション */}
      <Box sx={{ flex: 1, py: 2, overflowY: 'auto' }}>
        <Typography
          variant="caption"
          sx={{
            px: 3,
            py: 1,
            display: 'block',
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          メインメニュー
        </Typography>

        <List sx={{ px: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  py: 1.2,
                  '&.Mui-selected': {
                    backgroundColor: '#F0FDF4',
                    borderRight: '3px solid #059669',
                    '& .MuiListItemIcon-root': {
                      color: '#059669',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#059669',
                      fontWeight: 600,
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                />
              </ListItemButton>
            </ListItem>
          ))}

          {/* オークション管理（折りたたみメニュー） */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => setAuctionMenuOpen(!auctionMenuOpen)}
              sx={{ py: 1.2 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <GavelIcon />
              </ListItemIcon>
              <ListItemText
                primary="オークション管理"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
              {auctionMenuOpen ? (
                <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
              )}
            </ListItemButton>
          </ListItem>
          <Collapse in={auctionMenuOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {auctionSubItems.map((item) => (
                <ListItemButton
                  key={item.path}
                  sx={{
                    pl: 5.5,
                    py: 1,
                    ml: 1,
                    mr: 1,
                    borderRadius: 2,
                    '&.Mui-selected': {
                      backgroundColor: '#F0FDF4',
                      '& .MuiListItemIcon-root': {
                        color: '#059669',
                      },
                      '& .MuiListItemText-primary': {
                        color: '#059669',
                        fontWeight: 600,
                      },
                    },
                  }}
                  selected={location.pathname === item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28, '& svg': { fontSize: 18 } }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* ユーザー管理（折りたたみメニュー） */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              sx={{ py: 1.2 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText
                primary="ユーザー管理"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
              {userMenuOpen ? (
                <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
              )}
            </ListItemButton>
          </ListItem>
          <Collapse in={userMenuOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {userSubItems.map((item) => (
                <ListItemButton
                  key={item.path}
                  sx={{
                    pl: 5.5,
                    py: 1,
                    ml: 1,
                    mr: 1,
                    borderRadius: 2,
                    '&.Mui-selected': {
                      backgroundColor: '#F0FDF4',
                      '& .MuiListItemIcon-root': {
                        color: '#059669',
                      },
                      '& .MuiListItemText-primary': {
                        color: '#059669',
                        fontWeight: 600,
                      },
                    },
                  }}
                  selected={isPathActive(item.path)}
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28, '& svg': { fontSize: 18 } }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>

          {/* AI・分析（折りたたみメニュー） */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => setAiMenuOpen(!aiMenuOpen)}
              sx={{ py: 1.2 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AIIcon />
              </ListItemIcon>
              <ListItemText
                primary="AI・分析"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
              {aiMenuOpen ? (
                <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
              )}
            </ListItemButton>
          </ListItem>
          <Collapse in={aiMenuOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {aiSubItems.map((item) => (
                <ListItemButton
                  key={item.path}
                  sx={{
                    pl: 5.5,
                    py: 1,
                    ml: 1,
                    mr: 1,
                    borderRadius: 2,
                    '&.Mui-selected': {
                      backgroundColor: '#EDE9FE',
                      '& .MuiListItemIcon-root': {
                        color: '#7C3AED',
                      },
                      '& .MuiListItemText-primary': {
                        color: '#7C3AED',
                        fontWeight: 600,
                      },
                    },
                  }}
                  selected={isPathActive(item.path)}
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28, '& svg': { fontSize: 18 } }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </List>

        <Divider sx={{ mx: 2, my: 2 }} />

        <Typography
          variant="caption"
          sx={{
            px: 3,
            py: 1,
            display: 'block',
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          システム
        </Typography>

        <List sx={{ px: 1 }}>
          {bottomMenuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  py: 1.2,
                  '&.Mui-selected': {
                    backgroundColor: '#F0FDF4',
                    borderRight: '3px solid #059669',
                    '& .MuiListItemIcon-root': {
                      color: '#059669',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#059669',
                      fontWeight: 600,
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* ユーザープロファイル */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'grey.50',
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              fontSize: '0.875rem',
            }}
          >
            管
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
              管理者
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              admin@example.com
            </Typography>
          </Box>
          <Tooltip title="ログアウト">
            <IconButton size="small" onClick={handleLogout}>
              <LogoutIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* サイドバー */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* モバイル用ドロワー */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        {/* デスクトップ用ドロワー */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* メインコンテンツ */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ヘッダー */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            {/* 検索バー */}
            <Paper
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                px: 2,
                py: 0.75,
                width: 320,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200',
                boxShadow: 'none',
                borderRadius: 2.5,
              }}
            >
              <SearchIcon sx={{ color: 'text.secondary', fontSize: 20, mr: 1 }} />
              <InputBase
                placeholder="検索..."
                sx={{ flex: 1, fontSize: '0.875rem' }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  bgcolor: 'background.paper',
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.300',
                  fontSize: '0.7rem',
                }}
              >
                ⌘K
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="ヘルプ">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <HelpIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="通知">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <Badge badgeContent={3} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
                  <NotificationsIcon sx={{ fontSize: 20 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* コンテンツエリア */}
        <Box sx={{ flex: 1, p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
