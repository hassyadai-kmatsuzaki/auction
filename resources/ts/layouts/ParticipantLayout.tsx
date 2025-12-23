import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Gavel as GavelIcon,
  Receipt as ReceiptIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

export default function ParticipantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const menuItems = [
    { text: 'お知らせ', icon: <HomeIcon />, path: '/participant/home' },
    { text: 'オークション会場', icon: <GavelIcon />, path: '/participant/auction/1/live' },
    { text: '落札管理', icon: <ReceiptIcon />, path: '/participant/won-items' },
  ];

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <Box
              component="img"
              src="/img/logo.png"
              alt="MEDAKA AUCTION PORT"
              sx={{
                height: 48,
                width: '100%',
                maxWidth: 200,
                objectFit: 'contain',
              }}
            />
          </Box>

          {/* デスクトップメニュー */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => navigate(item.path)}
                sx={{
                  borderBottom: location.pathname === item.path ? 2 : 0,
                  borderRadius: 0,
                }}
              >
                {item.text}
              </Button>
            ))}
            <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
              ログアウト
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* サイドメニュー（モバイル） */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 250 }} role="presentation">
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">メニュー</Typography>
          </Box>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => {
                    navigate(item.path);
                    setDrawerOpen(false);
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="ログアウト" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* メインコンテンツ */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <Outlet />
      </Box>

      {/* フッター */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              mb: 1,
            }}
          >
            <Typography
              variant="caption"
              component="a"
              href="/legal/privacy"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={(e) => {
                e.preventDefault();
                navigate('/legal/privacy');
              }}
            >
              プライバシーポリシー
            </Typography>
            <Typography variant="caption" color="text.secondary">|</Typography>
            <Typography
              variant="caption"
              component="a"
              href="/legal/tokushoho"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={(e) => {
                e.preventDefault();
                navigate('/legal/tokushoho');
              }}
            >
              特定商取引法に基づく表記
            </Typography>
            <Typography variant="caption" color="text.secondary">|</Typography>
            <Typography
              variant="caption"
              component="a"
              href="/legal/terms"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={(e) => {
                e.preventDefault();
                navigate('/legal/terms');
              }}
            >
              利用規約
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" align="center">
            © 2025 メダカオークション運営事務局
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

