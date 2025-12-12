import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  TextField,
  InputAdornment,
  Tooltip,
  Badge,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  Stop as StopIcon,
  People as PeopleIcon,
  LiveTv as LiveTvIcon,
  List as ListIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  FiberManualRecord as RecordIcon,
} from '@mui/icons-material';

// Mock: 6レーンのデータ
const lanes = [
  { lane_number: 1, item: { item_number: 1, species_name: '幹之メダカ フルボディ', current_price: 8500, start_price: 5000, quantity: 5, active_bidders: 3, status: 'bidding' } },
  { lane_number: 2, item: { item_number: 2, species_name: '楊貴妃メダカ', current_price: 4500, start_price: 3000, quantity: 3, active_bidders: 2, status: 'bidding' } },
  { lane_number: 3, item: { item_number: 3, species_name: 'オロチメダカ', current_price: 8000, start_price: 5000, quantity: 4, active_bidders: 1, status: 'bidding' } },
  { lane_number: 4, item: { item_number: 4, species_name: '三色錦メダカ', current_price: 7500, start_price: 5000, quantity: 6, active_bidders: 4, status: 'bidding' } },
  { lane_number: 5, item: { item_number: 5, species_name: '青幹之メダカ', current_price: 7000, start_price: 5000, quantity: 5, active_bidders: 0, status: 'waiting' } },
  { lane_number: 6, item: { item_number: 6, species_name: '紅白メダカ', current_price: 5500, start_price: 4000, quantity: 4, active_bidders: 2, status: 'bidding' } },
];

// Mock: 当日の出品情報一覧
const todayItems = [
  { id: 1, item_number: 1, species_name: '幹之メダカ フルボディ', quantity: 5, start_price: 5000, current_price: 8500, seller: '田中養魚場', lane_number: 1, status: 'bidding', winner: null },
  { id: 2, item_number: 2, species_name: '楊貴妃メダカ', quantity: 3, start_price: 3000, current_price: 4500, seller: '田中養魚場', lane_number: 2, status: 'bidding', winner: null },
  { id: 3, item_number: 3, species_name: 'オロチメダカ', quantity: 4, start_price: 5000, current_price: 8000, seller: '鈴木メダカファーム', lane_number: 3, status: 'bidding', winner: null },
  { id: 4, item_number: 4, species_name: '三色錦メダカ', quantity: 6, start_price: 5000, current_price: 7500, seller: '鈴木メダカファーム', lane_number: 4, status: 'bidding', winner: null },
  { id: 5, item_number: 5, species_name: '青幹之メダカ', quantity: 5, start_price: 5000, current_price: 7000, seller: 'メダカの佐藤', lane_number: 5, status: 'waiting', winner: null },
  { id: 6, item_number: 6, species_name: '紅白メダカ', quantity: 4, start_price: 4000, current_price: 5500, seller: 'メダカの佐藤', lane_number: 6, status: 'bidding', winner: null },
  { id: 7, item_number: 7, species_name: '紅白ラメ', quantity: 3, start_price: 10000, current_price: 10000, seller: '田中養魚場', lane_number: null, status: 'pending', winner: null },
  { id: 8, item_number: 8, species_name: '三色ラメ', quantity: 2, start_price: 15000, current_price: 15000, seller: '鈴木メダカファーム', lane_number: null, status: 'pending', winner: null },
  { id: 9, item_number: 9, species_name: 'サファイアメダカ', quantity: 4, start_price: 8000, current_price: 8000, seller: 'メダカの佐藤', lane_number: null, status: 'pending', winner: null },
  { id: 10, item_number: 10, species_name: '黒ラメ幹之', quantity: 5, start_price: 6000, current_price: 18000, seller: '田中養魚場', lane_number: null, status: 'sold', winner: '山田一郎' },
  { id: 11, item_number: 11, species_name: 'ブラックダイヤ', quantity: 3, start_price: 12000, current_price: 25000, seller: '鈴木メダカファーム', lane_number: null, status: 'sold', winner: '伊藤美穂' },
];

// 統計
const stats = {
  totalItems: todayItems.length,
  biddingItems: todayItems.filter(i => i.status === 'bidding').length,
  soldItems: todayItems.filter(i => i.status === 'sold').length,
  pendingItems: todayItems.filter(i => i.status === 'pending').length,
  totalSales: todayItems.filter(i => i.status === 'sold').reduce((sum, i) => sum + i.current_price * i.quantity, 0),
};

export default function LiveControl() {
  const navigate = useNavigate();
  const { auctionId } = useParams();
  const [isPaused, setIsPaused] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // フィルタリング
  const filteredItems = todayItems.filter((item) => {
    const matchesSearch =
      item.species_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.seller.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_number.toString().includes(searchQuery);

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && item.status === statusFilter;
  });

  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: string; bgcolor: string; hasIcon?: boolean }> = {
      bidding: { label: '入札中', color: '#059669', bgcolor: '#ECFDF5', hasIcon: true },
      waiting: { label: '待機中', color: '#F59E0B', bgcolor: '#FEF3C7' },
      pending: { label: '出品待ち', color: '#64748B', bgcolor: '#F1F5F9' },
      sold: { label: '落札済み', color: '#3B82F6', bgcolor: '#DBEAFE' },
    };
    const c = config[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };
    return (
      <Chip
        size="small"
        label={c.label}
        icon={c.hasIcon ? <RecordIcon sx={{ fontSize: 10, animation: 'pulse 1s infinite' }} /> : undefined}
        sx={{ bgcolor: c.bgcolor, color: c.color, fontWeight: 600, fontSize: '0.7rem' }}
      />
    );
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/auctions')}
          >
            戻る
          </Button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              ライブオークション管理
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              2025年11月オークション
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            label="LIVE 開催中"
            color="error"
            icon={<RecordIcon sx={{ fontSize: 12 }} />}
            sx={{ fontWeight: 600, animation: 'pulse 2s infinite' }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            参加者: <strong>45名</strong>
          </Typography>
        </Box>
      </Box>

      {/* タブ切り替え */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            icon={<LiveTvIcon />}
            iconPosition="start"
            label="ライブコントロール"
          />
          <Tab
            icon={<Badge badgeContent={stats.totalItems} color="primary" max={99}><ListIcon /></Badge>}
            iconPosition="start"
            label="出品一覧"
          />
        </Tabs>
      </Paper>

      {/* ライブコントロールタブ */}
      {tabValue === 0 && (
        <>
          {/* コントロールパネル */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant={isPaused ? 'contained' : 'outlined'}
                    color={isPaused ? 'success' : 'warning'}
                    startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                    onClick={() => setIsPaused(!isPaused)}
                  >
                    {isPaused ? '再開' : '一時停止'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                  >
                    緊急停止
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>入札中</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>{stats.biddingItems}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>落札済み</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#3B82F6' }}>{stats.soldItems}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>残り</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{stats.pendingItems}</Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* 6レーン表示 */}
          <Grid container spacing={2}>
            {lanes.map((lane) => (
              <Grid item xs={12} sm={6} md={4} key={lane.lane_number}>
                <Card sx={{ position: 'relative', overflow: 'visible' }}>
                  {lane.item.status === 'bidding' && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: '#DC2626',
                        color: 'white',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 1s infinite',
                      }}
                    >
                      <RecordIcon sx={{ fontSize: 12 }} />
                    </Box>
                  )}
                  <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1.5 }}>
                    <Typography variant="subtitle1" align="center" sx={{ fontWeight: 600 }}>
                      レーン {lane.lane_number}
                    </Typography>
                  </Box>
                  
                  <CardMedia
                    component="div"
                    sx={{
                      height: 120,
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      動画プレビュー
                    </Typography>
                  </CardMedia>

                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        No.{lane.item.item_number}
                      </Typography>
                      {getStatusChip(lane.item.status)}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
                      {lane.item.species_name}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h4" sx={{ color: '#059669', fontWeight: 700 }}>
                        ¥{lane.item.current_price.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        開始 ¥{lane.item.start_price.toLocaleString()} × {lane.item.quantity}匹
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                        label={`${lane.item.active_bidders}人入札中`}
                        color={lane.item.active_bidders > 0 ? 'primary' : 'default'}
                        size="small"
                        sx={{ fontSize: '0.7rem' }}
                      />
                      <IconButton size="small" color="primary">
                        <SkipNextIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* 出品一覧タブ */}
      {tabValue === 1 && (
        <>
          {/* 統計カード */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>総出品数</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.totalItems}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>入札中</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>{stats.biddingItems}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>落札済み</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#3B82F6' }}>{stats.soldItems}点</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>売上合計</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>¥{stats.totalSales.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Box>

          {/* フィルター */}
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="品種名、出品者、番号で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ width: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Divider orientation="vertical" flexItem />
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { value: 'all', label: 'すべて' },
                  { value: 'bidding', label: '入札中' },
                  { value: 'waiting', label: '待機中' },
                  { value: 'pending', label: '出品待ち' },
                  { value: 'sold', label: '落札済み' },
                ].map((f) => (
                  <Chip
                    key={f.value}
                    label={f.label}
                    size="small"
                    onClick={() => setStatusFilter(f.value)}
                    sx={{
                      bgcolor: statusFilter === f.value ? 'primary.main' : 'grey.100',
                      color: statusFilter === f.value ? 'white' : 'text.primary',
                      fontWeight: 500,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: statusFilter === f.value ? 'primary.dark' : 'grey.200' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Card>

          {/* 出品一覧テーブル */}
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>No.</TableCell>
                    <TableCell>品種名</TableCell>
                    <TableCell>出品者</TableCell>
                    <TableCell align="center">匹数</TableCell>
                    <TableCell align="right">開始価格</TableCell>
                    <TableCell align="right">現在価格</TableCell>
                    <TableCell align="center">レーン</TableCell>
                    <TableCell align="center">ステータス</TableCell>
                    <TableCell>落札者</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        bgcolor: item.status === 'bidding' ? '#F0FDF4' : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.item_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.species_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: '#F0FDF4', color: '#059669', fontSize: '0.7rem' }}>
                            {item.seller.charAt(0)}
                          </Avatar>
                          <Typography variant="body2">{item.seller}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{item.quantity}匹</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">¥{item.start_price.toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: item.current_price > item.start_price ? '#059669' : 'inherit',
                          }}
                        >
                          ¥{item.current_price.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {item.lane_number ? (
                          <Chip label={`L${item.lane_number}`} size="small" sx={{ fontWeight: 600 }} />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {getStatusChip(item.status)}
                      </TableCell>
                      <TableCell>
                        {item.winner ? (
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.winner}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="詳細">
                          <IconButton size="small">
                            <VisibilityIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="編集">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/auctions/${auctionId}/items/${item.id}/edit`)}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* アニメーション用スタイル */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Box>
  );
}
