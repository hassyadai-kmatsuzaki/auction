import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  Button,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Avatar,
  Link,
  Tooltip,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  Store as StoreIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import type { WonItem } from '../../types';

// ヤマト運輸の追跡URLを生成
const getTrackingUrl = (trackingNumber: string, company: string) => {
  const cleanNumber = trackingNumber.replace(/-/g, '');
  switch (company) {
    case 'ヤマト運輸':
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${cleanNumber}`;
    case '佐川急便':
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${cleanNumber}`;
    case '日本郵便':
      return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${cleanNumber}`;
    default:
      return '';
  }
};

// Mock データ
const mockWonItems = [
  {
    id: 1,
    item: {
      id: 1,
      auction_id: 1,
      item_number: 1,
      species_name: '幹之メダカ フルボディ',
      quantity: 5,
      start_price: 500,
      current_price: 1200,
      is_premium: true,
      thumbnail_path: 'https://placehold.co/150x100/e3f2fd/1976d2?text=幹之メダカ',
      status: 'sold',
    },
    seller: {
      id: 1,
      name: '田中養魚場',
      instagram: '@tanaka_medaka',
    },
    winning_price: 1200,
    total_amount: 6000,
    buyer_fee: 300,
    payment_status: 'paid',
    payment_confirmed_at: '2025-11-12T15:30:00Z',
    delivery_status: 'shipped',
    shipping_address: '東京都渋谷区xxx 1-2-3',
    shipped_at: '2025-11-13T10:00:00Z',
    tracking_number: '1234-5678-9012',
    shipping_company: 'ヤマト運輸',
  },
  {
    id: 2,
    item: {
      id: 3,
      auction_id: 1,
      item_number: 3,
      species_name: 'オロチメダカ',
      quantity: 4,
      start_price: 800,
      current_price: 1500,
      is_premium: true,
      thumbnail_path: 'https://placehold.co/150x100/424242/ffffff?text=オロチメダカ',
      status: 'sold',
    },
    seller: {
      id: 3,
      name: '鈴木メダカファーム',
      instagram: '@suzuki_medaka',
    },
    winning_price: 1500,
    total_amount: 6000,
    buyer_fee: 300,
    payment_status: 'pending',
    delivery_status: 'pending',
    shipping_address: '東京都渋谷区xxx 1-2-3',
    tracking_number: '',
    shipping_company: '',
  },
  {
    id: 3,
    item: {
      id: 5,
      auction_id: 1,
      item_number: 5,
      species_name: '紅白ラメ',
      quantity: 3,
      start_price: 10000,
      current_price: 35000,
      is_premium: true,
      thumbnail_path: 'https://placehold.co/150x100/ffebee/c62828?text=紅白ラメ',
      status: 'sold',
    },
    seller: {
      id: 1,
      name: '田中養魚場',
      instagram: '@tanaka_medaka',
    },
    winning_price: 35000,
    total_amount: 108500,
    buyer_fee: 3500,
    payment_status: 'paid',
    payment_confirmed_at: '2025-11-13T10:00:00Z',
    delivery_status: 'delivered',
    shipping_address: '東京都渋谷区xxx 1-2-3',
    shipped_at: '2025-11-14T10:00:00Z',
    delivered_at: '2025-11-15T14:00:00Z',
    tracking_number: '9876-5432-1098',
    shipping_company: 'ヤマト運輸',
  },
];

export default function WonItems() {
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [trackingDetailOpen, setTrackingDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const totalAmount = mockWonItems.reduce((sum, item) => sum + item.total_amount, 0);
  const paidAmount = mockWonItems
    .filter((item) => item.payment_status === 'paid')
    .reduce((sum, item) => sum + item.total_amount, 0);
  const pendingAmount = totalAmount - paidAmount;

  const handleEditAddress = (item: any) => {
    setEditingItem(item);
    setShippingAddress(item.shipping_address || '');
    setEditAddressOpen(true);
  };

  const handleSaveAddress = () => {
    setEditAddressOpen(false);
    setEditingItem(null);
  };

  const handleOpenTrackingDetail = (item: any) => {
    setSelectedItem(item);
    setTrackingDetailOpen(true);
  };

  const handleCopyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '支払い待ち';
      case 'paid': return '入金確認済み';
      case 'refunded': return '返金済み';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { color: '#F59E0B', bgcolor: '#FEF3C7' };
      case 'paid': return { color: '#059669', bgcolor: '#ECFDF5' };
      case 'refunded': return { color: '#DC2626', bgcolor: '#FEF2F2' };
      default: return { color: '#64748B', bgcolor: '#F1F5F9' };
    }
  };

  const getDeliveryStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '発送待ち';
      case 'shipped': return '配送中';
      case 'delivered': return '配達完了';
      default: return status;
    }
  };

  const getDeliveryStepIndex = (status: string) => {
    switch (status) {
      case 'pending': return 0;
      case 'shipped': return 1;
      case 'delivered': return 2;
      default: return 0;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        落札管理
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        落札した商品の支払い状況と配送状況を確認できます
      </Typography>

      {/* サマリー */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              合計落札金額
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              ¥{totalAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, bgcolor: '#ECFDF5' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              入金確認済み
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>
              ¥{paidAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, bgcolor: '#FEF3C7' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              支払い待ち
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>
              ¥{pendingAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 落札商品一覧 */}
      {mockWonItems.map((wonItem) => (
        <Card key={wonItem.id} sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={3}>
                <CardMedia
                  component="img"
                  image={wonItem.item.thumbnail_path}
                  alt={wonItem.item.species_name}
                  sx={{ borderRadius: 2, height: 120, objectFit: 'cover' }}
                />
              </Grid>
              <Grid item xs={12} sm={9}>
                {/* ヘッダー */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No.{wonItem.item.item_number}
                  </Typography>
                  {wonItem.item.is_premium && (
                    <Chip label="プレミアム" size="small" sx={{ bgcolor: '#FEF3C7', color: '#F59E0B', fontWeight: 600, fontSize: '0.7rem' }} />
                  )}
                  <Chip
                    label={getPaymentStatusLabel(wonItem.payment_status)}
                    size="small"
                    sx={{ ...getPaymentStatusColor(wonItem.payment_status), fontWeight: 600, fontSize: '0.7rem' }}
                  />
                  <Chip
                    label={getDeliveryStatusLabel(wonItem.delivery_status)}
                    size="small"
                    sx={{ bgcolor: '#DBEAFE', color: '#3B82F6', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {wonItem.item.species_name}
                </Typography>

                {/* 出品者情報 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Avatar sx={{ width: 24, height: 24, bgcolor: '#F0FDF4', color: '#059669', fontSize: '0.7rem' }}>
                    {wonItem.seller.name.charAt(0)}
                  </Avatar>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    出品者: {wonItem.seller.name}
                    {wonItem.seller.instagram && ` (${wonItem.seller.instagram})`}
                  </Typography>
                </Box>

                {/* 金額情報 */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      落札単価: ¥{wonItem.winning_price.toLocaleString()} × {wonItem.item.quantity}匹
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      手数料: ¥{wonItem.buyer_fee.toLocaleString()}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#059669', fontWeight: 700, mt: 0.5 }}>
                      合計: ¥{wonItem.total_amount.toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {wonItem.payment_confirmed_at && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        入金確認: {new Date(wonItem.payment_confirmed_at).toLocaleDateString('ja-JP')}
                      </Typography>
                    )}
                    {wonItem.shipped_at && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        発送日: {new Date(wonItem.shipped_at).toLocaleDateString('ja-JP')}
                      </Typography>
                    )}
                  </Grid>
                </Grid>

                {/* 配送情報 */}
                {wonItem.tracking_number && (
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        配送情報
                      </Typography>
                      <Button
                        size="small"
                        endIcon={<OpenInNewIcon />}
                        onClick={() => handleOpenTrackingDetail(wonItem)}
                      >
                        詳細を見る
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                      <Typography variant="body2">
                        {wonItem.shipping_company}: 
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {wonItem.tracking_number}
                      </Typography>
                      <Tooltip title="コピー">
                        <IconButton size="small" onClick={() => handleCopyTrackingNumber(wonItem.tracking_number)}>
                          <CopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNewIcon />}
                        component={Link}
                        href={getTrackingUrl(wonItem.tracking_number, wonItem.shipping_company)}
                        target="_blank"
                      >
                        配送状況を確認
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* 配送先 */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    配送先
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      {wonItem.shipping_address}
                    </Typography>
                    {wonItem.payment_status === 'pending' && (
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditAddress(wonItem)}
                      >
                        変更
                      </Button>
                    )}
                  </Box>
                </Box>

                {/* アクションボタン */}
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {wonItem.payment_status === 'pending' && (
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<ReceiptIcon />}
                    >
                      請求書を確認・支払い
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}

      {/* 配送先編集ダイアログ */}
      <Dialog open={editAddressOpen} onClose={() => setEditAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送先住所の変更</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            ※ 入金前のみ変更可能です
          </Typography>
          <TextField
            fullWidth
            label="配送先住所"
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            multiline
            rows={3}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAddressOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveAddress} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 配送詳細ダイアログ */}
      <Dialog open={trackingDetailOpen} onClose={() => setTrackingDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送状況詳細</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedItem.item.species_name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  出品者: {selectedItem.seller.name}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* 配送ステップ */}
              <Stepper activeStep={getDeliveryStepIndex(selectedItem.delivery_status)} sx={{ mb: 3 }}>
                <Step>
                  <StepLabel>発送準備中</StepLabel>
                </Step>
                <Step>
                  <StepLabel>配送中</StepLabel>
                </Step>
                <Step>
                  <StepLabel>配達完了</StepLabel>
                </Step>
              </Stepper>

              {selectedItem.tracking_number && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>伝票番号</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                      {selectedItem.tracking_number}
                    </Typography>
                    <IconButton size="small" onClick={() => handleCopyTrackingNumber(selectedItem.tracking_number)}>
                      <CopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {selectedItem.shipping_company}
                  </Typography>
                </Box>
              )}

              <Button
                fullWidth
                variant="contained"
                endIcon={<OpenInNewIcon />}
                component={Link}
                href={getTrackingUrl(selectedItem.tracking_number, selectedItem.shipping_company)}
                target="_blank"
              >
                {selectedItem.shipping_company}の配送状況ページを開く
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDetailOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
