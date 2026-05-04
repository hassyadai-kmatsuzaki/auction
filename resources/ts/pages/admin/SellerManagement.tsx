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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Link,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  Person as PersonIcon,
  Instagram as InstagramIcon,
  Twitter as TwitterIcon,
  YouTube as YouTubeIcon,
  Language as LanguageIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface Role {
  id: number;
  name: string;
  display_name: string;
}

interface SellerProfile {
  profile_image_url?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  youtube?: string | null;
  website?: string | null;
  other_sns?: string | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  is_active: boolean;
  roles: Role[];
  last_login_at: string | null;
  created_at: string;
  profile_image_url?: string | null;
  seller_profile?: SellerProfile | null;
}

interface PaginatedResponse {
  current_page: number;
  data: User[];
  total: number;
  per_page: number;
  last_page: number;
}

const buildSnsHref = (kind: 'instagram' | 'twitter' | 'youtube' | 'website', value: string): string => {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '');
  switch (kind) {
    case 'instagram':
      return `https://www.instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'youtube':
      return v.startsWith('@') ? `https://www.youtube.com/${v}` : `https://www.youtube.com/${handle}`;
    case 'website':
      return `https://${v}`;
  }
};

const SnsCell: React.FC<{ profile?: SellerProfile | null }> = ({ profile }) => {
  if (!profile) {
    return <Typography variant="body2" color="text.disabled">-</Typography>;
  }
  const items: Array<{ key: string; icon: React.ReactNode; value: string | null | undefined; href?: string; label: string }> = [
    {
      key: 'instagram',
      icon: <InstagramIcon fontSize="small" sx={{ color: '#E4405F' }} />,
      value: profile.instagram,
      href: profile.instagram ? buildSnsHref('instagram', profile.instagram) : undefined,
      label: profile.instagram ? `Instagram: ${profile.instagram}` : '',
    },
    {
      key: 'twitter',
      icon: <TwitterIcon fontSize="small" sx={{ color: '#1DA1F2' }} />,
      value: profile.twitter,
      href: profile.twitter ? buildSnsHref('twitter', profile.twitter) : undefined,
      label: profile.twitter ? `X / Twitter: ${profile.twitter}` : '',
    },
    {
      key: 'youtube',
      icon: <YouTubeIcon fontSize="small" sx={{ color: '#FF0000' }} />,
      value: profile.youtube,
      href: profile.youtube ? buildSnsHref('youtube', profile.youtube) : undefined,
      label: profile.youtube ? `YouTube: ${profile.youtube}` : '',
    },
    {
      key: 'website',
      icon: <LanguageIcon fontSize="small" sx={{ color: '#1976d2' }} />,
      value: profile.website,
      href: profile.website ? buildSnsHref('website', profile.website) : undefined,
      label: profile.website ? `Web: ${profile.website}` : '',
    },
    {
      key: 'other_sns',
      icon: <PublicIcon fontSize="small" sx={{ color: '#757575' }} />,
      value: profile.other_sns,
      href: profile.other_sns && /^https?:\/\//i.test(profile.other_sns.trim()) ? profile.other_sns.trim() : undefined,
      label: profile.other_sns ? `その他: ${profile.other_sns}` : '',
    },
  ];

  const visible = items.filter((item) => !!item.value);
  if (visible.length === 0) {
    return <Typography variant="body2" color="text.disabled">-</Typography>;
  }

  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'nowrap' }}>
      {visible.map((item) => (
        <Tooltip key={item.key} title={item.label} arrow>
          {item.href ? (
            <Link
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
              onClick={(e) => e.stopPropagation()}
            >
              {item.icon}
            </Link>
          ) : (
            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</Box>
          )}
        </Tooltip>
      ))}
    </Stack>
  );
};

export default function SellerManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // ページネーション
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  
  // フィルタ
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // 権限付与ダイアログ
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        per_page: String(rowsPerPage),
        role: 'seller', // 出品者のみ取得
      });

      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const response = await axios.get(`/api/admin/users?${params.toString()}`);
      
      if (response.data.success) {
        const data: PaginatedResponse = response.data.data;
        setUsers(data.data);
        setTotal(data.total);
      }
    } catch (err: any) {
      console.error('出品者一覧取得エラー:', err);
      setError(err.response?.data?.message || '出品者一覧の取得に失敗しました');
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

  const handleGrantParticipantRole = async () => {
    if (!selectedUser) return;

    try {
      // 現在のロールに participant を追加
      const newRoles = [...selectedUser.roles.map(r => r.name), 'participant'];
      
      const response = await axios.put(`/api/admin/users/${selectedUser.id}`, {
        roles: newRoles,
      });
      
      if (response.data.success) {
        setSuccess(`${selectedUser.name} さんに参加者権限を付与しました`);
        setGrantDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '権限の付与に失敗しました');
    }
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

  const hasParticipantRole = (user: User) => {
    return user.roles.some(r => r.name === 'participant');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          出品者登録一覧
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<PersonAddIcon />}
          onClick={() => navigate('/admin/users/create?role=seller')}
        >
          新規作成
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
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
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 1500 }}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell align="center">アイコン</TableCell>
                  <TableCell>名前</TableCell>
                  <TableCell>メールアドレス</TableCell>
                  <TableCell>ロール</TableCell>
                  <TableCell align="center">ステータス</TableCell>
                  <TableCell align="center">SNS</TableCell>
                  <TableCell>最終ログイン</TableCell>
                  <TableCell>登録日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        出品者が見つかりませんでした
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const iconSrc =
                      user.seller_profile?.profile_image_url || user.profile_image_url || undefined;
                    return (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.id}</TableCell>
                      <TableCell align="center">
                        <Avatar
                          src={iconSrc}
                          sx={{ width: 36, height: 36, mx: 'auto' }}
                        >
                          {!iconSrc && user.name?.charAt(0)}
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium" sx={{ whiteSpace: 'nowrap' }}>
                          {user.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {user.roles.map((role) => (
                            <Chip
                              key={role.id}
                              label={role.display_name}
                              color={role.name === 'seller' ? 'secondary' : 'info'}
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
                        <SnsCell profile={user.seller_profile} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
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
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
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
                        {!hasParticipantRole(user) && user.status === 'approved' && (
                          <Tooltip title="参加者権限を付与">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => {
                                setSelectedUser(user);
                                setGrantDialogOpen(true);
                              }}
                            >
                              <PersonIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
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

      {/* 権限付与確認ダイアログ */}
      <Dialog open={grantDialogOpen} onClose={() => setGrantDialogOpen(false)}>
        <DialogTitle>参加者権限の付与</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {selectedUser?.name} さんに参加者権限を付与しますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            付与後は、出品者と参加者の両方の権限を持つことになります。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleGrantParticipantRole} variant="contained" color="info">
            付与
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
