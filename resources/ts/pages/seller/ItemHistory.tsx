import React, { useState } from 'react';
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
  Paper,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  Pets as PetsIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

// Mock データ
const itemHistory = [
  {
    id: 1,
    species_name: '紅白ラメ',
    quantity: '3ペア',
    auction: '2025年11月オークション',
    auction_date: '2025-11-12',
    status: 'sold',
    start_price: 5000,
    final_price: 35000,
    buyer: '佐々木様',
    submitted_at: '2025-11-05',
  },
  {
    id: 2,
    species_name: '幹之フルボディ',
    quantity: '5匹',
    auction: '2025年11月オークション',
    auction_date: '2025-11-12',
    status: 'sold',
    start_price: 3000,
    final_price: 28000,
    buyer: '伊藤様',
    submitted_at: '2025-11-05',
  },
  {
    id: 3,
    species_name: '三色ラメ',
    quantity: '2ペア',
    auction: '2025年11月オークション',
    auction_date: '2025-11-12',
    status: 'shipping',
    start_price: 8000,
    final_price: 42000,
    buyer: '渡辺様',
    submitted_at: '2025-11-05',
  },
  {
    id: 4,
    species_name: 'オロチ',
    quantity: '4匹',
    auction: '2025年12月オークション',
    auction_date: '2025-12-10',
    status: 'pending',
    start_price: 4000,
    final_price: null,
    buyer: null,
    submitted_at: '2025-12-01',
  },
  {
    id: 5,
    species_name: 'サファイア',
    quantity: '3匹',
    auction: '2025年12月オークション',
    auction_date: '2025-12-10',
    status: 'reviewing',
    start_price: 6000,
    final_price: null,
    buyer: null,
    submitted_at: '2025-12-03',
  },
  {
    id: 6,
    species_name: '楊貴妃',
    quantity: '10匹',
    auction: '2025年10月オークション',
    auction_date: '2025-10-15',
    status: 'unsold',
    start_price: 2000,
    final_price: null,
    buyer: null,
    submitted_at: '2025-10-08',
  },
  {
    id: 7,
    species_name: '紅帝',
    quantity: '2ペア',
    auction: '2025年10月オークション',
    auction_date: '2025-10-15',
    status: 'cancelled',
    start_price: 5000,
    final_price: null,
    buyer: null,
    submitted_at: '2025-10-08',
  },
];

export default function ItemHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sold': return '落札済み';
      case 'shipping': return '発送待ち';
      case 'pending': return '出品予定';
      case 'reviewing': return '審査中';
      case 'unsold': return '不落札';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sold': return { bgcolor: '#ECFDF5', color: '#059669' };
      case 'shipping': return { bgcolor: '#FEF3C7', color: '#D97706' };
      case 'pending': return { bgcolor: '#DBEAFE', color: '#2563EB' };
      case 'reviewing': return { bgcolor: '#F3E8FF', color: '#9333EA' };
      case 'unsold': return { bgcolor: '#FEE2E2', color: '#DC2626' };
      case 'cancelled': return { bgcolor: '#F1F5F9', color: '#64748B' };
      default: return { bgcolor: '#F1F5F9', color: '#64748B' };
    }
  };

  const filteredItems = itemHistory.filter(item => {
    const matchesSearch = item.species_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.auction.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesTab = tabValue === 0 || 
                       (tabValue === 1 && ['pending', 'reviewing'].includes(item.status)) ||
                       (tabValue === 2 && ['sold', 'shipping'].includes(item.status)) ||
                       (tabValue === 3 && ['unsold', 'cancelled'].includes(item.status));
    return matchesSearch && matchesStatus && matchesTab;
  });

  // 統計
  const totalItems = itemHistory.length;
  const soldItems = itemHistory.filter(i => i.status === 'sold' || i.status === 'shipping').length;
  const totalSales = itemHistory
    .filter(i => i.final_price)
    .reduce((sum, i) => sum + (i.final_price || 0), 0);
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
          onClick={() => navigate('/seller/submit')}
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
                    {totalItems}件
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
                    落札数
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {soldItems}件
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
                    ¥{totalSales.toLocaleString()}
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
                    平均落札価格
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    ¥{avgPrice.toLocaleString()}
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
          <Tab label="出品予定・審査中" />
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
              placeholder="品種名・オークション名で検索..."
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
                <MenuItem value="sold">落札済み</MenuItem>
                <MenuItem value="shipping">発送待ち</MenuItem>
                <MenuItem value="pending">出品予定</MenuItem>
                <MenuItem value="reviewing">審査中</MenuItem>
                <MenuItem value="unsold">不落札</MenuItem>
                <MenuItem value="cancelled">キャンセル</MenuItem>
              </Select>
            </FormControl>
          </Box>

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
                  <TableCell>落札者</TableCell>
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
                            申請日: {new Date(item.submitted_at).toLocaleDateString('ja-JP')}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.auction}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {new Date(item.auction_date).toLocaleDateString('ja-JP')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="right">¥{item.start_price.toLocaleString()}</TableCell>
                    <TableCell align="right">
                      {item.final_price ? (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                          ¥{item.final_price.toLocaleString()}
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
                    <TableCell>{item.buyer || '-'}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="primary">
                        <VisibilityIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredItems.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                該当する出品がありません
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

