import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface Role {
  id: number;
  name: string;
  display_name: string;
  pivot?: {
    assigned_at: string;
    assigned_by: number | null;
  };
}

interface SellerProfile {
  id: number;
  business_name: string | null;
  business_type: string | null;
  business_number: string | null;
  bio: string | null;
  website_url: string | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  is_active: boolean;
  email_verified_at: string | null;
  approved_at: string | null;
  approved_by: number | null;
  rejected_at: string | null;
  rejected_by: number | null;
  rejection_reason: string | null;
  last_login_at: string | null;
  created_at: string;
  roles: Role[];
  seller_profile: SellerProfile | null;
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // ダイアログ状態
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // 編集フォーム
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
  });
  
  // ロール編集
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const availableRoles = [
    { name: 'admin', display_name: '管理者' },
    { name: 'seller', display_name: '出品者' },
    { name: 'participant', display_name: '参加者' },
  ];
  
  // ステータス変更
  const [newStatus, setNewStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`/api/admin/users/${id}`);
      
      if (response.data.success) {
        const userData = response.data.data.user;
        setUser(userData);
        setEditForm({
          name: userData.name || '',
          phone: userData.phone || '',
          postal_code: userData.postal_code || '',
          prefecture: userData.prefecture || '',
          city: userData.city || '',
          address_line1: userData.address_line1 || '',
          address_line2: userData.address_line2 || '',
        });
        setSelectedRoles(userData.roles.map((r: Role) => r.name));
      }
    } catch (err: any) {
      console.error('ユーザー詳細取得エラー:', err);
      setError(err.response?.data?.message || 'ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    try {
      const response = await axios.put(`/api/admin/users/${id}`, editForm);
      
      if (response.data.success) {
        setSuccess('ユーザー情報を更新しました');
        setEditDialogOpen(false);
        fetchUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'ユーザー情報の更新に失敗しました');
    }
  };

  const handleRoleSubmit = async () => {
    try {
      const response = await axios.put(`/api/admin/users/${id}`, {
        roles: selectedRoles,
      });
      
      if (response.data.success) {
        setSuccess('ロールを更新しました');
        setRoleDialogOpen(false);
        fetchUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'ロールの更新に失敗しました');
    }
  };

  const handleStatusChange = async () => {
    try {
      const data: any = { status: newStatus };
      if (newStatus === 'rejected' && rejectionReason) {
        data.rejection_reason = rejectionReason;
      }
      
      const response = await axios.put(`/api/admin/users/${id}`, data);
      
      if (response.data.success) {
        setSuccess('ステータスを更新しました');
        setStatusDialogOpen(false);
        setRejectionReason('');
        fetchUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'ステータスの更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    try {
      const response = await axios.delete(`/api/admin/users/${id}`);
      
      if (response.data.success) {
        setSuccess('ユーザーを削除しました');
        setTimeout(() => navigate('/admin/users'), 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'ユーザーの削除に失敗しました');
      setDeleteDialogOpen(false);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box>
        <Alert severity="error">ユーザーが見つかりませんでした</Alert>
        <Button onClick={() => navigate('/admin/users')} sx={{ mt: 2 }}>
          ユーザー一覧に戻る
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/users')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          ユーザー詳細
        </Typography>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => setEditDialogOpen(true)}
        >
          編集
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

      <Grid container spacing={3}>
        {/* 基本情報 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              基本情報
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                名前
              </Typography>
              <Typography variant="body1">
                {user.name}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                メールアドレス
              </Typography>
              <Typography variant="body1">
                {user.email}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                電話番号
              </Typography>
              <Typography variant="body1">
                {user.phone || '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                ステータス
              </Typography>
              <Chip
                label={getStatusLabel(user.status)}
                color={getStatusColor(user.status)}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                有効状態
              </Typography>
              <Chip
                label={user.is_active ? '有効' : '無効'}
                color={user.is_active ? 'success' : 'error'}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* 住所情報 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              住所情報
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                郵便番号
              </Typography>
              <Typography variant="body1">
                {user.postal_code || '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                都道府県
              </Typography>
              <Typography variant="body1">
                {user.prefecture || '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                市区町村
              </Typography>
              <Typography variant="body1">
                {user.city || '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                住所1
              </Typography>
              <Typography variant="body1">
                {user.address_line1 || '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                住所2
              </Typography>
              <Typography variant="body1">
                {user.address_line2 || '-'}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* ロール情報 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                ロール情報
              </Typography>
              <Button
                size="small"
                onClick={() => setRoleDialogOpen(true)}
              >
                ロール編集
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {user.roles.map((role) => (
                <Chip
                  key={role.id}
                  label={role.display_name}
                  color="primary"
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* 承認情報 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              承認情報
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                登録日
              </Typography>
              <Typography variant="body1">
                {new Date(user.created_at).toLocaleString('ja-JP')}
              </Typography>
            </Box>

            {user.approved_at && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  承認日
                </Typography>
                <Typography variant="body1">
                  {new Date(user.approved_at).toLocaleString('ja-JP')}
                </Typography>
              </Box>
            )}

            {user.last_login_at && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  最終ログイン
                </Typography>
                <Typography variant="body1">
                  {new Date(user.last_login_at).toLocaleString('ja-JP')}
                </Typography>
              </Box>
            )}

            {user.email_verified_at && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  メール確認日
                </Typography>
                <Typography variant="body1">
                  {new Date(user.email_verified_at).toLocaleString('ja-JP')}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* 出品者プロフィール */}
        {user.seller_profile && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                出品者プロフィール
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    屋号
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.business_name || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    事業形態
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.business_type || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    自己紹介
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.bio || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    ウェブサイト
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.website_url || '-'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* 操作 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              操作
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {user.status === 'pending' && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => {
                      setNewStatus('approved');
                      setStatusDialogOpen(true);
                    }}
                  >
                    承認
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => {
                      setNewStatus('rejected');
                      setStatusDialogOpen(true);
                    }}
                  >
                    拒否
                  </Button>
                </>
              )}

              {user.status === 'approved' && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<BlockIcon />}
                  onClick={() => {
                    setNewStatus('suspended');
                    setStatusDialogOpen(true);
                  }}
                >
                  停止
                </Button>
              )}

              {user.status === 'suspended' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => {
                    setNewStatus('approved');
                    setStatusDialogOpen(true);
                  }}
                >
                  再開
                </Button>
              )}

              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
              >
                削除
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* 編集ダイアログ */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ユーザー情報編集</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="名前"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="電話番号"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="郵便番号"
            value={editForm.postal_code}
            onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="都道府県"
            value={editForm.prefecture}
            onChange={(e) => setEditForm({ ...editForm, prefecture: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="市区町村"
            value={editForm.city}
            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="住所1"
            value={editForm.address_line1}
            onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="住所2"
            value={editForm.address_line2}
            onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleEditSubmit} variant="contained">
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* ロール編集ダイアログ */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
        <DialogTitle>ロール編集</DialogTitle>
        <DialogContent>
          <List>
            {availableRoles.map((role) => (
              <ListItem key={role.name}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedRoles.includes(role.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, role.name]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((r) => r !== role.name));
                        }
                      }}
                    />
                  }
                  label={role.display_name}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleRoleSubmit} variant="contained">
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* ステータス変更ダイアログ */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
        <DialogTitle>ステータス変更</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            ステータスを「{getStatusLabel(newStatus)}」に変更しますか？
          </Typography>
          {newStatus === 'rejected' && (
            <TextField
              fullWidth
              label="拒否理由"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              margin="normal"
              multiline
              rows={3}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleStatusChange} variant="contained" color="primary">
            変更
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>ユーザー削除</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            本当にこのユーザーを削除しますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleDelete} variant="contained" color="error">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
