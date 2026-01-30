import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem as SelectMenuItem,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  InputAdornment,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface Announcement {
  id: number;
  title: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'hidden';
  target_roles: string[];
  is_important: boolean;
  published_at: string | null;
  created_by: {
    id: number;
    name: string;
  };
  updated_by: {
    id: number;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface Filters {
  status: string;
  target_role: string;
  is_important: string;
  search: string;
}

export default function AnnouncementManagement() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // フィルター
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    target_role: 'all',
    is_important: 'all',
    search: '',
  });
  
  // メニュー
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  
  // 削除確認ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, [currentPage, filters]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'all')
        ),
      });
      
      const response = await axios.get(`/api/admin/announcements?${params}`);
      
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, announcement: Announcement) => {
    setAnchorEl(event.currentTarget);
    setSelectedAnnouncement(announcement);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAnnouncement(null);
  };

  const handleEdit = () => {
    if (selectedAnnouncement) {
      navigate(`/admin/announcements/${selectedAnnouncement.id}/edit`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedAnnouncement) {
      setDeletingId(selectedAnnouncement.id);
      setDeleteDialogOpen(true);
    }
    handleMenuClose();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    
    try {
      await axios.delete(`/api/admin/announcements/${deletingId}`);
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchAnnouncements();
    } catch (err: any) {
      console.error('削除エラー:', err);
      alert(err.response?.data?.message || '削除に失敗しました。');
    }
  };

  const handleToggleVisibility = async () => {
    if (!selectedAnnouncement) return;
    
    try {
      await axios.patch(`/api/admin/announcements/${selectedAnnouncement.id}/toggle-visibility`);
      handleMenuClose();
      fetchAnnouncements();
    } catch (err: any) {
      console.error('表示切替エラー:', err);
      alert(err.response?.data?.message || '表示切替に失敗しました。');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return '下書き';
      case 'scheduled': return '公開予約';
      case 'published': return '公開中';
      case 'hidden': return '非表示';
      default: return status;
    }
  };

  const getStatusColor = (status: string): 'default' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'draft': return 'default';
      case 'scheduled': return 'warning';
      case 'published': return 'success';
      case 'hidden': return 'error';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '管理者';
      case 'seller': return '出品者';
      case 'participant': return '参加者';
      default: return role;
    }
  };

  const getRoleColor = (role: string): 'primary' | 'secondary' | 'success' => {
    switch (role) {
      case 'admin': return 'primary';
      case 'seller': return 'secondary';
      case 'participant': return 'success';
      default: return 'primary';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">お知らせ管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/announcements/create')}
        >
          新規作成
        </Button>
      </Box>

      {/* フィルター */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="検索"
            placeholder="タイトル・本文で検索"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
            size="small"
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filters.status}
              label="ステータス"
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <SelectMenuItem value="all">全て</SelectMenuItem>
              <SelectMenuItem value="draft">下書き</SelectMenuItem>
              <SelectMenuItem value="scheduled">公開予約</SelectMenuItem>
              <SelectMenuItem value="published">公開中</SelectMenuItem>
              <SelectMenuItem value="hidden">非表示</SelectMenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>対象ユーザー</InputLabel>
            <Select
              value={filters.target_role}
              label="対象ユーザー"
              onChange={(e) => setFilters({ ...filters, target_role: e.target.value })}
            >
              <SelectMenuItem value="all">全て</SelectMenuItem>
              <SelectMenuItem value="admin">管理者</SelectMenuItem>
              <SelectMenuItem value="seller">出品者</SelectMenuItem>
              <SelectMenuItem value="participant">参加者</SelectMenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>重要度</InputLabel>
            <Select
              value={filters.is_important}
              label="重要度"
              onChange={(e) => setFilters({ ...filters, is_important: e.target.value })}
            >
              <SelectMenuItem value="all">全て</SelectMenuItem>
              <SelectMenuItem value="true">重要</SelectMenuItem>
              <SelectMenuItem value="false">通常</SelectMenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>タイトル</TableCell>
                  <TableCell>対象ユーザー</TableCell>
                  <TableCell>ステータス</TableCell>
                  <TableCell>重要</TableCell>
                  <TableCell>公開日時</TableCell>
                  <TableCell>作成者</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {announcements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" py={4}>
                        お知らせがありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  announcements.map((announcement) => (
                    <TableRow key={announcement.id} hover>
                      <TableCell>{announcement.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={announcement.is_important ? 600 : 400}>
                          {announcement.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {announcement.target_roles.map((role) => (
                            <Chip
                              key={role}
                              label={getRoleLabel(role)}
                              size="small"
                              color={getRoleColor(role)}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(announcement.status)}
                          size="small"
                          color={getStatusColor(announcement.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {announcement.is_important && (
                          <Chip label="重要" size="small" color="error" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(announcement.published_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {announcement.created_by.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, announcement)}
                          size="small"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ページネーション */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={lastPage}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
              color="primary"
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
            全{total}件
          </Typography>
        </>
      )}

      {/* 操作メニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedAnnouncement?.status !== 'published' && (
          <MenuItem onClick={handleEdit}>
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            編集
          </MenuItem>
        )}
        
        {(selectedAnnouncement?.status === 'published' || selectedAnnouncement?.status === 'hidden') && (
          <MenuItem onClick={handleToggleVisibility}>
            {selectedAnnouncement?.status === 'published' ? (
              <>
                <VisibilityOffIcon sx={{ mr: 1, fontSize: 20 }} />
                非表示にする
              </>
            ) : (
              <>
                <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
                公開する
              </>
            )}
          </MenuItem>
        )}
        
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          削除
        </MenuItem>
      </Menu>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>お知らせを削除しますか？</DialogTitle>
        <DialogContent>
          この操作は取り消せません。本当に削除しますか？
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
