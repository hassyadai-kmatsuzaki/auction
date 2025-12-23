import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { Item } from '../../types';

// レーンごとのアイテムデータ（Mock）
interface LaneItems {
  laneNumber: number;
  laneName: string;
  items: Item[];
}

const mockLaneItems: LaneItems[] = [
  {
    laneNumber: 1,
    laneName: 'レーン1 - 幹之系',
    items: [
      {
        id: 1,
        auction_id: 1,
        item_number: 1,
        species_name: '幹之メダカ（フルボディ）',
        quantity: 5,
        start_price: 500,
        current_price: 500,
        estimated_price: 1000,
        inspection_info: '体外光あり',
        individual_info: '全体的に光沢があり美しい個体です',
        is_premium: true,
        thumbnail_path: '/img/medaka/01.png',
        status: 'registered',
      },
      {
        id: 2,
        auction_id: 1,
        item_number: 2,
        species_name: '幹之メダカ（スーパー光）',
        quantity: 3,
        start_price: 800,
        current_price: 800,
        estimated_price: 1500,
        inspection_info: '極上個体',
        individual_info: '背中全面が強く光っています',
        is_premium: true,
        thumbnail_path: '/img/medaka/01.png',
        status: 'registered',
      },
      {
        id: 3,
        auction_id: 1,
        item_number: 3,
        species_name: '幹之メダカ（普通体型）',
        quantity: 10,
        start_price: 300,
        current_price: 300,
        inspection_info: '標準品質',
        is_premium: false,
        thumbnail_path: '/img/medaka/01.png',
        status: 'registered',
      },
    ],
  },
  {
    laneNumber: 2,
    laneName: 'レーン2 - 楊貴妃系',
    items: [
      {
        id: 4,
        auction_id: 1,
        item_number: 4,
        species_name: '楊貴妃メダカ（濃色）',
        quantity: 5,
        start_price: 400,
        current_price: 400,
        estimated_price: 700,
        inspection_info: '色揚げ良好',
        individual_info: '赤みが強く出ています',
        is_premium: false,
        thumbnail_path: '/img/medaka/02.png',
        status: 'registered',
      },
      {
        id: 5,
        auction_id: 1,
        item_number: 5,
        species_name: '紅帝メダカ',
        quantity: 3,
        start_price: 600,
        current_price: 600,
        estimated_price: 1200,
        inspection_info: '深紅の発色',
        is_premium: true,
        thumbnail_path: '/img/medaka/02.png',
        status: 'registered',
      },
    ],
  },
  {
    laneNumber: 3,
    laneName: 'レーン3 - オロチ系',
    items: [
      {
        id: 6,
        auction_id: 1,
        item_number: 6,
        species_name: 'オロチメダカ',
        quantity: 4,
        start_price: 800,
        current_price: 800,
        estimated_price: 1500,
        inspection_info: '黒化良好',
        individual_info: '全身真っ黒な美個体',
        is_premium: true,
        thumbnail_path: '/img/medaka/03.png',
        status: 'registered',
      },
      {
        id: 7,
        auction_id: 1,
        item_number: 7,
        species_name: 'オロチラメメダカ',
        quantity: 3,
        start_price: 1000,
        current_price: 1000,
        estimated_price: 2000,
        inspection_info: 'ラメ多数',
        is_premium: true,
        thumbnail_path: '/img/medaka/03.png',
        status: 'registered',
      },
    ],
  },
  {
    laneNumber: 4,
    laneName: 'レーン4 - 三色・錦系',
    items: [
      {
        id: 8,
        auction_id: 1,
        item_number: 8,
        species_name: '三色錦メダカ',
        quantity: 6,
        start_price: 600,
        current_price: 600,
        estimated_price: 1000,
        inspection_info: '配色バランス良好',
        is_premium: false,
        thumbnail_path: '/img/medaka/04.png',
        status: 'registered',
      },
      {
        id: 9,
        auction_id: 1,
        item_number: 9,
        species_name: '紅白メダカ',
        quantity: 5,
        start_price: 400,
        current_price: 400,
        is_premium: false,
        thumbnail_path: '/img/medaka/04.png',
        status: 'registered',
      },
    ],
  },
  {
    laneNumber: 5,
    laneName: 'レーン5 - ラメ系',
    items: [
      {
        id: 10,
        auction_id: 1,
        item_number: 10,
        species_name: '夜桜メダカ',
        quantity: 4,
        start_price: 700,
        current_price: 700,
        estimated_price: 1300,
        inspection_info: 'ラメ良好',
        is_premium: true,
        thumbnail_path: '/img/medaka/05.png',
        status: 'registered',
      },
      {
        id: 11,
        auction_id: 1,
        item_number: 11,
        species_name: 'サファイアメダカ',
        quantity: 3,
        start_price: 900,
        current_price: 900,
        estimated_price: 1800,
        inspection_info: '青ラメ多数',
        is_premium: true,
        thumbnail_path: '/img/medaka/05.png',
        status: 'registered',
      },
    ],
  },
  {
    laneNumber: 6,
    laneName: 'レーン6 - 特選・レア',
    items: [
      {
        id: 12,
        auction_id: 1,
        item_number: 12,
        species_name: '王華メダカ',
        quantity: 2,
        start_price: 1500,
        current_price: 1500,
        estimated_price: 3000,
        inspection_info: '最高品質',
        individual_info: '厳選された極上個体',
        is_premium: true,
        thumbnail_path: '/img/medaka/06.png',
        status: 'registered',
      },
      {
        id: 13,
        auction_id: 1,
        item_number: 13,
        species_name: '鬼ラメメダカ',
        quantity: 3,
        start_price: 1200,
        current_price: 1200,
        estimated_price: 2500,
        inspection_info: '超多ラメ',
        is_premium: true,
        thumbnail_path: '/img/medaka/06.png',
        status: 'registered',
      },
    ],
  },
];

export default function AuctionItems() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [selectedLane, setSelectedLane] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const handleLaneChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedLane(newValue);
  };

  const handleDetailOpen = (item: Item) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
  };

  const currentLaneItems = selectedLane === 0 
    ? mockLaneItems.flatMap(lane => lane.items)
    : mockLaneItems[selectedLane - 1]?.items || [];

  const totalItems = mockLaneItems.reduce((acc, lane) => acc + lane.items.length, 0);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              出品一覧
            </Typography>
            <Typography variant="body2" color="text.secondary">
              全{totalItems}点の出品があります
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => setViewMode('grid')}
              color={viewMode === 'grid' ? 'primary' : 'default'}
            >
              <ViewModuleIcon />
            </IconButton>
            <IconButton
              onClick={() => setViewMode('list')}
              color={viewMode === 'list' ? 'primary' : 'default'}
            >
              <ViewListIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* レーンタブ */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedLane}
          onChange={handleLaneChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`すべて (${totalItems})`} />
          {mockLaneItems.map((lane) => (
            <Tab
              key={lane.laneNumber}
              label={`${lane.laneName} (${lane.items.length})`}
            />
          ))}
        </Tabs>
      </Paper>

      {/* アイテム一覧 */}
      {viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {currentLaneItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => handleDetailOpen(item)}
              >
                {/* プレミアムバッジ */}
                {item.is_premium && (
                  <Chip
                    label="プレミアム"
                    color="warning"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                    }}
                  />
                )}

                <CardMedia
                  component="img"
                  height="160"
                  image={item.thumbnail_path}
                  alt={item.species_name}
                />

                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    No.{item.item_number}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {item.species_name}
                  </Typography>

                  <Box sx={{ mt: 1 }}>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      ¥{item.start_price.toLocaleString()}〜
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.quantity}匹セット
                    </Typography>
                  </Box>

                  {item.inspection_info && (
                    <Chip
                      label={item.inspection_info}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>No.</TableCell>
                <TableCell>品種名</TableCell>
                <TableCell align="center">匹数</TableCell>
                <TableCell align="right">開始価格</TableCell>
                <TableCell align="right">想定価格</TableCell>
                <TableCell>審査情報</TableCell>
                <TableCell align="center">詳細</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentLaneItems.map((item) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleDetailOpen(item)}
                >
                  <TableCell>{item.item_number}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {item.species_name}
                      {item.is_premium && (
                        <Chip label="プレミアム" color="warning" size="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">{item.quantity}匹</TableCell>
                  <TableCell align="right">¥{item.start_price.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {item.estimated_price ? `¥${item.estimated_price.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell>{item.inspection_info || '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="primary">
                      <InfoIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 詳細ダイアログ */}
      <Dialog
        open={detailOpen}
        onClose={handleDetailClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              No.{selectedItem?.item_number} {selectedItem?.species_name}
            </Typography>
            <IconButton onClick={handleDetailClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <img
                src={selectedItem?.thumbnail_path}
                alt={selectedItem?.species_name}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              {selectedItem?.is_premium && (
                <Chip label="プレミアム" color="warning" sx={{ mb: 2 }} />
              )}

              <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                ¥{selectedItem?.start_price.toLocaleString()}〜
              </Typography>

              {selectedItem?.estimated_price && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  落札想定: ¥{selectedItem.estimated_price.toLocaleString()}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                匹数
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedItem?.quantity}匹セット
              </Typography>

              {selectedItem?.inspection_info && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    審査情報
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedItem.inspection_info}
                  </Typography>
                </>
              )}

              {selectedItem?.individual_info && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    個体情報
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedItem.individual_info}
                  </Typography>
                </>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDetailClose}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

