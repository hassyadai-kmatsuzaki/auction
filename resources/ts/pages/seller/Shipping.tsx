import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

interface ShippingItem {
  id: number;
  item: {
    id: number;
    item_number: number;
    exhibit_code?: string | null;
    species_name: string;
    quantity: number;
    thumbnail_path?: string;
  };
  auction: {
    id: number;
    title: string;
  };
  price: number;
  total_amount: number;
  shipping_fee: number;
  payment_status: string;
  delivery_status: string;
  sold_at: string;
  shipped_at?: string;
  delivered_at?: string;
}

interface Statistics {
  pending: number;
  shipped: number;
  delivered: number;
}

export default function SellerShipping() {
  const [items, setItems] = useState<ShippingItem[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({ pending: 0, shipped: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // データ取得
  const fetchShippingItems = useCallback(async () => {
    try {
      const statusFilter = tabValue === 1 ? 'pending' : tabValue === 2 ? 'shipped' : tabValue === 3 ? 'delivered' : undefined;

      const response = await axios.get('/api/seller/shipping', {
        params: { status: statusFilter },
      });

      if (response.data.success) {
        setItems(response.data.data.items);
        setStatistics(response.data.data.statistics);
        setError(null);
      }
    } catch (err: any) {
      console.error('発送情報取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tabValue]);

  useEffect(() => {
    fetchShippingItems();
  }, [fetchShippingItems]);

  // フィルタリング（検索）
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.item.species_name.toLowerCase().includes(query);
  });

  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      pending: { label: '発送待ち', color: '#F59E0B', bgcolor: '#FEF3C7' },
      shipped: { label: '配送中', color: '#3B82F6', bgcolor: '#DBEAFE' },
      delivered: { label: '配達完了', color: '#059669', bgcolor: '#ECFDF5' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={fetchShippingItems}>再読み込み</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            配送状況
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            落札された商品の発送状況を管理します
          </Typography>
        </Box>
        <IconButton onClick={fetchShippingItems} title="更新">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* 統計 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>発送待ち</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>{statistics.pending}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>配送中</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#3B82F6' }}>{statistics.shipped}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>配達完了</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>{statistics.delivered}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* フィルター */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`すべて`} />
            <Tab label={`発送待ち (${statistics.pending})`} />
            <Tab label={`配送中 (${statistics.shipped})`} />
            <Tab label={`配達完了 (${statistics.delivered})`} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="品種名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      {/* テーブル */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>商品</TableCell>
                <TableCell align="right">落札価格</TableCell>
                <TableCell align="center">ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">発送対象の商品がありません</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.item.species_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.auction.title} / {item.item.exhibit_code ?? `No.${item.item.item_number}`}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ¥{formatYen(item.price)}
                      </Typography>
                      {(item.shipping_fee ?? 0) > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          配送料 ¥{formatYen(item.shipping_fee)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {getStatusChip(item.delivery_status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
