import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
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
  Switch,
  RadioGroup,
  Radio,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountBalanceIcon,
  Email as EmailIcon,
  PhotoCamera as PhotoCameraIcon,
  SwapHoriz as SwapHorizIcon,
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
  seller_code: string | null;
  seller_name: string | null;
  corporate_name: string | null;
  business_type: string | null;
  business_registration_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
  website: string | null;
  other_sns: string | null;
  sales_channels: string | null;
  event_history: string | null;
  event_hosting: string | null;
  shop_address: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  commission_rate: number | null;
  notes: string | null;
  is_active: boolean;
  profile_image_path: string | null;
  profile_image_url: string | null;
}

interface SubscriptionPlan {
  id: number;
  code: string;
  name: string;
  amount: number;
  /** 有効日数。null=1年（年会費）。値あり=単発プラン（1Day会員） */
  duration_days: number | null;
  allows_bid: boolean;
  allows_sell: boolean;
}

interface UserSubscription {
  id: number;
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'suspended';
  current_period_end: string | null;
  suspended_reason: string | null;
  plan: SubscriptionPlan | null;
}

interface User {
  id: number;
  name: string;
  trade_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  is_active: boolean;
  is_test: boolean;
  email_verified_at: string | null;
  approved_at: string | null;
  approved_by: number | null;
  rejected_at: string | null;
  rejected_by: number | null;
  rejection_reason: string | null;
  payment_method_preference: 'card' | 'bank_transfer' | null;
  bank_transfer_confirmed_at: string | null;
  last_login_at: string | null;
  created_at: string;
  profile_image_path: string | null;
  profile_image_url: string | null;
  roles: Role[];
  seller_profile: SellerProfile | null;
  subscription: UserSubscription | null;
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
  const [confirmBankDialogOpen, setConfirmBankDialogOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<'buyer' | 'seller'>('buyer');
  const [switchSubmitting, setSwitchSubmitting] = useState(false);
  
  // 編集フォーム
  const [editForm, setEditForm] = useState({
    name: '',
    trade_name: '',
    company_name: '',
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

  // アイコン編集
  const userImageInputRef = useRef<HTMLInputElement | null>(null);
  const sellerImageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploading, setImageUploading] = useState<'user' | 'seller' | null>(null);

  const handleImageUpload = async (
    target: 'user' | 'seller',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    const path = target === 'user' ? 'profile-image' : 'seller-profile-image';

    setImageUploading(target);
    try {
      const response = await axios.post(`/api/admin/users/${id}/${path}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setSuccess(target === 'user' ? 'アイコンを更新しました' : '出品者アイコンを更新しました');
        fetchUser();
      }
    } catch (err: any) {
      const messages = err?.response?.data?.errors?.image;
      setError(messages?.[0] || err?.response?.data?.message || 'アイコンの更新に失敗しました');
    } finally {
      setImageUploading(null);
    }
  };

  const handleImageDelete = async (target: 'user' | 'seller') => {
    const path = target === 'user' ? 'profile-image' : 'seller-profile-image';
    setImageUploading(target);
    try {
      const response = await axios.delete(`/api/admin/users/${id}/${path}`);
      if (response.data.success) {
        setSuccess(target === 'user' ? 'アイコンを削除しました' : '出品者アイコンを削除しました');
        fetchUser();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'アイコンの削除に失敗しました');
    } finally {
      setImageUploading(null);
    }
  };

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
          trade_name: userData.trade_name || '',
          company_name: userData.company_name || '',
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

  const handleConfirmBankTransfer = async () => {
    try {
      const response = await axios.post(`/api/admin/users/${id}/confirm-bank-transfer`);

      if (response.data.success) {
        setSuccess('振込確認を完了しました');
        setConfirmBankDialogOpen(false);
        fetchUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '振込確認の処理に失敗しました');
      setConfirmBankDialogOpen(false);
    }
  };

  // 1Day会員 → 落札者/落札出品者 への会員種別切替。
  // 1Dayサブスクを即時解約し、本人が次回ログイン時に年会費プランを決済する。
  const handleSwitchMembership = async () => {
    setSwitchSubmitting(true);
    try {
      const response = await axios.post(`/api/admin/users/${id}/switch-membership`, {
        member_type: switchTarget,
      });

      if (response.data.success) {
        setSuccess(response.data.message || '会員種別を切替えました');
        setSwitchDialogOpen(false);
        fetchUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '会員種別の切替に失敗しました');
      setSwitchDialogOpen(false);
    } finally {
      setSwitchSubmitting(false);
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
          variant="outlined"
          startIcon={<EmailIcon />}
          onClick={() => navigate(`/admin/email-campaigns/create?user_id=${id}`)}
          sx={{ mr: 1 }}
        >
          メール送信
        </Button>
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                アイコン
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={user.profile_image_url || undefined}
                  sx={{ width: 72, height: 72 }}
                >
                  {user.name?.charAt(0)}
                </Avatar>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <input
                    ref={userImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload('user', e)}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      onClick={() => userImageInputRef.current?.click()}
                      disabled={imageUploading === 'user'}
                    >
                      {user.profile_image_url ? '画像を変更' : '画像を設定'}
                    </Button>
                    {user.profile_image_url && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleImageDelete('user')}
                        disabled={imageUploading === 'user'}
                      >
                        削除
                      </Button>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    JPEG/PNG/GIF/WebP・5MB まで
                  </Typography>
                </Box>
              </Box>
            </Box>

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
                屋号
              </Typography>
              <Typography variant="body1">
                {user.trade_name || '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                会社名
              </Typography>
              <Typography variant="body1">
                {user.company_name || '-'}
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

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                テストユーザー
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  size="small"
                  checked={user.is_test}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    try {
                      await axios.put(`/api/admin/users/${user.id}`, { is_test: next });
                      setUser({ ...user, is_test: next });
                      setSuccess(next ? 'テストユーザーに設定しました' : 'テストユーザー設定を解除しました');
                    } catch (err: any) {
                      setError(err?.response?.data?.message ?? 'テストユーザー設定の更新に失敗しました');
                    }
                  }}
                />
                <Typography variant="caption" color={user.is_test ? 'warning.main' : 'text.secondary'}>
                  {user.is_test ? 'テストモード ON 中もこのユーザーは閉じた世界の住人になります' : 'テストモード ON で見えなくなります'}
                </Typography>
              </Box>
            </Box>

            {user.payment_method_preference === 'bank_transfer' && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  銀行振込
                </Typography>
                <Chip
                  label={user.bank_transfer_confirmed_at ? '振込確認済み' : '振込確認待ち'}
                  color={user.bank_transfer_confirmed_at ? 'success' : 'warning'}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
                {user.bank_transfer_confirmed_at && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    確認日時: {new Date(user.bank_transfer_confirmed_at).toLocaleString('ja-JP')}
                  </Typography>
                )}
              </Box>
            )}
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
          <>
            {/* 基本情報 */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  出品者情報
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    出品者アイコン
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={user.seller_profile.profile_image_url || undefined}
                      sx={{ width: 72, height: 72 }}
                    >
                      {(user.seller_profile.seller_name || user.name)?.charAt(0)}
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <input
                        ref={sellerImageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        style={{ display: 'none' }}
                        onChange={(e) => handleImageUpload('seller', e)}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PhotoCameraIcon />}
                          onClick={() => sellerImageInputRef.current?.click()}
                          disabled={imageUploading === 'seller'}
                        >
                          {user.seller_profile.profile_image_url ? '画像を変更' : '画像を設定'}
                        </Button>
                        {user.seller_profile.profile_image_url && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleImageDelete('seller')}
                            disabled={imageUploading === 'seller'}
                          >
                            削除
                          </Button>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        出品者ページに表示される画像。JPEG/PNG/GIF/WebP・5MB まで
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      出品者コード
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {user.seller_profile.seller_code || '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      出品者名
                    </Typography>
                    <Typography variant="body1">
                      {user.seller_profile.seller_name || '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      法人名
                    </Typography>
                    <Typography variant="body1">
                      {user.seller_profile.corporate_name || '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      事業形態
                    </Typography>
                    <Typography variant="body1">
                      {user.seller_profile.business_type || '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      事業登録番号
                    </Typography>
                    <Typography variant="body1">
                      {user.seller_profile.business_registration_number || '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      担当者名
                    </Typography>
                    <Typography variant="body1">
                      {user.seller_profile.contact_name || '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* 連絡先・住所 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  連絡先
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    メールアドレス
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.email || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    電話番号
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.phone || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    住所
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.postal_code && `〒${user.seller_profile.postal_code}`}
                    {user.seller_profile.prefecture || ''}
                    {user.seller_profile.city || ''}
                    {user.seller_profile.address_line1 || ''}
                    {user.seller_profile.address_line2 ? ` ${user.seller_profile.address_line2}` : ''}
                    {!user.seller_profile.postal_code && !user.seller_profile.prefecture && '-'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    店舗住所
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.shop_address || '-'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* SNS・ウェブ */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  SNS・ウェブサイト
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Instagram
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.instagram ? `@${user.seller_profile.instagram}` : '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Twitter/X
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.twitter ? `@${user.seller_profile.twitter}` : '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    YouTube
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.youtube || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    ウェブサイト
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.website || '-'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    その他SNS
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.other_sns || '-'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* 口座情報 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  口座情報
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    銀行名
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.bank_name || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    支店名
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.bank_branch || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    口座種別
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.account_type === 'checking' ? '当座' : 
                     user.seller_profile.account_type === 'savings' ? '普通' : '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    口座番号
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.account_number || '-'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    口座名義
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.account_holder || '-'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* 活動情報 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  活動情報
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    販売チャネル
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {user.seller_profile.sales_channels || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    イベント出展歴
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {user.seller_profile.event_history || '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    イベント主催歴
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {user.seller_profile.event_hosting || '-'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    手数料率
                  </Typography>
                  <Typography variant="body1">
                    {user.seller_profile.commission_rate ? `${user.seller_profile.commission_rate}%` : '-'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* 備考 */}
            {user.seller_profile.notes && (
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    備考
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {user.seller_profile.notes}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </>
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

              {user.payment_method_preference === 'bank_transfer' && !user.bank_transfer_confirmed_at && (
                <Button
                  variant="contained"
                  color="info"
                  startIcon={<AccountBalanceIcon />}
                  onClick={() => setConfirmBankDialogOpen(true)}
                >
                  振込確認済み
                </Button>
              )}

              {user.subscription?.plan?.duration_days != null && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<SwapHorizIcon />}
                  onClick={() => setSwitchDialogOpen(true)}
                >
                  会員種別切替
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
            label="屋号"
            value={editForm.trade_name}
            onChange={(e) => setEditForm({ ...editForm, trade_name: e.target.value })}
            margin="normal"
            helperText="出品者として表示される屋号。未入力の場合は「-」表示になります。"
          />
          <TextField
            fullWidth
            label="会社名"
            value={editForm.company_name}
            onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
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

      {/* 振込確認ダイアログ */}
      <Dialog open={confirmBankDialogOpen} onClose={() => setConfirmBankDialogOpen(false)}>
        <DialogTitle>振込確認</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            このユーザーの銀行振込入金を確認済みにしますか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            年会費プランが有効化され、ユーザーへの振込案内モーダルは次回ログイン以降表示されなくなります。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBankDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleConfirmBankTransfer} variant="contained" color="primary">
            確認済みにする
          </Button>
        </DialogActions>
      </Dialog>

      {/* 会員種別切替ダイアログ（1Day会員 → 年会員） */}
      <Dialog open={switchDialogOpen} onClose={() => !switchSubmitting && setSwitchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>会員種別切替（1Day会員 → 年会員）</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            切替先の会員種別を選択してください。
          </Typography>
          <RadioGroup value={switchTarget} onChange={(e) => setSwitchTarget(e.target.value as 'buyer' | 'seller')}>
            <FormControlLabel
              value="buyer"
              control={<Radio />}
              label="落札者（年会費 5,500円 / 落札のみ）"
            />
            <FormControlLabel
              value="seller"
              control={<Radio />}
              label="落札出品者（年会費 11,000円 / 落札＋出品）"
            />
          </RadioGroup>
          <Alert severity="warning" sx={{ mt: 2 }}>
            実行すると1Day会員プランは即時解約されます。ご本人が次回ログイン時に年会費プランを決済するまで入札はできません（500円の充当・日割りはありません）。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwitchDialogOpen(false)} disabled={switchSubmitting}>キャンセル</Button>
          <Button
            onClick={handleSwitchMembership}
            variant="contained"
            color="warning"
            disabled={switchSubmitting}
            startIcon={switchSubmitting ? <CircularProgress size={16} /> : <SwapHorizIcon />}
          >
            切替を実行
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
