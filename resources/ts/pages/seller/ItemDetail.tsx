import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Pets as PetsIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
  LocalShipping as ShippingIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  PlayCircle as PlayCircleIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

interface ItemDetail {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  inspection_info: string | null;
  individual_info: string | null;
  notes: string | null;
  is_premium: boolean;
  status: string;
  unsold_action: string | null;
  thumbnail_path: string | null;
  auction: {
    id: number;
    title: string;
    event_date: string;
    status: string;
  } | null;
  media: {
    id: number;
    media_type: string;
    file_path: string;
    file_url: string;
    is_thumbnail: boolean;
  }[];
  won_item: {
    winning_price: number;
    quantity: number;
    total_amount: number;
    commission_amount: number;
    seller_amount: number;
    payment_status: string;
    delivery_status: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export default function ItemDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/seller/items/${id}`);
      if (response.data.success) {
        setItem(response.data.data.item);
      }
    } catch (err: any) {
      console.error('出品詳細取得エラー:', err);
      setError(err.response?.data?.message || '出品情報の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      await axios.delete(`/api/seller/items/${id}`);
      navigate('/seller/items');
    } catch (err: any) {
      console.error('キャンセルエラー:', err);
      setError(err.response?.data?.message || 'キャンセルに失敗しました。');
    } finally {
      setCancelling(false);
      setCancelDialogOpen(false);
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
      case 'live': return 'warning';
      case 'registered': return 'info';
      case 'draft': return 'secondary';
      case 'unsold': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getUnsoldActionLabel = (action: string | null) => {
    switch (action) {
      case 'return': return '返却';
      case 'free_pickup': return '無料引取';
      case 'relist': return '次回再出品';
      default: return '-';
    }
  };

  const canCancel = item && ['draft', 'registered'].includes(item.status);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !item) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/seller/items')} sx={{ mb: 2 }}>
          戻る
        </Button>
        <Alert severity="error">{error || '出品情報が見つかりません。'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/seller/items')} sx={{ mr: 2 }}>
          戻る
        </Button>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {item.species_name}
            </Typography>
            <Chip
              label={getStatusLabel(item.status)}
              color={getStatusColor(item.status) as any}
              size="small"
            />
            {item.is_premium && (
              <Chip label="プレミアム" color="warning" size="small" />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            出品番号: #{item.item_number}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canCancel && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setCancelDialogOpen(true)}
            >
              キャンセル
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* 基本情報 */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <PetsIcon sx={{ color: '#059669' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  基本情報
                </Typography>
              </Box>

              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ width: '30%', color: 'text.secondary', border: 0 }}>品種名</TableCell>
                    <TableCell sx={{ fontWeight: 500, border: 0 }}>{item.species_name}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', border: 0 }}>数量</TableCell>
                    <TableCell sx={{ fontWeight: 500, border: 0 }}>{item.quantity}匹</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', border: 0 }}>オークション</TableCell>
                    <TableCell sx={{ fontWeight: 500, border: 0 }}>
                      {item.auction ? (
                        <>
                          {item.auction.title}
                          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                            ({new Date(item.auction.event_date).toLocaleDateString('ja-JP')})
                          </Typography>
                        </>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', border: 0 }}>未落札時の対応</TableCell>
                    <TableCell sx={{ fontWeight: 500, border: 0 }}>{getUnsoldActionLabel(item.unsold_action)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* メディアギャラリー */}
          {item.media && item.media.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ImageIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    画像・動画
                  </Typography>
                  <Chip label={`${item.media.length}件`} size="small" sx={{ ml: 'auto' }} />
                </Box>
                
                <Grid container spacing={2}>
                  {item.media.map((media) => {
                    const isVideo = media.media_type.includes('video');
                    return (
                      <Grid item xs={6} sm={4} key={media.id}>
                        <Box
                          sx={{
                            position: 'relative',
                            paddingTop: '100%',
                            borderRadius: 2,
                            overflow: 'hidden',
                            bgcolor: '#F3F4F6',
                            border: media.is_thumbnail ? '3px solid #059669' : '1px solid #E5E7EB',
                          }}
                        >
                          {isVideo ? (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#1F2937',
                              }}
                            >
                              <video
                                src={media.file_url}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                              <PlayCircleIcon
                                sx={{
                                  position: 'absolute',
                                  fontSize: 48,
                                  color: 'white',
                                  opacity: 0.8,
                                }}
                              />
                            </Box>
                          ) : (
                            <Box
                              component="img"
                              src={media.file_url}
                              alt="メディア"
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          )}
                          {media.is_thumbnail && (
                            <Chip
                              label="サムネイル"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                bgcolor: '#059669',
                                color: 'white',
                                fontSize: '0.65rem',
                              }}
                            />
                          )}
                          {isVideo && (
                            <VideoIcon
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                color: 'white',
                                fontSize: 20,
                              }}
                            />
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* 画像なしの場合 */}
          {(!item.media || item.media.length === 0) && (
            <Card sx={{ mb: 3, bgcolor: '#F9FAFB' }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <ImageIcon sx={{ fontSize: 48, color: '#9CA3AF', mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  画像・動画はまだ登録されていません
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  管理者が画像を登録すると、ここに表示されます
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* 個体情報 */}
          {item.individual_info && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  個体情報
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {item.individual_info}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* 審査情報 */}
          {item.inspection_info && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  審査情報
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {item.inspection_info}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* 備考 */}
          {item.notes && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  備考
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {item.notes}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* サイドバー */}
        <Grid item xs={12} lg={4}>
          {/* 価格情報 */}
          {item.won_item && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <MoneyIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    価格情報
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    落札価格
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    ¥{formatYen(item.won_item.winning_price)}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    手数料
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    ¥{formatYen(item.won_item.commission_amount)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    受取金額
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    ¥{formatYen(item.won_item.seller_amount)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* 落札情報 */}
          {item.won_item && (
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <ShippingIcon sx={{ color: '#8B5CF6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    落札・配送状況
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    支払い状況
                  </Typography>
                  <Chip
                    label={
                      item.won_item.payment_status === 'pending' ? '入金待ち' :
                      item.won_item.payment_status === 'paid' ? '入金済み' :
                      item.won_item.payment_status === 'confirmed' ? '入金確認済み' : item.won_item.payment_status
                    }
                    size="small"
                    color={item.won_item.payment_status === 'confirmed' ? 'success' : 'warning'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    配送状況
                  </Typography>
                  <Chip
                    label={
                      item.won_item.delivery_status === 'pending' ? '発送待ち' :
                      item.won_item.delivery_status === 'shipped' ? '発送済み' :
                      item.won_item.delivery_status === 'delivered' ? '配達完了' : item.won_item.delivery_status
                    }
                    size="small"
                    color={item.won_item.delivery_status === 'delivered' ? 'success' : 'info'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* 日時情報 */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <EventIcon sx={{ color: '#3B82F6' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  日時情報
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  申込日時
                </Typography>
                <Typography variant="body1">
                  {new Date(item.created_at).toLocaleString('ja-JP')}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  最終更新
                </Typography>
                <Typography variant="body1">
                  {new Date(item.updated_at).toLocaleString('ja-JP')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* キャンセル確認ダイアログ */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>出品をキャンセルしますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            この操作は取り消せません。本当にこの出品をキャンセルしますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>戻る</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? <CircularProgress size={20} /> : 'キャンセルする'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
