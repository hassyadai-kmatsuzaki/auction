import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
  CircularProgress,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NewReleases as NewReleasesIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from '../lib/axios';

interface Announcement {
  id: number;
  title: string;
  content: string;
  is_important: boolean;
  published_at: string;
}

interface HeaderNotificationsProps {
  role: 'admin' | 'seller' | 'participant';
}

export default function HeaderNotifications({ role }: HeaderNotificationsProps) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const open = Boolean(anchorEl);

  // 通知を取得
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/announcements?per_page=5');
      if (response.data.success) {
        const announcements = response.data.data.announcements;
        setNotifications(announcements);
        
        // 7日以内の未読カウント
        const recentCount = announcements.filter((a: Announcement) => 
          new Date(a.published_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length;
        setUnreadCount(recentCount);
      }
    } catch (err) {
      console.error('通知取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Announcement) => {
    handleClose();
    // ダッシュボードまたはお知らせ一覧へ遷移
    if (role === 'admin') {
      navigate('/admin/announcements');
    } else if (role === 'seller') {
      navigate('/seller/dashboard');
    } else {
      navigate('/participant/home');
    }
  };

  const handleViewAll = () => {
    handleClose();
    if (role === 'admin') {
      navigate('/admin/announcements');
    } else if (role === 'seller') {
      navigate('/seller/dashboard');
    } else {
      navigate('/participant/home');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今日';
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  };

  const isNew = (dateString: string) => {
    return new Date(dateString) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  };

  return (
    <>
      <IconButton
        size="small"
        sx={{ color: 'text.secondary' }}
        onClick={handleClick}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
        >
          <NotificationsIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 360, maxHeight: 480 },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            お知らせ
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              新しいお知らせはありません
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      bgcolor: isNew(notification.published_at) ? 'action.hover' : 'transparent',
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        mr: 1.5,
                        bgcolor: notification.is_important ? '#FEE2E2' : '#DBEAFE',
                      }}
                    >
                      {notification.is_important ? (
                        <NewReleasesIcon sx={{ fontSize: 18, color: '#DC2626' }} />
                      ) : (
                        <InfoIcon sx={{ fontSize: 18, color: '#2563EB' }} />
                      )}
                    </Avatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: isNew(notification.published_at) ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                          >
                            {notification.title}
                          </Typography>
                          {notification.is_important && (
                            <Chip
                              label="重要"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: '#FEE2E2',
                                color: '#DC2626',
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary' }}
                        >
                          {formatDate(notification.published_at)}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button fullWidth size="small" onClick={handleViewAll}>
            すべてのお知らせを見る
          </Button>
        </Box>
      </Popover>
    </>
  );
}
