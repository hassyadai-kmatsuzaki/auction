/**
 * デモ用レイアウト
 * ParticipantLayout.tsx と同じ見た目を再現
 */
import React, { useState, useEffect } from 'react';
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
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Gavel as GavelIcon,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
  Favorite as FavoriteIcon,
  SportsEsports as DemoIcon,
  PlayArrow as PlayArrowIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

interface DemoLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
  /** 待機室バナーを表示するか（home以外のページで表示） */
  showAuctionBanner?: boolean;
  /** バナーの「待機室へ入室」ボタンのクリックハンドラ */
  onGoToWaitingRoom?: () => void;
  /** バナーの「待機室へ入室」ボタンを無効化 */
  disableWaitingRoomBanner?: boolean;
  /** ツアー中か（SP時にハンバーガーメニューをオーバーレイの上に表示） */
  tourActive?: boolean;
}

const menuItems = [
  { text: 'ホーム', icon: <HomeIcon />, page: 'home' },
  { text: 'オークション', icon: <GavelIcon />, page: 'items' },
  { text: 'お気に入り', icon: <FavoriteIcon />, page: 'favorites' },
  { text: '落札管理', icon: <ReceiptIcon />, page: 'post-auction' },
  { text: 'デモ', icon: <DemoIcon />, page: 'demo-top' },
  { text: '設定', icon: <SettingsIcon />, page: 'settings' },
];

export function DemoLayout({ currentPage, onNavigate, children, showAuctionBanner, onGoToWaitingRoom, disableWaitingRoomBanner, tourActive }: DemoLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ページ遷移時にサイドバーを閉じる
  useEffect(() => {
    setDrawerOpen(false);
  }, [currentPage]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            data-tour-target="hamburger-menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2, display: { sm: 'none' }, ...(tourActive && { zIndex: 1451, position: 'relative' }) }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="/img/logo.png?v=1"
              alt="MEDAKA AUCTION PORT"
              onClick={() => { setDrawerOpen(false); onNavigate('home'); }}
              sx={{
                height: 48,
                width: '100%',
                maxWidth: 200,
                objectFit: 'contain',
                cursor: 'pointer',
              }}
            />
            <Chip label="DEMO" size="small" />
          </Box>

          {/* デスクトップメニュー */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.page}
                color="inherit"
                onClick={() => onNavigate(item.page)}
                {...(item.page === 'favorites' ? { 'data-tour-target': 'favorites-nav' } : item.page === 'post-auction' ? { 'data-tour-target': 'post-auction-nav' } : {})}
                sx={{
                  borderBottom: currentPage === item.page ? 2 : 0,
                  borderRadius: 0,
                }}
              >
                {item.text}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>

      {/* サイドメニュー（モバイル） */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={tourActive ? { zIndex: 1460 } : undefined}>
        <Box sx={{ width: 250 }} role="presentation">
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">メニュー</Typography>
          </Box>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.page} disablePadding>
                <ListItemButton
                  selected={currentPage === item.page}
                  onClick={() => {
                    onNavigate(item.page);
                    setDrawerOpen(false);
                  }}
                  {...(item.page === 'favorites' ? { 'data-tour-target': 'favorites-nav' } : item.page === 'post-auction' ? { 'data-tour-target': 'post-auction-nav' } : {})}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* 待機室バナー（本番の ParticipantLayout と同じデザイン） */}
      {showAuctionBanner && currentPage !== 'home' && (
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
              2026年春季メダカオークション
            </Typography>
            <Button
              data-tour-target="banner-waiting-room"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={onGoToWaitingRoom}
              disabled={disableWaitingRoomBanner}
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
        {children}
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
