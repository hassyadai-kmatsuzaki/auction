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
import { features } from '../lib/features';

interface Announcement {
  id: number;
  title: string;
  content: string;
  is_important: boolean;
  published_at: string;
  /** 既読済み（F-092）。古い API 応答では無い */
  is_read?: boolean;
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

        // 7日以内の未読数（サーバーで既読を除いて数える）。古い API 応答なら従来どおり7日以内の件数
        // 既読管理が OFF のときは従来どおり「7日以内の件数」
        const serverCount = features.announcementRead ? response.data.data.unread_count : undefined;
        setUnreadCount(typeof serverCount === 'number' ? serverCount : announcements.filter((a: Announcement) =>
          new Date(a.published_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length);
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
    markShownAsRead();
  };

  // ベルを開いたら表示中のお知らせを既読にする。失敗しても表示には影響させない
  const markShownAsRead = async () => {
    if (!features.announcementRead) return;
    const unreadIds = notifications.filter((n) => n.is_read === false).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      const res = await axios.post('/api/announcements/read', { ids: unreadIds }, { silent: true });
      setUnreadCount(res.data.data.unread_count);
    } catch {
      // 既読化の失敗は無視（次回開いたときに再送される）
    }
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

  // 7日以内かつ未読のものだけ強調する（既読情報が無い古い応答では従来どおり7日以内）
  const isNew = (notification: Announcement) => {
    return (!features.announcementRead || notification.is_read !== true)
      && new Date(notification.published_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
                      bgcolor: isNew(notification) ? 'action.hover' : 'transparent',
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
                              fontWeight: isNew(notification) ? 600 : 400,
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
