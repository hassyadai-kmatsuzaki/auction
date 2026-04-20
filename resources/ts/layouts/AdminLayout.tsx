import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  Box,
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
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Campaign as CampaignIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ExpandLess,
  ExpandMore,
  Gavel as GavelIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Psychology as AIIcon,
  Cloud as CloudIcon,
  CameraAlt as CameraIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  Recommend as RecommendIcon,
  Assessment as AssessmentIcon,
  CreditCard as CreditCardIcon,
  Subscriptions as SubscriptionsIcon,
  WorkspacePremium as PlanIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import RoleSwitcher from '../components/RoleSwitcher';

const drawerWidth = 280;

// サイドバーのロゴコンポーネント
function Logo() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Box
        component="img"
        src="/img/logo.png?v=1"
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
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(true);
  const [aiMenuOpen, setAiMenuOpen] = React.useState(false);

  // ページ遷移時にサイドバーを閉じる
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    window.location.href = '/login';
  };

  const handleMenuNavigate = (path: string) => {
    window.location.href = path;
  };

  const menuItems = [
    { text: 'ダッシュボード', icon: <DashboardIcon />, path: '/admin/dashboard' },
    { text: 'お知らせ管理', icon: <CampaignIcon />, path: '/admin/announcements' },
  ];

  const userSubItems = [
    { text: '出品者登録一覧', icon: <StoreIcon />, path: '/admin/sellers' },
    { text: '買受者登録一覧', icon: <PersonIcon />, path: '/admin/buyers' },
  ];

  const bottomMenuItems = [
    { text: '設定', icon: <SettingsIcon />, path: '/admin/settings' },
    { text: 'インフラスケーリング', icon: <CloudIcon />, path: '/admin/scaling' },
    { text: '帳票管理', icon: <ReceiptIcon />, path: '/admin/documents' },
    { text: 'レポート', icon: <AssessmentIcon />, path: '/admin/reports' },
  ];

  const billingMenuItems = [
    { text: 'プラン管理', icon: <PlanIcon />, path: '/admin/plans' },
    { text: 'サブスクリプション', icon: <SubscriptionsIcon />, path: '/admin/subscriptions' },
    { text: '決済管理', icon: <CreditCardIcon />, path: '/admin/payments' },
  ];

  const aiSubItems = [
    { text: 'AI分析ダッシュボード', icon: <AIIcon />, path: '/admin/ai-analytics' },
    { text: '画像認識', icon: <CameraIcon />, path: '/admin/ai/image-recognition' },
    { text: '価格予測', icon: <TimelineIcon />, path: '/admin/ai/price-prediction' },
    { text: '不正検知', icon: <WarningIcon />, path: '/admin/ai/fraud-detection' },
    { text: 'レコメンド', icon: <RecommendIcon />, path: '/admin/ai/recommendations' },
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
                onClick={() => handleMenuNavigate(item.path)}
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

          {/* オークション管理（統合後の唯一の入口） */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={isPathActive('/admin/auctions')}
              onClick={() => handleMenuNavigate('/admin/auctions')}
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
              <ListItemIcon sx={{ minWidth: 36 }}>
                <GavelIcon />
              </ListItemIcon>
              <ListItemText
                primary="オークション管理"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
            </ListItemButton>
          </ListItem>

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
                  onClick={() => handleMenuNavigate(item.path)}
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
          年会費・決済
        </Typography>

        <List sx={{ px: 1 }}>
          {billingMenuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleMenuNavigate(item.path)}
                sx={{
                  py: 1.2,
                  '&.Mui-selected': {
                    backgroundColor: '#F0FDF4',
                    borderRight: '3px solid #059669',
                    '& .MuiListItemIcon-root': { color: '#059669' },
                    '& .MuiListItemText-primary': { color: '#059669', fontWeight: 600 },
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
                onClick={() => handleMenuNavigate(item.path)}
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
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}

          {/* AI機能（折りたたみメニュー） */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => setAiMenuOpen(!aiMenuOpen)}
              sx={{
                py: 1.2,
                ...(location.pathname.startsWith('/admin/ai') ? {
                  backgroundColor: '#F5F3FF',
                  '& .MuiListItemIcon-root': { color: '#7C3AED' },
                  '& .MuiListItemText-primary': { color: '#7C3AED', fontWeight: 600 },
                } : {}),
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AIIcon />
              </ListItemIcon>
              <ListItemText
                primary="AI機能"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
              <Chip label="NEW" size="small" color="secondary" sx={{ height: 18, fontSize: '0.6rem', mr: 1 }} />
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
                      backgroundColor: '#F5F3FF',
                      '& .MuiListItemIcon-root': { color: '#7C3AED' },
                      '& .MuiListItemText-primary': { color: '#7C3AED', fontWeight: 600 },
                    },
                  }}
                  selected={location.pathname === item.path}
                  onClick={() => handleMenuNavigate(item.path)}
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
            <IconButton data-testid="logout-button" size="small" onClick={handleLogout}>
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
            {/* SP時はロゴ表示 */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}><Logo /></Box>
            {/* ロール切り替えセレクトボックス */}
            {user && <RoleSwitcher roles={user.roles} currentPath={location.pathname} />}
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
