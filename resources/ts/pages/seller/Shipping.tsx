import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocalShipping as ShippingIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

// Mock データ
const shippingItems = [
  {
    id: 1,
    item: { species_name: '紅白ラメ 3ペア', item_number: 1 },
    buyer: { name: '山田一郎', address: '東京都渋谷区xxx 1-2-3' },
    auction: '2025年11月オークション',
    price: 35000,
    status: 'pending',
    tracking_number: '',
    shipping_company: '',
    sold_at: '2025-11-12T10:00:00Z',
  },
  {
    id: 2,
    item: { species_name: '幹之フルボディ 5匹', item_number: 2 },
    buyer: { name: '伊藤美穂', address: '大阪府大阪市xxx 4-5-6' },
    auction: '2025年11月オークション',
    price: 28000,
    status: 'shipped',
    tracking_number: '1234-5678-9012',
    shipping_company: 'ヤマト運輸',
    sold_at: '2025-11-12T10:00:00Z',
    shipped_at: '2025-11-13T14:00:00Z',
  },
  {
    id: 3,
    item: { species_name: '三色ラメ 2ペア', item_number: 3 },
    buyer: { name: '渡辺健太', address: '愛知県名古屋市xxx 7-8-9' },
    auction: '2025年11月オークション',
    price: 42000,
    status: 'delivered',
    tracking_number: '9876-5432-1098',
    shipping_company: 'ヤマト運輸',
    sold_at: '2025-11-12T10:00:00Z',
    shipped_at: '2025-11-13T10:00:00Z',
    delivered_at: '2025-11-14T14:00:00Z',
  },
];

// ヤマト運輸の追跡URLを生成
const getYamatoTrackingUrl = (trackingNumber: string) => {
  return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${trackingNumber.replace(/-/g, '')}`;
};

export default function SellerShipping() {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof shippingItems[0] | null>(null);
  const [trackingForm, setTrackingForm] = useState({ tracking_number: '', shipping_company: 'ヤマト運輸' });

  // フィルタリング
  const filteredItems = shippingItems.filter((item) => {
    const matchesSearch =
      item.item.species_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tracking_number.includes(searchQuery);

    if (tabValue === 0) return matchesSearch;
    if (tabValue === 1) return matchesSearch && item.status === 'pending';
    if (tabValue === 2) return matchesSearch && item.status === 'shipped';
    if (tabValue === 3) return matchesSearch && item.status === 'delivered';
    return matchesSearch;
  });

  const pendingCount = shippingItems.filter((i) => i.status === 'pending').length;
  const shippedCount = shippingItems.filter((i) => i.status === 'shipped').length;
  const deliveredCount = shippingItems.filter((i) => i.status === 'delivered').length;

  const handleOpenTrackingDialog = (item: typeof shippingItems[0]) => {
    setSelectedItem(item);
    setTrackingForm({
      tracking_number: item.tracking_number || '',
      shipping_company: item.shipping_company || 'ヤマト運輸',
    });
    setTrackingDialogOpen(true);
  };

  const handleCopyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber);
  };

  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string }> = {
      pending: { label: '発送待ち', color: '#F59E0B', bgcolor: '#FEF3C7' },
      shipped: { label: '配送中', color: '#3B82F6', bgcolor: '#DBEAFE' },
      delivered: { label: '配達完了', color: '#059669', bgcolor: '#ECFDF5' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600 }} />;
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          配送状況
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          落札された商品の発送状況を管理します
        </Typography>
      </Box>

      {/* 統計 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>発送待ち</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#F59E0B' }}>{pendingCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>配送中</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#3B82F6' }}>{shippedCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>配達完了</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669' }}>{deliveredCount}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* フィルター */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`すべて (${shippingItems.length})`} />
            <Tab label={`発送待ち (${pendingCount})`} />
            <Tab label={`配送中 (${shippedCount})`} />
            <Tab label={`配達完了 (${deliveredCount})`} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="品種名、買受者名、伝票番号で検索..."
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
                <TableCell>買受者・配送先</TableCell>
                <TableCell align="right">落札価格</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell>伝票番号</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.item.species_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {item.auction} / No.{item.item.item_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.buyer.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {item.buyer.address}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ¥{item.price.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {getStatusChip(item.status)}
                  </TableCell>
                  <TableCell>
                    {item.tracking_number ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {item.tracking_number}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {item.shipping_company}
                          </Typography>
                        </Box>
                        <Tooltip title="コピー">
                          <IconButton size="small" onClick={() => handleCopyTrackingNumber(item.tracking_number)}>
                            <CopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="配送状況を確認">
                          <IconButton
                            size="small"
                            component={Link}
                            href={getYamatoTrackingUrl(item.tracking_number)}
                            target="_blank"
                          >
                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        未登録
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {item.status === 'pending' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ShippingIcon />}
                        onClick={() => handleOpenTrackingDialog(item)}
                      >
                        発送登録
                      </Button>
                    )}
                    {item.status !== 'pending' && item.tracking_number && (
                      <Tooltip title="伝票番号を編集">
                        <IconButton size="small" onClick={() => handleOpenTrackingDialog(item)}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 伝票番号登録ダイアログ */}
      <Dialog open={trackingDialogOpen} onClose={() => setTrackingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>発送情報を登録</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                {selectedItem.item.species_name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                買受者: {selectedItem.buyer.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                配送先: {selectedItem.buyer.address}
              </Typography>
            </Box>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="配送業者"
                value={trackingForm.shipping_company}
                onChange={(e) => setTrackingForm({ ...trackingForm, shipping_company: e.target.value })}
                select
                SelectProps={{ native: true }}
              >
                <option value="ヤマト運輸">ヤマト運輸</option>
                <option value="佐川急便">佐川急便</option>
                <option value="日本郵便">日本郵便</option>
                <option value="その他">その他</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="伝票番号"
                value={trackingForm.tracking_number}
                onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })}
                placeholder="1234-5678-9012"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackingDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Mock: 実際はAPIを呼び出す
              setTrackingDialogOpen(false);
            }}
            startIcon={<ShippingIcon />}
          >
            発送登録
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

