import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Pagination,
  Stack,
  Divider,
} from '@mui/material';
import { Announcement as AnnouncementIcon } from '@mui/icons-material';
import axios from '../lib/axios';

interface Announcement {
  id: number;
  title: string;
  content: string;
  is_important: boolean;
  published_at: string;
}

interface AnnouncementListProps {
  title?: string;
}

export default function AnnouncementList({ title = 'お知らせ' }: AnnouncementListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 詳細表示
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [currentPage]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/announcements?page=${currentPage}&per_page=20`);
      
      if (response.data.success) {
        setAnnouncements(response.data.data.announcements);
        setLastPage(response.data.data.pagination.last_page);
        setTotal(response.data.data.pagination.total);
      }
    } catch (err: any) {
      console.error('お知らせ取得エラー:', err);
      setError(err.response?.data?.message || 'お知らせの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setDetailOpen(true);
  };

  const handleClose = () => {
    setDetailOpen(false);
    setSelectedAnnouncement(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && announcements.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AnnouncementIcon />
        {title}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {announcements.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" py={4}>
              現在、お知らせはありません
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {announcements.map((announcement) => (
            <Card
              key={announcement.id}
              sx={{
                border: announcement.is_important ? 2 : 0,
                borderColor: 'error.main',
                bgcolor: announcement.is_important ? 'error.50' : 'background.paper',
              }}
            >
              <CardActionArea onClick={() => handleCardClick(announcement)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    {announcement.is_important && (
                      <Chip label="重要" size="small" color="error" />
                    )}
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{
                        flex: 1,
                        fontWeight: announcement.is_important ? 600 : 500,
                      }}
                    >
                      {announcement.title}
                    </Typography>
                  </Box>
                  
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      mb: 1,
                    }}
                  >
                    {announcement.content}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    公開日時: {formatDate(announcement.published_at)}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}

          {/* ページネーション */}
          {lastPage > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={lastPage}
                page={currentPage}
                onChange={(_, page) => setCurrentPage(page)}
                color="primary"
              />
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            全{total}件
          </Typography>
        </Stack>
      )}

      {/* 詳細ダイアログ */}
      <Dialog
        open={detailOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        {selectedAnnouncement && (
          <>
            <DialogTitle>
              {selectedAnnouncement.is_important && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  重要なお知らせ
                </Alert>
              )}
              <Typography variant="h6">
                {selectedAnnouncement.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                公開日時: {formatDate(selectedAnnouncement.published_at)}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedAnnouncement.content}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
