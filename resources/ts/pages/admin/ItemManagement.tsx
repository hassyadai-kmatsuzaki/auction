import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Avatar,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Snackbar,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Pets as PetsIcon,
  Visibility as VisibilityIcon,
  Image as ImageIcon,
  ViewKanban as ViewKanbanIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface Auction {
  id: number;
  title: string;
  event_date: string;
  status: string;
}

interface Item {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  is_premium: boolean;
  status: string;
  thumbnail_path: string | null;
  seller: {
    id: number;
    name: string;
  } | null;
  media_count: number;
  created_at: string;
}

export default function ItemManagement() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  
  const [auction, setAuction] = useState<Auction | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // フィルター
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 選択・一括操作
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  
  // 削除確認
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // スナックバー
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // 個別ステータス変更メニュー
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<Item | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [auctionId, currentPage, filterStatus]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20',
      });
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await axios.get(`/api/admin/auctions/${auctionId}/items?${params}`);
      
      if (response.data.success) {
        setAuction(response.data.data.auction);
        setItems(response.data.data.items);
        setLastPage(response.data.data.pagination.last_page);
        setTotal(response.data.data.pagination.total);
      }
    } catch (err: any) {
      console.error('生体一覧取得エラー:', err);
      setError(err.response?.data?.message || '生体一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    
    try {
      setDeleting(true);
      await axios.delete(`/api/admin/auctions/${auctionId}/items/${deleteTargetId}`);
      setSnackbar({ open: true, message: '生体を削除しました。', severity: 'success' });
      fetchItems();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '削除に失敗しました。', severity: 'error' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.length === 0 || !bulkStatus) return;
    
    try {
      await axios.patch(`/api/admin/auctions/${auctionId}/items/bulk-status`, {
        item_ids: selectedIds,
        status: bulkStatus,
      });
      setSnackbar({ open: true, message: 'ステータスを更新しました。', severity: 'success' });
      setSelectedIds([]);
      setBulkDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || '更新に失敗しました。', severity: 'error' });
    }
  };

  // 個別ステータス変更
  const handleStatusMenuOpen = (event: React.MouseEvent<HTMLElement>, item: Item) => {
    // オークション中、落札済みは変更不可
    if (['live', 'sold'].includes(item.status)) return;
    setStatusMenuAnchor(event.currentTarget);
    setStatusChangeTarget(item);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuAnchor(null);
    setStatusChangeTarget(null);
  };

  const handleSingleStatusChange = async (newStatus: string) => {
    if (!statusChangeTarget) return;
    
    try {
      setStatusChanging(true);
      await axios.patch(`/api/admin/auctions/${auctionId}/items/${statusChangeTarget.id}`, {
        status: newStatus,
      });
      setSnackbar({ open: true, message: `ステータスを「${getStatusLabel(newStatus)}」に変更しました。`, severity: 'success' });
      handleStatusMenuClose();
      fetchItems();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'ステータス変更に失敗しました。', severity: 'error' });
    } finally {
      setStatusChanging(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return '審査中';
      case 'registered': return '承認済み';
      case 'live': return 'オークション中';
      case 'sold': return '落札済み';
      case 'unsold': return '不落札';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sold': return 'success';
      case 'live': return 'primary';
      case 'registered': return 'success';
      case 'draft': return 'warning';  // 審査中は警告色で目立たせる
      case 'unsold': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  if (loading && items.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/auctions')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            生体管理
          </Typography>
          {auction && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {auction.title} ({new Date(auction.event_date).toLocaleDateString('ja-JP')})
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ViewKanbanIcon />}
            onClick={() => navigate(`/admin/auctions/${auctionId}/lanes`)}
          >
            レーン割り当て
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/admin/auctions/${auctionId}/items/create`)}
          >
            新規登録
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 検索・フィルター */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="品種名・番号で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filterStatus}
              label="ステータス"
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="draft">審査中</MenuItem>
              <MenuItem value="registered">承認済み</MenuItem>
              <MenuItem value="live">オークション中</MenuItem>
              <MenuItem value="sold">落札済み</MenuItem>
              <MenuItem value="unsold">不落札</MenuItem>
              <MenuItem value="cancelled">キャンセル</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleSearch}>
            検索
          </Button>
          
          {selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setBulkDialogOpen(true)}
            >
              選択した{selectedIds.length}件を一括操作
            </Button>
          )}
        </Box>
      </Paper>

      {/* テーブル */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={items.length > 0 && selectedIds.length === items.length}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < items.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell>No.</TableCell>
              <TableCell>品種名</TableCell>
              <TableCell align="center">匹数</TableCell>
              <TableCell align="right">開始価格</TableCell>
              <TableCell align="center">出品者</TableCell>
              <TableCell align="center">メディア</TableCell>
              <TableCell align="center">ステータス</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    生体が登録されていません
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      disabled={['live', 'sold'].includes(item.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      #{item.item_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {item.thumbnail_path ? (
                        <Avatar
                          src={item.thumbnail_path}
                          variant="rounded"
                          sx={{ width: 40, height: 40 }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: '#F0FDF4' }}>
                          <PetsIcon sx={{ color: '#059669' }} />
                        </Avatar>
                      )}
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.species_name}
                        </Typography>
                        {item.is_premium && (
                          <Chip label="プレミアム" color="warning" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">{item.quantity}匹</TableCell>
                  <TableCell align="right">¥{item.start_price.toLocaleString()}</TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.seller?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <ImageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2">{item.media_count}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={getStatusLabel(item.status)}
                      color={getStatusColor(item.status) as any}
                      size="small"
                      onClick={(e) => handleStatusMenuOpen(e, item)}
                      sx={{
                        cursor: ['live', 'sold'].includes(item.status) ? 'default' : 'pointer',
                        '&:hover': {
                          opacity: ['live', 'sold'].includes(item.status) ? 1 : 0.8,
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/admin/auctions/${auctionId}/items/${item.id}/edit`)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setDeleteTargetId(item.id);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={['live', 'sold'].includes(item.status)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 個別ステータス変更メニュー */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleStatusMenuClose}
      >
        <MenuItem
          onClick={() => handleSingleStatusChange('draft')}
          disabled={statusChangeTarget?.status === 'draft' || statusChanging}
        >
          <ListItemIcon>
            <HourglassEmptyIcon fontSize="small" sx={{ color: '#F59E0B' }} />
          </ListItemIcon>
          <ListItemText>審査中</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleSingleStatusChange('registered')}
          disabled={statusChangeTarget?.status === 'registered' || statusChanging}
        >
          <ListItemIcon>
            <CheckCircleIcon fontSize="small" sx={{ color: '#10B981' }} />
          </ListItemIcon>
          <ListItemText>承認済み</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleSingleStatusChange('cancelled')}
          disabled={statusChangeTarget?.status === 'cancelled' || statusChanging}
        >
          <ListItemIcon>
            <CancelIcon fontSize="small" sx={{ color: '#EF4444' }} />
          </ListItemIcon>
          <ListItemText>キャンセル</ListItemText>
        </MenuItem>
      </Menu>

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

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
        全{total}件
      </Typography>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>生体を削除しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            この操作は取り消せません。関連するメディアファイルも削除されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={20} /> : '削除する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 一括操作ダイアログ */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)}>
        <DialogTitle>一括ステータス変更</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {selectedIds.length}件の生体のステータスを変更します。
          </Typography>
          <FormControl fullWidth>
            <InputLabel>新しいステータス</InputLabel>
            <Select
              value={bulkStatus}
              label="新しいステータス"
              onChange={(e) => setBulkStatus(e.target.value)}
            >
              <MenuItem value="draft">審査中</MenuItem>
              <MenuItem value="registered">承認済み</MenuItem>
              <MenuItem value="cancelled">キャンセル</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleBulkStatusUpdate}
            disabled={!bulkStatus}
          >
            更新する
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
