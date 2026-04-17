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
  Stack,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Pets as PetsIcon,
  PlayArrow as PlayArrowIcon,
  Gavel as GavelIcon,
  Receipt as ReceiptIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Event as EventIcon,
  ViewKanban as LaneIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import axios from '../../lib/axios';
import { useUserPreference } from '../../hooks/useUserPreference';

type ViewMode = 'card' | 'list';

interface Auction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: 'preparing' | 'scheduled' | 'live' | 'finished' | 'cancelled';
  description: string | null;
  lane_count: number;
  deposit_required: boolean;
  upload_deadline: string | null;
  payment_deadline_hours: number;
  shipping_deadline_hours: number;
  items_count: number;
  registered_items_count: number;
  draft_items_count: number;
  created_by: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Filters {
  status: string;
  date_from: Date | null;
  date_to: Date | null;
}

export default function AuctionManagement() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // フィルター
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    date_from: null,
    date_to: null,
  });
  
  // メニュー
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  
  // 削除確認ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // ステータス変更ダイアログ
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusChanging, setStatusChanging] = useState(false);
  
  // 成功メッセージ
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 表示モード（ユーザーごとに永続化）
  const [viewMode, setViewMode] = useUserPreference<ViewMode>('admin.auctions.viewMode', 'card');

  useEffect(() => {
    fetchAuctions();
  }, [currentPage, filters]);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20',
        sort_by: 'event_date',
        sort_order: 'desc',
      });
      
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.date_from) {
        params.append('date_from', filters.date_from.toISOString().split('T')[0]);
      }
      if (filters.date_to) {
        params.append('date_to', filters.date_to.toISOString().split('T')[0]);
      }
      
      const response = await axios.get(`/api/admin/auctions?${params}`);
      
      if (response.data.success) {
        setAuctions(response.data.data.auctions);
        setLastPage(response.data.data.pagination.last_page);
        setTotal(response.data.data.pagination.total);
      }
    } catch (err: any) {
      console.error('オークション取得エラー:', err);
      setError(err.response?.data?.message || 'オークションの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, auction: Auction) => {
    setAnchorEl(event.currentTarget);
    setSelectedAuction(auction);
  };

  const handleMenuClose = (keepSelectedAuction: boolean = false) => {
    setAnchorEl(null);
    if (!keepSelectedAuction) {
      setSelectedAuction(null);
    }
  };

  const handleEdit = () => {
    if (selectedAuction) {
      navigate(`/admin/auctions/${selectedAuction.id}/edit`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedAuction) {
      setDeletingId(selectedAuction.id);
      setDeleteDialogOpen(true);
    }
    handleMenuClose();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    
    try {
      await axios.delete(`/api/admin/auctions/${deletingId}`);
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchAuctions();
    } catch (err: any) {
      console.error('削除エラー:', err);
      alert(err.response?.data?.message || '削除に失敗しました。');
    }
  };

  const handleOpenStatusDialog = () => {
    if (selectedAuction) {
      setNewStatus(selectedAuction.status);
      setStatusDialogOpen(true);
    }
    handleMenuClose(true); // selectedAuctionを保持
  };

  const handleStatusChange = async () => {
    if (!selectedAuction || !newStatus) return;
    
    try {
      setStatusChanging(true);
      setError(null);
      const response = await axios.patch(`/api/admin/auctions/${selectedAuction.id}/status`, { status: newStatus });
      setStatusDialogOpen(false);
      setSelectedAuction(null);
      setSuccessMessage(response.data?.message || 'ステータスを変更しました。');
      fetchAuctions();
    } catch (err: any) {
      console.error('ステータス変更エラー:', err);
      const errorMessage = err.response?.data?.message || 'ステータス変更に失敗しました。';
      setError(errorMessage);
      setStatusDialogOpen(false);
    } finally {
      setStatusChanging(false);
    }
  };

  const handleItems = () => {
    if (selectedAuction) {
      navigate(`/admin/auctions/${selectedAuction.id}/items`);
    }
    handleMenuClose();
  };

  const handleLiveControl = () => {
    if (selectedAuction) {
      navigate(`/admin/auctions/${selectedAuction.id}/live`);
    }
    handleMenuClose();
  };

  const handleWonItems = () => {
    if (selectedAuction) {
      navigate(`/admin/auctions/${selectedAuction.id}/won-items`);
    }
    handleMenuClose();
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'preparing': return '準備中';
      case 'scheduled': return '予定';
      case 'live': return '開催中';
      case 'finished': return '終了';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getStatusColor = (status: string): 'default' | 'warning' | 'success' | 'info' | 'error' => {
    switch (status) {
      case 'preparing': return 'default';
      case 'scheduled': return 'warning';
      case 'live': return 'success';
      case 'finished': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (timeString: string) => {
    return timeString ? new Date(`2000-01-01 ${timeString}`).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }) : '-';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">オークション管理</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/auctions/create')}
          >
            新規作成
          </Button>
        </Box>

        {/* フィルター */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>ステータス</InputLabel>
              <Select
                value={filters.status}
                label="ステータス"
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <SelectMenuItem value="all">全て</SelectMenuItem>
                <SelectMenuItem value="preparing">準備中</SelectMenuItem>
                <SelectMenuItem value="scheduled">予定</SelectMenuItem>
                <SelectMenuItem value="live">開催中</SelectMenuItem>
                <SelectMenuItem value="finished">終了</SelectMenuItem>
                <SelectMenuItem value="cancelled">キャンセル</SelectMenuItem>
              </Select>
            </FormControl>

            <DatePicker
              label="開催日（開始）"
              value={filters.date_from}
              onChange={(date) => setFilters({ ...filters, date_from: date })}
              slotProps={{ textField: { size: 'small' } }}
            />

            <DatePicker
              label="開催日（終了）"
              value={filters.date_to}
              onChange={(date) => setFilters({ ...filters, date_to: date })}
              slotProps={{ textField: { size: 'small' } }}
            />

            <Button
              variant="outlined"
              onClick={() => setFilters({ status: 'all', date_from: null, date_to: null })}
            >
              クリア
            </Button>

            <Box sx={{ flex: 1 }} />

            <ToggleButtonGroup
              value={viewMode}
              exclusive
              size="small"
              onChange={(_, v) => v && setViewMode(v)}
              aria-label="表示モード"
            >
              <ToggleButton value="card" aria-label="カード表示">
                <Tooltip title="カード表示">
                  <GridViewIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="list" aria-label="一覧表示">
                <Tooltip title="一覧表示">
                  <ListViewIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
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
        ) : auctions.length === 0 ? (
          <Paper sx={{ py: 8, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              オークションがありません
            </Typography>
          </Paper>
        ) : (
          <>
            {viewMode === 'card' ? (
              <Grid container spacing={2}>
                {auctions.map((auction) => {
                  const total = (auction.registered_items_count || 0) + (auction.draft_items_count || 0);
                  const progress = total > 0 ? (auction.registered_items_count / total) * 100 : 0;
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={auction.id}>
                      <Card
                        elevation={0}
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          border: '1px solid',
                          borderColor: 'divider',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          },
                        }}
                      >
                        <CardActionArea
                          onClick={() => navigate(`/admin/auctions/${auction.id}/items`)}
                          sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                        >
                          <CardContent sx={{ flex: 1, width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                              <Chip
                                label={getStatusLabel(auction.status)}
                                size="small"
                                color={getStatusColor(auction.status)}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleMenuOpen(e, auction);
                                }}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Box>

                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 700,
                                mb: 1.5,
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                minHeight: '2.8em',
                              }}
                            >
                              {auction.title}
                            </Typography>

                            <Stack spacing={0.75} sx={{ mb: 1.5, color: 'text.secondary' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <EventIcon fontSize="inherit" sx={{ fontSize: 16 }} />
                                <Typography variant="caption">{formatDate(auction.event_date)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <TimeIcon fontSize="inherit" sx={{ fontSize: 16 }} />
                                <Typography variant="caption">{formatTime(auction.start_time)}</Typography>
                              </Box>
                            </Stack>

                            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PetsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" fontWeight={600}>
                                  {auction.registered_items_count || 0}
                                </Typography>
                                {(auction.draft_items_count || 0) > 0 && (
                                  <Typography variant="caption" sx={{ color: 'warning.main' }}>
                                    +{auction.draft_items_count}
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LaneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" fontWeight={600}>
                                  {auction.lane_count}
                                </Typography>
                              </Box>
                            </Box>

                            {total > 0 && (
                              <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{ height: 4, borderRadius: 2, mt: 1 }}
                              />
                            )}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>オークション名</TableCell>
                      <TableCell>開催日</TableCell>
                      <TableCell>開始時刻</TableCell>
                      <TableCell align="center">ステータス</TableCell>
                      <TableCell align="right">生体数</TableCell>
                      <TableCell align="right">レーン数</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auctions.map((auction) => (
                      <TableRow
                        key={auction.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/auctions/${auction.id}/items`)}
                      >
                        <TableCell>{auction.id}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {auction.title}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(auction.event_date)}</TableCell>
                        <TableCell>{formatTime(auction.start_time)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getStatusLabel(auction.status)}
                            size="small"
                            color={getStatusColor(auction.status)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {auction.registered_items_count || 0}個体
                            </Typography>
                            {(auction.draft_items_count || 0) > 0 && (
                              <Typography variant="caption" sx={{ color: '#F59E0B' }}>
                                +{auction.draft_items_count}審査中
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{auction.lane_count}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMenuOpen(e, auction);
                            }}
                            size="small"
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

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
          onClose={() => handleMenuClose()}
        >
          <MenuItem onClick={handleItems}>
            <PetsIcon sx={{ mr: 1, fontSize: 20 }} />
            生体管理
          </MenuItem>
          
          {selectedAuction?.status === 'live' && (
            <MenuItem onClick={handleLiveControl}>
              <GavelIcon sx={{ mr: 1, fontSize: 20 }} />
              ライブ管理
            </MenuItem>
          )}
          
          {selectedAuction?.status === 'finished' && (
            <MenuItem onClick={handleWonItems}>
              <ReceiptIcon sx={{ mr: 1, fontSize: 20 }} />
              落札者管理
            </MenuItem>
          )}
          
          <MenuItem onClick={handleEdit}>
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            編集
          </MenuItem>
          
          <MenuItem onClick={handleOpenStatusDialog}>
            <PlayArrowIcon sx={{ mr: 1, fontSize: 20 }} />
            ステータス変更
          </MenuItem>
          
          <MenuItem
            onClick={handleDelete}
            sx={{ color: 'error.main' }}
            disabled={selectedAuction?.status === 'live'}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            削除
          </MenuItem>
        </Menu>

        {/* 削除確認ダイアログ */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>オークションを削除しますか？</DialogTitle>
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

        {/* ステータス変更ダイアログ */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>ステータス変更</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>ステータス</InputLabel>
              <Select
                value={newStatus}
                label="ステータス"
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <SelectMenuItem value="preparing">準備中</SelectMenuItem>
                <SelectMenuItem value="scheduled">予定（出品受付中）</SelectMenuItem>
                <SelectMenuItem value="live">開催中</SelectMenuItem>
                <SelectMenuItem value="finished">終了</SelectMenuItem>
                <SelectMenuItem value="cancelled">キャンセル</SelectMenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>準備中</strong>: 内部準備中（出品者に非表示）<br />
                <strong>予定</strong>: 出品受付中（出品者に表示）<br />
                <strong>開催中</strong>: ライブオークション進行中<br />
                <strong>終了</strong>: オークション完了<br />
                <strong>キャンセル</strong>: 中止
              </Typography>
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)} disabled={statusChanging}>キャンセル</Button>
            <Button onClick={handleStatusChange} variant="contained" disabled={!newStatus || statusChanging}>
              {statusChanging ? <CircularProgress size={20} /> : '変更'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 成功メッセージSnackbar */}
        <Snackbar
          open={!!successMessage}
          autoHideDuration={4000}
          onClose={() => setSuccessMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSuccessMessage(null)} severity="success" sx={{ width: '100%' }}>
            {successMessage}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}
