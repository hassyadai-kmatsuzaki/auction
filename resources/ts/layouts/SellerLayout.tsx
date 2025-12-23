import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  Avatar,
  Badge,
  InputBase,
  Paper,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Pets as PetsIcon,
  Receipt as ReceiptIcon,
  LocalShipping as ShippingIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  HelpOutline as HelpIcon,
  Add as AddIcon,
  History as HistoryIcon,
  AccountBalance as BankIcon,
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

export default function SellerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const menuItems = [
    { text: 'ダッシュボード', icon: <DashboardIcon />, path: '/seller/dashboard' },
    { text: '出品申込', icon: <AddIcon />, path: '/seller/submit' },
    { text: '出品履歴', icon: <HistoryIcon />, path: '/seller/items' },
    { text: '売上・精算', icon: <ReceiptIcon />, path: '/seller/sales' },
    { text: '配送状況', icon: <ShippingIcon />, path: '/seller/shipping' },
  ];

  const bottomMenuItems = [
    { text: '出品者情報', icon: <PersonIcon />, path: '/seller/profile' },
    { text: '口座情報', icon: <BankIcon />, path: '/seller/bank' },
    { text: '設定', icon: <SettingsIcon />, path: '/seller/settings' },
  ];

  const isPathActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Mock 出品者情報
  const seller = {
    name: '田中養魚場',
    representative: '田中太郎',
    seller_id: 'S-0001',
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
                selected={isPathActive(item.path)}
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
          アカウント
        </Typography>

        <List sx={{ px: 1 }}>
          {bottomMenuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isPathActive(item.path)}
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
              bgcolor: '#059669',
              fontSize: '0.875rem',
            }}
          >
            {seller.name.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {seller.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {seller.seller_id}
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
            <Chip
              label="出品者"
              size="small"
              sx={{ bgcolor: '#F0FDF4', color: '#059669', fontWeight: 600 }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="ヘルプ">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <HelpIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="通知">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <Badge badgeContent={2} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
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

        {/* フッター */}
        <Box
          component="footer"
          sx={{
            py: 2,
            px: 3,
            mt: 'auto',
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              variant="caption"
              component="a"
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              プライバシーポリシー
            </Typography>
            <Typography variant="caption" color="text.secondary">|</Typography>
            <Typography
              variant="caption"
              component="a"
              href="/legal/tokushoho"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              特定商取引法に基づく表記
            </Typography>
            <Typography variant="caption" color="text.secondary">|</Typography>
            <Typography
              variant="caption"
              component="a"
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              利用規約
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            © 2025 メダカオークション運営事務局
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

