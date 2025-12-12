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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { WonItem } from '../../types';

// Mock データ
const mockWonItems: WonItem[] = [
  {
    id: 1,
    item: {
      id: 1,
      auction_id: 1,
      item_number: 1,
      species_name: '幹之メダカ',
      quantity: 5,
      start_price: 500,
      current_price: 1200,
      is_premium: true,
      thumbnail_path: 'https://placehold.co/150x100/e3f2fd/1976d2?text=幹之メダカ',
      status: 'sold',
    },
    winning_price: 1200,
    total_amount: 6000,
    payment_status: 'paid',
    payment_confirmed_at: '2025-11-12T15:30:00Z',
    delivery_status: 'shipped',
    shipping_address: '東京都渋谷区...',
    shipped_at: '2025-11-13T10:00:00Z',
    tracking_number: '1234567890',
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
      thumbnail_path: 'https://placehold.co/150x100/424242/000000?text=オロチメダカ',
      status: 'sold',
    },
    winning_price: 1500,
    total_amount: 6000,
    payment_status: 'pending',
    delivery_status: 'pending',
    shipping_address: '東京都渋谷区...',
  },
];

export default function WonItems() {
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WonItem | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');

  const totalAmount = mockWonItems.reduce((sum, item) => sum + item.total_amount, 0);
  const paidAmount = mockWonItems
    .filter((item) => item.payment_status === 'paid')
    .reduce((sum, item) => sum + item.total_amount, 0);
  const pendingAmount = totalAmount - paidAmount;

  const handleEditAddress = (item: WonItem) => {
    setEditingItem(item);
    setShippingAddress(item.shipping_address || '');
    setEditAddressOpen(true);
  };

  const handleSaveAddress = () => {
    // Mock: 実際はAPIを呼び出す
    setEditAddressOpen(false);
    setEditingItem(null);
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '支払い待ち';
      case 'paid':
        return '入金確認済み';
      case 'refunded':
        return '返金済み';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'paid':
        return 'success';
      case 'refunded':
        return 'error';
      default:
        return 'default';
    }
  };

  const getDeliveryStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '発送待ち';
      case 'shipped':
        return '発送済み';
      case 'completed':
        return '配達完了';
      default:
        return status;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        落札管理
      </Typography>

      {/* サマリー */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              合計落札金額
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              ¥{totalAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              入金確認済み
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              ¥{paidAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              支払い待ち
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              ¥{pendingAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 落札商品一覧 */}
      {mockWonItems.map((wonItem) => (
        <Card key={wonItem.id} sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <CardMedia
                  component="img"
                  image={wonItem.item.thumbnail_path}
                  alt={wonItem.item.species_name}
                  sx={{ borderRadius: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={9}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    No.{wonItem.item.item_number}
                  </Typography>
                  {wonItem.item.is_premium && (
                    <Chip label="プレミアム" color="warning" size="small" />
                  )}
                  <Chip
                    label={getPaymentStatusLabel(wonItem.payment_status)}
                    color={getPaymentStatusColor(wonItem.payment_status)}
                    size="small"
                  />
                  <Chip
                    label={getDeliveryStatusLabel(wonItem.delivery_status)}
                    color="primary"
                    size="small"
                  />
                </Box>

                <Typography variant="h6" gutterBottom>
                  {wonItem.item.species_name}
                </Typography>

                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      落札単価: ¥{wonItem.winning_price.toLocaleString()} × {wonItem.item.quantity}匹
                    </Typography>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      合計: ¥{wonItem.total_amount.toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {wonItem.payment_confirmed_at && (
                      <Typography variant="body2" color="text.secondary">
                        入金確認: {new Date(wonItem.payment_confirmed_at).toLocaleString('ja-JP')}
                      </Typography>
                    )}
                    {wonItem.shipped_at && (
                      <Typography variant="body2" color="text.secondary">
                        発送日: {new Date(wonItem.shipped_at).toLocaleString('ja-JP')}
                      </Typography>
                    )}
                    {wonItem.tracking_number && (
                      <Typography variant="body2" color="text.secondary">
                        追跡番号: {wonItem.tracking_number}
                      </Typography>
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
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

                {wonItem.payment_status === 'pending' && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<ReceiptIcon />}
                    >
                      請求書を確認
                    </Button>
                  </Box>
                )}

                {wonItem.delivery_status === 'shipped' && wonItem.tracking_number && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<LocalShippingIcon />}
                    >
                      配送状況を確認
                    </Button>
                  </Box>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}

      {/* 配送先編集ダイアログ */}
      <Dialog open={editAddressOpen} onClose={() => setEditAddressOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>配送先住所の変更</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
    </Container>
  );
}

