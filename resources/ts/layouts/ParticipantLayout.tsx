import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import SubscriptionGate from '../components/SubscriptionGate';
import ShippingAddressGate from '../components/ShippingAddressGate';
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

  Settings as SettingsIcon,
  PlayArrow as PlayArrowIcon,
  SportsEsports as DemoIcon,
  Favorite as FavoriteIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import RoleSwitcher from '../components/RoleSwitcher';
import TutorialGuide from '../features/tutorial/TutorialGuide';
import axios from '../lib/axios';
import type { Auction } from '../types';

export default function ParticipantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [liveAuction, setLiveAuction] = useState<Auction | null>(null);
  const [scheduledAuction, setScheduledAuction] = useState<Auction | null>(null);

  // ページ遷移時にサイドバーを閉じる
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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

  const hasMultipleRoles = user
    ? ['admin', 'seller', 'participant'].filter(name => user.roles.some(r => r.name === name)).length >= 2
    : false;

  const menuItems = [
    { text: 'ホーム', icon: <HomeIcon />, path: '/participant/home' },
    { text: 'オークション', icon: <GavelIcon />, path: '/participant/auctions' },
    { text: 'お気に入り', icon: <FavoriteIcon />, path: '/participant/favorites' },
    { text: '落札管理', icon: <ReceiptIcon />, path: '/participant/won-items' },
    { text: 'デモ', icon: <DemoIcon />, path: '/presentation' },
    { text: '設定', icon: <SettingsIcon />, path: '/participant/settings' },
  ];

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout();
    window.location.href = '/login';
  };

  const handleMenuClick = (path: string) => {
    if (path === '/presentation') {
      window.open(path, '_blank', 'noopener,noreferrer');
      setDrawerOpen(false);
      return;
    }
    window.location.href = path;
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
              src="/img/logo.png?v=1"
              alt="MEDAKA AUCTION PORT"
              onClick={() => { window.location.href = '/participant/home'; }}
              sx={{
                height: 48,
                width: '100%',
                maxWidth: 200,
                objectFit: 'contain',
                cursor: 'pointer',
                display: hasMultipleRoles ? { xs: 'none', sm: 'block' } : 'block',
              }}
            />
            <TutorialGuide role="participant" />
            {user && <RoleSwitcher roles={user.roles} currentPath={location.pathname} />}
          </Box>

          {/* デスクトップメニュー */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => {
                  if (item.path === '/presentation') {
                    window.open(item.path, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  navigate(item.path);
                }}
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
                  onClick={() => handleMenuClick(item.path)}
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
              <ListItemButton
                onClick={() => {
                  handleLogout();
                }}
              >
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="ログアウト" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* オークション開催中バナー（Homeページと同じデザイン） */}
      {liveAuction && !location.pathname.includes('/live') && location.pathname !== '/participant' && location.pathname !== '/participant/home' && (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
            color: 'white',
            py: { xs: 3, md: 4 },
            px: 2,
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: '#ef4444',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  animation: 'livePulse 2s infinite',
                  '@keyframes livePulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                LIVE
              </Box>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                オークション開催中！
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
              {liveAuction.title}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/participant/auction/${liveAuction.id}/live`)}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              今すぐ参加する
            </Button>
          </Container>
        </Box>
      )}

      {/* 待機室バナー（開催中と同じ青系デザイン） */}
      {!liveAuction && scheduledAuction && !location.pathname.includes('/live') && location.pathname !== '/participant' && location.pathname !== '/participant/home' && (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
            color: 'white',
            py: { xs: 3, md: 4 },
            px: 2,
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 16 }} />
                待機室
              </Box>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                まもなく開催
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
              {scheduledAuction.title}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/participant/auction/${scheduledAuction.id}/live`)}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              待機室へ入室
            </Button>
          </Container>
        </Box>
      )}

      {/* メインコンテンツ */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <SubscriptionGate>
          <ShippingAddressGate>
            <Outlet />
          </ShippingAddressGate>
        </SubscriptionGate>
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
            © 2025 日本メダカオンライン市場運営事務局
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

