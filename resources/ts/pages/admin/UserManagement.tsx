import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Checkbox,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface Role {
  id: number;
  name: string;
  display_name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  trade_name: string | null;
  company_name: string | null;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  is_active: boolean;
  roles: Role[];
  last_login_at: string | null;
  created_at: string;
}

interface PaginatedResponse {
  current_page: number;
  data: User[];
  total: number;
  per_page: number;
  last_page: number;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ページネーション
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  
  // フィルタ
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // 複数選択（ページ横断で蓄積される。ページを跨いで選んでも保持される設計）
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const isAllOnPageSelected = users.length > 0 && users.every(u => selectedIds.has(u.id));
  const isSomeOnPageSelected = users.some(u => selectedIds.has(u.id)) && !isAllOnPageSelected;

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAllOnPageSelected) {
        users.forEach(u => next.delete(u.id));
      } else {
        users.forEach(u => next.add(u.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  /**
   * 選択中ユーザーをまとめてメール配信フォームに渡す。
   * URL に乗せると 100 件超で長くなるので sessionStorage 経由にしている。
   */
  const handleBulkEmail = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    sessionStorage.setItem('email-campaign:initial-user-ids', JSON.stringify(ids));
    navigate('/admin/email-campaigns/create?from=user_selection');
  };

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, statusFilter, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        per_page: String(rowsPerPage),
      });

      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (roleFilter) params.append('role', roleFilter);

      const response = await axios.get(`/api/admin/users?${params.toString()}`);
      
      if (response.data.success) {
        const data: PaginatedResponse = response.data.data;
        setUsers(data.data);
        setTotal(data.total);
      }
    } catch (err: any) {
      console.error('ユーザー一覧取得エラー:', err);
      setError(err.response?.data?.message || 'ユーザー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(0);
    fetchUsers();
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '申請中',
      approved: '承認済み',
      suspended: '停止中',
      rejected: '拒否',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
      pending: 'default',
      approved: 'success',
      suspended: 'warning',
      rejected: 'error',
    };
    return colors[status] || 'default';
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'info'> = {
      admin: 'primary',
      seller: 'secondary',
      participant: 'info',
    };
    return colors[role] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          ユーザー管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => navigate('/admin/users/create')}
        >
          新規作成
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 一括操作バー（選択中のみ表示） */}
      {selectedIds.size > 0 && (
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'primary.50', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            <strong>{selectedIds.size}</strong> 人を選択中
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={clearSelection}>選択解除</Button>
            <Button size="small" variant="contained" startIcon={<EmailIcon />} onClick={handleBulkEmail}>
              選択ユーザーにメール送信
            </Button>
          </Stack>
        </Paper>
      )}

      {/* 検索・フィルタ */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="名前・メールアドレスで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 300 }}
          />
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              label="ステータス"
            >
              <MenuItem value="">全て</MenuItem>
              <MenuItem value="pending">申請中</MenuItem>
              <MenuItem value="approved">承認済み</MenuItem>
              <MenuItem value="suspended">停止中</MenuItem>
              <MenuItem value="rejected">拒否</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>ロール</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              label="ロール"
            >
              <MenuItem value="">全て</MenuItem>
              <MenuItem value="admin">管理者</MenuItem>
              <MenuItem value="seller">出品者</MenuItem>
              <MenuItem value="participant">参加者</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
          >
            検索
          </Button>

          <Tooltip title="リロード">
            <IconButton onClick={fetchUsers}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* ユーザー一覧テーブル */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={isSomeOnPageSelected}
                      checked={isAllOnPageSelected}
                      onChange={toggleAllOnPage}
                      inputProps={{ 'aria-label': 'このページの全員を選択' }}
                    />
                  </TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>名前</TableCell>
                  <TableCell>屋号</TableCell>
                  <TableCell>会社名</TableCell>
                  <TableCell>メールアドレス</TableCell>
                  <TableCell>ロール</TableCell>
                  <TableCell align="center">ステータス</TableCell>
                  <TableCell>最終ログイン</TableCell>
                  <TableCell>登録日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        ユーザーが見つかりませんでした
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} hover selected={selectedIds.has(user.id)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleOne(user.id)}
                          inputProps={{ 'aria-label': `ユーザー ${user.id} を選択` }}
                        />
                      </TableCell>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {user.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.trade_name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.company_name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {user.roles.map((role) => (
                            <Chip
                              key={role.id}
                              label={role.display_name}
                              color={getRoleColor(role.name)}
                              size="small"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusLabel(user.status)}
                          color={getStatusColor(user.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleString('ja-JP', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(user.created_at).toLocaleString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="詳細">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50, 100]}
              labelRowsPerPage="表示件数:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
            />
          </>
        )}
      </TableContainer>
    </Box>
  );
}
