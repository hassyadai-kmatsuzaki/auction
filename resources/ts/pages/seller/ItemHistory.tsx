import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Pagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  Pets as PetsIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

interface Item {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  is_premium: boolean;
  status: string;
  thumbnail_path: string | null;
  auction: {
    id: number;
    title: string;
    event_date: string;
    status: string;
  } | null;
  won_item: {
    winning_price: number;
    quantity: number;
    payment_status: string;
    delivery_status: string;
  } | null;
  created_at: string;
}

interface Stats {
  total_items: number;
  items_this_month: number;
  total_sales: number;
  sales_this_month: number;
  pending_payment: number;
  items_shipping: number;
}

export default function ItemHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_items: 0,
    items_this_month: 0,
    total_sales: 0,
    sales_this_month: 0,
    pending_payment: 0,
    items_shipping: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchItems();
    fetchStats();
  }, [currentPage, filterStatus, searchTerm]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20',
      });
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await axios.get(`/api/seller/items?${params}`);
      if (response.data.success) {
        setItems(response.data.data.items);
        setLastPage(response.data.data.pagination.last_page);
        setTotal(response.data.data.pagination.total);
      }
    } catch (err) {
      console.error('出品履歴取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/seller/items/stats');
      if (response.data.success) {
        setStats(response.data.data.stats);
      }
    } catch (err) {
      console.error('統計取得エラー:', err);
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
      case 'sold': return { bgcolor: '#ECFDF5', color: '#059669' };
      case 'live': return { bgcolor: '#FEF3C7', color: '#D97706' };
      case 'registered': return { bgcolor: '#DBEAFE', color: '#2563EB' };
      case 'draft': return { bgcolor: '#F3E8FF', color: '#9333EA' };
      case 'unsold': return { bgcolor: '#FEE2E2', color: '#DC2626' };
      case 'cancelled': return { bgcolor: '#F1F5F9', color: '#64748B' };
      default: return { bgcolor: '#F1F5F9', color: '#64748B' };
    }
  };

  const filteredItems = items.filter(item => {
    const matchesTab = tabValue === 0 || 
                       (tabValue === 1 && ['draft', 'registered'].includes(item.status)) ||
                       (tabValue === 2 && ['sold', 'live'].includes(item.status)) ||
                       (tabValue === 3 && ['unsold', 'cancelled'].includes(item.status));
    return matchesTab;
  });

  // 統計計算
  const soldItems = items.filter(i => i.status === 'sold').length;
  const totalSales = items
    .filter(i => i.won_item)
    .reduce((sum, i) => sum + (i.won_item?.winning_price || 0) * (i.won_item?.quantity || 0), 0);
  const avgPrice = soldItems > 0 ? Math.round(totalSales / soldItems) : 0;

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            出品履歴
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            過去の出品状況を確認できます
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/seller/items/create')}
        >
          新規出品申込
        </Button>
      </Box>

      {/* 統計カード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#DBEAFE', width: 44, height: 44 }}>
                  <PetsIcon sx={{ color: '#2563EB' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    総出品数
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.total_items}件
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#ECFDF5', width: 44, height: 44 }}>
                  <CheckCircleIcon sx={{ color: '#059669' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    今月の出品
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.items_this_month}件
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#FEF3C7', width: 44, height: 44 }}>
                  <TrendingUpIcon sx={{ color: '#D97706' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    総売上
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    ¥{formatYen(stats.total_sales)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#F3E8FF', width: 44, height: 44 }}>
                  <HistoryIcon sx={{ color: '#9333EA' }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    発送待ち
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.items_shipping}件
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* タブ */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{ px: 2, pt: 1 }}
        >
          <Tab label="すべて" />
          <Tab label="出品予定" />
          <Tab label="落札済み" />
          <Tab label="不落札・キャンセル" />
        </Tabs>
      </Card>

      {/* 検索・フィルター */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              size="small"
              placeholder="品種名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>ステータス</InputLabel>
              <Select
                value={filterStatus}
                label="ステータス"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">すべて</MenuItem>
                <MenuItem value="draft">審査中</MenuItem>
                <MenuItem value="registered">承認済み</MenuItem>
                <MenuItem value="live">オークション中</MenuItem>
                <MenuItem value="sold">落札済み</MenuItem>
                <MenuItem value="unsold">不落札</MenuItem>
                <MenuItem value="cancelled">キャンセル</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredItems.length === 0 ? (
            <Alert severity="info">
              {items.length === 0 
                ? '出品履歴がありません。新規出品申込から出品を始めましょう！' 
                : '該当する出品がありません'}
            </Alert>
          ) : (
            <>
              {/* テーブル */}
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>品種名</TableCell>
                      <TableCell>オークション</TableCell>
                      <TableCell align="center">数量</TableCell>
                      <TableCell align="right">開始価格</TableCell>
                      <TableCell align="right">落札価格</TableCell>
                      <TableCell align="center">ステータス</TableCell>
                      <TableCell align="center">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: '#F0FDF4' }}>
                              <PetsIcon sx={{ fontSize: 18, color: '#059669' }} />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {item.species_name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                #{item.item_number} | {new Date(item.created_at).toLocaleDateString('ja-JP')}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {item.auction ? (
                            <>
                              <Typography variant="body2">{item.auction.title}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {new Date(item.auction.event_date).toLocaleDateString('ja-JP')}
                              </Typography>
                            </>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="center">{item.quantity}匹</TableCell>
                        <TableCell align="right">¥{formatYen(item.start_price)}</TableCell>
                        <TableCell align="right">
                          {item.won_item ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                              ¥{formatYen(item.won_item.winning_price)}
                            </Typography>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getStatusLabel(item.status)}
                            size="small"
                            sx={{
                              ...getStatusColor(item.status),
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => navigate(`/seller/items/${item.id}`)}
                          >
                            <VisibilityIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* ページネーション */}
              {lastPage > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={lastPage}
                    page={currentPage}
                    onChange={(_, page) => setCurrentPage(page)}
                    color="primary"
                  />
                </Box>
              )}
              
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                全{total}件
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
