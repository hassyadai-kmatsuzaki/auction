import React, { useState, useEffect } from 'react';
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
  List as ListIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayArrowIcon,
  SportsEsports as DemoIcon,
  Favorite as FavoriteIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import RoleSwitcher from '../components/RoleSwitcher';
import axios from '../lib/axios';
import type { Auction } from '../types';

export default function ParticipantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [liveAuction, setLiveAuction] = useState<Auction | null>(null);
  const [scheduledAuction, setScheduledAuction] = useState<Auction | null>(null);

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const res = await axios.get('/api/participant/auctions');
        if (res.data.success) {
          const auctions: Auction[] = res.data.data.auctions;
          setLiveAuction(auctions.find(a => a.status === 'live') ?? null);
          setScheduledAuction(auctions.find(a => a.status === 'scheduled') ?? null);
        }
      } catch { /* ignore */ }
    };
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { text: 'ホーム', icon: <HomeIcon />, path: '/participant/home' },
    { text: 'オークション', icon: <GavelIcon />, path: '/participant/auctions' },
    { text: 'お気に入り', icon: <FavoriteIcon />, path: '/participant/favorites' },
    { text: '落札管理', icon: <ReceiptIcon />, path: '/participant/won-items' },
    { text: 'デモ', icon: <DemoIcon />, path: '/participant/demo' },
    { text: '設定', icon: <SettingsIcon />, path: '/participant/settings' },
  ];

  const handleLogout = async () => {
    await logout();
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
          
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="/img/logo.png"
              alt="MEDAKA AUCTION PORT"
              onClick={() => navigate('/participant/home')}
              sx={{
                height: 48,
                width: '100%',
                maxWidth: 200,
                objectFit: 'contain',
                cursor: 'pointer',
              }}
            />
            {user && <RoleSwitcher roles={user.roles} currentPath={location.pathname} />}
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

      {/* オークション状態バナー */}
      {liveAuction && !location.pathname.includes('/live') && (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
            color: 'white',
            py: 1,
            px: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            '&:hover': { filter: 'brightness(1.1)' },
          }}
          onClick={() => navigate(`/participant/auction/${liveAuction.id}/live`)}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: '#ef4444',
              px: 1,
              py: 0.25,
              borderRadius: 0.75,
              fontSize: '0.7rem',
              fontWeight: 800,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'white' }} />
            LIVE
          </Box>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
            {liveAuction.title} 開催中
          </Typography>
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
      {!liveAuction && scheduledAuction && !location.pathname.includes('/live') && (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
            color: 'white',
            py: 1,
            px: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            '&:hover': { filter: 'brightness(1.1)' },
          }}
          onClick={() => navigate(`/participant/auction/${scheduledAuction.id}/live`)}
        >
          <PlayArrowIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
            {scheduledAuction.title} — 待機室へ入室
          </Typography>
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Box>
      )}

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
          <Typography variant="body2" color="text.secondary" align="center">
            © 2025 メダカオークション運営事務局
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

