import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
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
  Divider,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Pets as PetsIcon,
  Receipt as ReceiptIcon,
  LocalShipping as ShippingIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Event as EventIcon,
} from '@mui/icons-material';

// Mock データ
const stats = {
  total_items: 45,
  items_this_month: 12,
  total_sales: 580000,
  sales_this_month: 185000,
  pending_payment: 65000,
  items_shipping: 3,
};

const upcomingAuctions = [
  { id: 1, title: '2025年12月オークション', date: '2025-12-10', deadline: '2025-12-05', status: 'accepting' },
  { id: 2, title: '2025年クリスマス特別', date: '2025-12-24', deadline: '2025-12-19', status: 'upcoming' },
];

const recentItems = [
  { id: 1, species_name: '紅白ラメ 3ペア', auction: '2025年11月オークション', status: 'sold', price: 35000 },
  { id: 2, species_name: '幹之フルボディ 5匹', auction: '2025年11月オークション', status: 'sold', price: 28000 },
  { id: 3, species_name: '三色ラメ 2ペア', auction: '2025年11月オークション', status: 'shipping', price: 42000 },
];

const notifications = [
  { id: 1, message: '12月オークションの出品申込受付が開始しました', type: 'info' },
  { id: 2, message: '11月オークションの精算が完了しました', type: 'success' },
];

// KPIカード
function StatCard({ title, value, subValue, icon, color, trend }: any) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            {subValue && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {subValue}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function SellerDashboard() {
  const navigate = useNavigate();

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            こんにちは、田中養魚場さん
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            ダッシュボード
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/seller/submit')}
        >
          出品申込
        </Button>
      </Box>

      {/* お知らせ */}
      {notifications.map((notif) => (
        <Alert key={notif.id} severity={notif.type as any} sx={{ mb: 2 }}>
          {notif.message}
        </Alert>
      ))}

      {/* KPIカード */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="総出品数"
            value={stats.total_items}
            subValue={`今月 +${stats.items_this_month}点`}
            icon={<PetsIcon />}
            color="#3B82F6"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="総売上"
            value={`¥${(stats.total_sales / 10000).toFixed(1)}万`}
            subValue={`今月 ¥${(stats.sales_this_month / 10000).toFixed(1)}万`}
            icon={<TrendingUpIcon />}
            color="#059669"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="入金待ち"
            value={`¥${stats.pending_payment.toLocaleString()}`}
            icon={<ReceiptIcon />}
            color="#F59E0B"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="発送待ち"
            value={`${stats.items_shipping}件`}
            icon={<ShippingIcon />}
            color="#8B5CF6"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* 開催予定オークション */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  開催予定オークション
                </Typography>
              </Box>

              {upcomingAuctions.map((auction) => (
                <Box
                  key={auction.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    bgcolor: auction.status === 'accepting' ? '#F0FDF4' : 'grey.50',
                    border: '1px solid',
                    borderColor: auction.status === 'accepting' ? '#059669' : 'grey.200',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {auction.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        開催日: {new Date(auction.date).toLocaleDateString('ja-JP')}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={auction.status === 'accepting' ? '受付中' : '受付前'}
                      sx={{
                        bgcolor: auction.status === 'accepting' ? '#059669' : '#64748B',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    出品申込締切: {new Date(auction.deadline).toLocaleDateString('ja-JP')}
                  </Typography>
                  {auction.status === 'accepting' && (
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1.5 }}
                      onClick={() => navigate('/seller/submit')}
                    >
                      出品申込へ
                    </Button>
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* 最近の出品 */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  最近の出品
                </Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/seller/items')}>
                  すべて見る
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>品種名</TableCell>
                      <TableCell>オークション</TableCell>
                      <TableCell align="center">ステータス</TableCell>
                      <TableCell align="right">落札価格</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentItems.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.species_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {item.auction}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={item.status === 'sold' ? '落札済' : '発送中'}
                            sx={{
                              bgcolor: item.status === 'sold' ? '#ECFDF5' : '#FEF3C7',
                              color: item.status === 'sold' ? '#059669' : '#F59E0B',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            ¥{item.price.toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

