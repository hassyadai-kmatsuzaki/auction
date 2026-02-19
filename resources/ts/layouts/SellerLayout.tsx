import React, { useEffect, useState } from 'react';
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
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Paper,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Receipt as ReceiptIcon,
  LocalShipping as ShippingIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  MenuBook as MenuBookIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import RoleSwitcher from '../components/RoleSwitcher';
import HeaderNotifications from '../components/HeaderNotifications';
import HeaderHelp from '../components/HeaderHelp';
import axios from '../lib/axios';

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

interface SellerProfile {
  id: number;
  seller_name: string;
  seller_code: string;
}

export default function SellerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [profileError, setProfileError] = useState(false);

  // プロフィール取得（初回のみ）
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('/api/seller/profile');
        if (response.data.success && response.data.data.profile) {
          setSellerProfile({
            id: response.data.data.profile.id,
            seller_name: response.data.data.profile.seller_name || user?.name || '出品者',
            seller_code: response.data.data.profile.seller_code || '',
          });
        }
        setProfileError(false);
      } catch (err: unknown) {
        // プロフィールがない場合もここに来る（ProfileControllerで自動作成されるはず）
        setProfileError(true);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user?.name]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    await logout();
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
    { text: 'マニュアル', icon: <MenuBookIcon />, path: '/seller/manual' },
    { text: '出品者情報・設定', icon: <SettingsIcon />, path: '/seller/profile' },
  ];

  const isPathActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // 出品者情報（プロフィールから取得、なければユーザー名を使用）
  const seller = {
    name: sellerProfile?.seller_name || user?.name || '出品者',
    seller_id: sellerProfile?.seller_code || '',
  };

  // プロフィールロード中
  if (profileLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // プロフィール作成が必要な場合（プロフィールページ以外でエラーの場合）
  if (profileError && !location.pathname.startsWith('/seller/profile')) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            出品者プロフィールの設定
          </Typography>
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
            出品者として活動するには、まずプロフィール情報の登録が必要です。
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            屋号、連絡先、口座情報などを登録してください。
            これらの情報は出品・精算に使用されます。
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/seller/profile')}
            startIcon={<SettingsIcon />}
          >
            プロフィールを設定する
          </Button>
        </Paper>
      </Box>
    );
  }

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ロゴエリア */}
      <Box sx={{ p: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Logo />
        </Box>
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
            {seller.name?.charAt(0) || 'S'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {seller.name}
            </Typography>
            {seller.seller_id && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                {seller.seller_id}
              </Typography>
            )}
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
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}><Logo /></Box>
            {user && <RoleSwitcher roles={user.roles} currentPath={location.pathname} />}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="ヘルプ">
              <span>
                <HeaderHelp role="seller" />
              </span>
            </Tooltip>
            <Tooltip title="通知">
              <span>
                <HeaderNotifications role="seller" />
              </span>
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

