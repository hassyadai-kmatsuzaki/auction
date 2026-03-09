import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  Autocomplete,
  Divider,
  Alert,
  Chip,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Snackbar,
  LinearProgress,
  Dialog,
  IconButton,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  Store as StoreIcon,
  Pets as PetsIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Star as StarIcon,
  Delete as DeleteIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface SellerProfile {
  id: number;
  seller_name: string;
  contact_name: string | null;
  email: string;
  phone: string;
  commission_rate: number;
}

interface MediaItem {
  id: number;
  media_type: string;
  file_path: string;
  file_url: string | null;
  is_thumbnail: boolean;
  display_order: number;
}

interface UploadingFile {
  file: File;
  preview: string;
  progress: number;
  uploading: boolean;
  error?: string;
}

export default function ItemForm() {
  const navigate = useNavigate();
  const { auctionId, id } = useParams<{ auctionId: string; id: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [sellerLocked, setSellerLocked] = useState(false); // 出品者が既に紐づいている場合true
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    species_name: '',
    quantity: '',
    start_price: '',
    inspection_info: '',
    individual_info: '',
    notes: '',
    is_premium: false,
    unsold_action: 'return',
    status: 'registered',
  });

  const MAX_IMAGES = 20;

  useEffect(() => {
    fetchSellers();
    if (isEdit) {
      fetchItem();
    }
  }, [auctionId, id]);

  const fetchSellers = async () => {
    try {
      // 出品者一覧を取得（seller_profilesテーブルから）
      const response = await axios.get('/api/admin/users?role=seller&per_page=100');
      if (response.data.success) {
        // APIレスポンス構造: { success: true, data: { current_page, data: [...users...], ... } }
        const users = response.data.data?.data || response.data.data || [];
        
        // ユーザーからseller_profileを取得する形に変換
        const sellerProfiles: SellerProfile[] = (Array.isArray(users) ? users : [])
          .filter((u: any) => u.seller_profile)
          .map((u: any) => ({
            id: u.seller_profile.id,
            seller_name: u.seller_profile.seller_name || u.name,
            contact_name: u.seller_profile.contact_name,
            email: u.email,
            phone: u.phone || '',
            commission_rate: u.seller_profile.commission_rate || 10,
          }));
        setSellers(sellerProfiles);
      }
    } catch (err) {
      console.error('出品者一覧取得エラー:', err);
    }
  };

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/auctions/${auctionId}/items/${id}`);
      if (response.data.success) {
        const item = response.data.data.item;
        setFormData({
          species_name: item.species_name || '',
          quantity: item.quantity?.toString() || '',
          start_price: item.start_price?.toString() || '',
          inspection_info: item.inspection_info || '',
          individual_info: item.individual_info || '',
          notes: item.notes || '',
          is_premium: item.is_premium || false,
          unsold_action: item.unsold_action || 'return',
          status: item.status || 'registered',
        });
        setExistingMedia(item.media || []);
        
        if (item.seller) {
          // 出品者が既に紐づいている場合（出品者からの申請）
          setSellerLocked(true);
          
          // 出品者プロファイル情報を直接設定（sellers一覧にない場合も対応）
          setSelectedSeller({
            id: item.seller.id,
            seller_name: item.seller.name,
            contact_name: null,
            email: '',
            phone: '',
            commission_rate: 10,
          });
        }
      }
    } catch (err: any) {
      console.error('生体取得エラー:', err);
      setSnackbar({ open: true, message: '生体情報の取得に失敗しました。', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string) => (e: any) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const payload = {
        species_name: formData.species_name,
        quantity: parseInt(formData.quantity),
        start_price: parseFloat(formData.start_price),
        inspection_info: formData.inspection_info || null,
        individual_info: formData.individual_info || null,
        notes: formData.notes || null,
        is_premium: formData.is_premium,
        unsold_action: formData.unsold_action,
        seller_profile_id: selectedSeller?.id || null,
        status: formData.status,
      };
      
      if (isEdit) {
        await axios.put(`/api/admin/auctions/${auctionId}/items/${id}`, payload);
        setSnackbar({ open: true, message: '生体情報を更新しました。', severity: 'success' });
      } else {
        const response = await axios.post(`/api/admin/auctions/${auctionId}/items`, payload);
        if (response.data.success) {
          setSnackbar({ open: true, message: '生体を登録しました。', severity: 'success' });
          // 新規作成時は編集画面に遷移してメディアアップロードできるようにする
          const newItemId = response.data.data.item.id;
          navigate(`/admin/auctions/${auctionId}/items/${newItemId}/edit`, { replace: true });
          return;
        }
      }
      
      setTimeout(() => {
        navigate(`/admin/auctions/${auctionId}/items`);
      }, 1000);
    } catch (err: any) {
      console.error('保存エラー:', err);
      setSnackbar({ 
        open: true, 
        message: err.response?.data?.message || '保存に失敗しました。', 
        severity: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video') => {
    const files = e.target.files;
    if (!files || !id) return;

    const newUploadingFiles: UploadingFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newUploadingFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        progress: 0,
        uploading: true,
      });
    }
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    
    // 各ファイルをアップロード
    for (let i = 0; i < newUploadingFiles.length; i++) {
      const uploadFile = newUploadingFiles[i];
      const formDataUpload = new FormData();
      formDataUpload.append('file', uploadFile.file);
      formDataUpload.append('media_type', mediaType);
      formDataUpload.append('is_thumbnail', (existingMedia.length === 0 && i === 0).toString());
      
      try {
        const response = await axios.post(
          `/api/admin/auctions/${auctionId}/items/${id}/media`,
          formDataUpload,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const progress = progressEvent.total 
                ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                : 0;
              setUploadingFiles(prev => 
                prev.map((f, idx) => 
                  f === uploadFile ? { ...f, progress } : f
                )
              );
            },
          }
        );
        
        if (response.data.success) {
          setExistingMedia(prev => [...prev, response.data.data.media]);
        }
      } catch (err: any) {
        console.error('アップロードエラー:', err);
        setUploadingFiles(prev => 
          prev.map(f => 
            f === uploadFile ? { ...f, uploading: false, error: 'アップロード失敗' } : f
          )
        );
      }
    }
    
    // アップロード完了後にクリア
    setUploadingFiles(prev => prev.filter(f => f.uploading && !f.error));
    e.target.value = '';
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!id) return;
    
    try {
      await axios.delete(`/api/admin/auctions/${auctionId}/items/${id}/media/${mediaId}`);
      setExistingMedia(prev => prev.filter(m => m.id !== mediaId));
      setSnackbar({ open: true, message: 'メディアを削除しました。', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: 'メディアの削除に失敗しました。', severity: 'error' });
    }
  };

  const handleSetThumbnail = async (mediaId: number) => {
    if (!id) return;
    
    try {
      await axios.patch(`/api/admin/auctions/${auctionId}/items/${id}/media/${mediaId}/thumbnail`);
      setExistingMedia(prev => 
        prev.map(m => ({ ...m, is_thumbnail: m.id === mediaId }))
      );
      setSnackbar({ open: true, message: 'サムネイルを設定しました。', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: 'サムネイルの設定に失敗しました。', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {isEdit ? '生体編集' : '生体新規登録'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {isEdit ? '生体情報を編集します' : '新しい生体を登録します'}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          {/* 出品者選択 */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <StoreIcon sx={{ color: '#059669' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  出品者選択
                </Typography>
              </Box>

              {sellerLocked ? (
                // 出品者が既に紐づいている場合（出品者からの申請）
                <Box>
                  <TextField
                    fullWidth
                    disabled
                    value={selectedSeller?.seller_name || ''}
                    label="出品者"
                    helperText="出品者からの申請のため変更できません"
                  />
                </Box>
              ) : (
                <Autocomplete
                  options={sellers}
                  getOptionLabel={(option) => `${option.seller_name} (${option.contact_name || option.email})`}
                  value={selectedSeller}
                  onChange={(_, value) => setSelectedSeller(value)}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: '#F0FDF4', color: '#059669', fontSize: '0.875rem' }}>
                        {option.seller_name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.seller_name}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{option.email}</Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="出品者を選択（任意）" />
                  )}
                />
              )}

              {selectedSeller && !sellerLocked && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                    出品者情報
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Typography variant="body2">
                      <strong>連絡先:</strong> {selectedSeller.email || '-'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>電話:</strong> {selectedSeller.phone || '-'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>手数料率:</strong> {selectedSeller.commission_rate}%
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* 基本情報 */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <PetsIcon sx={{ color: '#3B82F6' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  基本情報
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="品種名"
                      value={formData.species_name}
                      onChange={handleChange('species_name')}
                      placeholder="幹之メダカ"
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="匹数"
                      value={formData.quantity}
                      onChange={handleChange('quantity')}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>ステータス</InputLabel>
                      <Select
                        value={formData.status}
                        label="ステータス"
                        onChange={handleChange('status')}
                      >
                        <MenuItem value="draft">審査中</MenuItem>
                        <MenuItem value="registered">承認済み</MenuItem>
                        <MenuItem value="cancelled">キャンセル</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="開始価格"
                      value={formData.start_price}
                      onChange={handleChange('start_price')}
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>¥</Typography>,
                      }}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>


                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>未落札時の対応</InputLabel>
                      <Select
                        value={formData.unsold_action}
                        label="未落札時の対応"
                        onChange={handleChange('unsold_action')}
                      >
                        <MenuItem value="return">返却</MenuItem>
                        <MenuItem value="free_pickup">無料引取</MenuItem>
                        <MenuItem value="relist">次回再出品</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.is_premium}
                          onChange={handleChange('is_premium')}
                        />
                      }
                      label="プレミアムプラン"
                      sx={{ mt: 1 }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="個体情報（オークション表示用）"
                      value={formData.inspection_info}
                      onChange={handleChange('inspection_info')}
                      multiline
                      rows={3}
                      placeholder="買受者に表示される個体の特徴・情報"
                      helperText="オークション参加者に表示されます"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="個体情報（出品者からの説明）"
                      value={formData.individual_info}
                      onChange={handleChange('individual_info')}
                      multiline
                      rows={3}
                      placeholder="出品者からの個体説明"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="備考"
                      value={formData.notes}
                      onChange={handleChange('notes')}
                      multiline
                      rows={2}
                      placeholder="内部向けメモ"
                    />
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>

          {/* アクションボタン */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={saving || !formData.species_name || !formData.quantity || !formData.start_price}
            >
              {isEdit ? '変更を保存' : '生体を登録'}
            </Button>
          </Box>
        </Grid>

        {/* 右サイドバー - メディアアップロード */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ position: 'sticky', top: 80 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                メディア
              </Typography>

              {!isEdit && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  メディアのアップロードは生体登録後に行えます。
                </Alert>
              )}

              {isEdit && (
                <>
                  {/* 動画アップロード */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      動画
                    </Typography>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<UploadIcon />}
                      component="label"
                      sx={{ py: 1.5, borderStyle: 'dashed' }}
                    >
                      動画をアップロード
                      <input 
                        type="file" 
                        accept="video/*" 
                        hidden 
                        onChange={(e) => handleFileUpload(e, 'video')}
                      />
                    </Button>
                  </Box>

                  <Divider sx={{ my: 3 }} />

                  {/* 画像アップロード */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ImageIcon sx={{ fontSize: 20, color: '#059669' }} />
                        <Typography variant="subtitle2">画像</Typography>
                      </Box>
                      <Chip 
                        label={`${existingMedia.filter(m => m.media_type.startsWith('photo')).length} / ${MAX_IMAGES}`} 
                        size="small" 
                      />
                    </Box>
                    
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<UploadIcon />}
                      component="label"
                      sx={{ py: 1.5, borderStyle: 'dashed', mb: 2 }}
                    >
                      画像をアップロード
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        hidden 
                        onChange={(e) => handleFileUpload(e, 'image')}
                      />
                    </Button>

                    {/* アップロード中のファイル */}
                    {uploadingFiles.map((file, index) => (
                      <Box key={index} sx={{ mb: 1 }}>
                        <Typography variant="caption">{file.file.name}</Typography>
                        <LinearProgress variant="determinate" value={file.progress} />
                      </Box>
                    ))}

                    {/* 既存メディア */}
                    {existingMedia.length > 0 && (
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: 1,
                        maxHeight: 300,
                        overflowY: 'auto',
                        p: 1,
                        bgcolor: 'grey.50',
                        borderRadius: 2,
                      }}>
                        {existingMedia.map((media) => (
                          <Box 
                            key={media.id} 
                            sx={{ 
                              position: 'relative',
                              aspectRatio: '1',
                              borderRadius: 1,
                              overflow: 'hidden',
                              border: media.is_thumbnail ? '2px solid' : '1px solid',
                              borderColor: media.is_thumbnail ? 'warning.main' : 'grey.200',
                            }}
                          >
                            {media.file_url && media.media_type.startsWith('photo') ? (
                              <Box
                                component="img"
                                src={media.file_url}
                                alt=""
                                onClick={() => setMediaPreviewUrl(media.file_url)}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                }}
                              />
                            ) : (
                              <Box 
                                onClick={() => media.file_url && setVideoPreviewUrl(media.file_url)}
                                sx={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  bgcolor: 'grey.800',
                                  cursor: media.file_url ? 'pointer' : 'default',
                                  '&:hover': media.file_url ? { bgcolor: 'grey.700' } : {},
                                }}>
                                <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 32, mb: 0.5 }} />
                                <Typography variant="caption" sx={{ color: 'white' }}>動画</Typography>
                              </Box>
                            )}
                            
                            {/* サムネイルバッジ */}
                            {media.is_thumbnail && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 2,
                                  left: 2,
                                  bgcolor: 'warning.main',
                                  color: 'white',
                                  borderRadius: 0.5,
                                  px: 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.25,
                                }}
                              >
                                <StarIcon sx={{ fontSize: 12 }} />
                                <Typography sx={{ fontSize: '0.6rem' }}>サムネ</Typography>
                              </Box>
                            )}
                            
                            {/* 操作ボタン */}
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                display: 'flex',
                                gap: 0.5,
                              }}
                            >
                              {!media.is_thumbnail && media.media_type.startsWith('photo') && (
                                <Box
                                  onClick={() => handleSetThumbnail(media.id)}
                                  sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'warning.main' },
                                  }}
                                >
                                  <StarIcon sx={{ fontSize: 12 }} />
                                </Box>
                              )}
                              <Box
                                onClick={() => handleDeleteMedia(media.id)}
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  bgcolor: 'rgba(0,0,0,0.6)',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: 'error.main' },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 14 }} />
                              </Box>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </>
              )}

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <InfoIcon sx={{ color: 'text.secondary', fontSize: 18, mt: 0.2 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  動画は100MB以下、画像は10MB以下でアップロードしてください。
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

      {/* 動画プレビューダイアログ */}
      <Dialog
        open={!!videoPreviewUrl}
        onClose={() => setVideoPreviewUrl(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'black' } }}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setVideoPreviewUrl(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2, bgcolor: 'rgba(0,0,0,0.5)' }}
          >
            <CloseIcon />
          </IconButton>
          {videoPreviewUrl && (
            <video
              src={videoPreviewUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '80vh', display: 'block' }}
            />
          )}
        </Box>
      </Dialog>

      {/* 画像プレビューダイアログ */}
      <Dialog
        open={!!mediaPreviewUrl}
        onClose={() => setMediaPreviewUrl(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <IconButton
            onClick={() => setMediaPreviewUrl(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}
          >
            <CloseIcon />
          </IconButton>
          {mediaPreviewUrl && (
            <img
              src={mediaPreviewUrl}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
}
