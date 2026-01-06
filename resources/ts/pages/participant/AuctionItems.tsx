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
  bidder_display: 'count' | 'simple' | 'hidden';
  items: (Item & { bidder_count?: number; bidder_display?: 'lane_default' | 'count' | 'simple' | 'hidden' })[];
}

const mockLaneItems: LaneItems[] = [
  {
    laneNumber: 1,
    laneName: 'レーン1 - 幹之系',
    bidder_display: 'count',
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
        inspection_info: '体外光あり、フルボディタイプ',
        individual_info: '全体的に光沢があり美しい個体です',
        is_premium: true,
        thumbnail_path: '/img/medaka/01.png',
        status: 'registered',
        bidder_count: 5,
        bidder_display: 'lane_default',
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
        inspection_info: '極上個体、背中全面が強く光る',
        individual_info: '背中全面が強く光っています',
        is_premium: true,
        thumbnail_path: '/img/medaka/01.png',
        status: 'registered',
        bidder_count: 8,
        bidder_display: 'lane_default',
      },
      {
        id: 3,
        auction_id: 1,
        item_number: 3,
        species_name: '幹之メダカ（普通体型）',
        quantity: 10,
        start_price: 300,
        current_price: 300,
        inspection_info: '標準品質、初心者向け',
        is_premium: false,
        thumbnail_path: '/img/medaka/01.png',
        status: 'registered',
        bidder_count: 3,
        bidder_display: 'lane_default',
      },
    ],
  },
  {
    laneNumber: 2,
    laneName: 'レーン2 - 楊貴妃系',
    bidder_display: 'simple',
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
        inspection_info: '色揚げ良好、赤みが強い',
        individual_info: '赤みが強く出ています',
        is_premium: false,
        thumbnail_path: '/img/medaka/02.png',
        status: 'registered',
        bidder_count: 4,
        bidder_display: 'lane_default',
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
        inspection_info: '深紅の発色、選別個体',
        is_premium: true,
        thumbnail_path: '/img/medaka/02.png',
        status: 'registered',
        bidder_count: 6,
        bidder_display: 'lane_default',
      },
    ],
  },
  {
    laneNumber: 3,
    laneName: 'レーン3 - オロチ系',
    bidder_display: 'count',
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
        inspection_info: '黒化良好、全身真っ黒',
        individual_info: '全身真っ黒な美個体',
        is_premium: true,
        thumbnail_path: '/img/medaka/03.png',
        status: 'registered',
        bidder_count: 7,
        bidder_display: 'lane_default',
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
        inspection_info: 'ラメ多数、黒地に輝くラメ',
        is_premium: true,
        thumbnail_path: '/img/medaka/03.png',
        status: 'registered',
        bidder_count: 9,
        bidder_display: 'count',
      },
    ],
  },
  {
    laneNumber: 4,
    laneName: 'レーン4 - 三色・錦系',
    bidder_display: 'hidden',
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
        inspection_info: '配色バランス良好、赤黒白',
        is_premium: false,
        thumbnail_path: '/img/medaka/04.png',
        status: 'registered',
        bidder_count: 2,
        bidder_display: 'lane_default',
      },
      {
        id: 9,
        auction_id: 1,
        item_number: 9,
        species_name: '紅白メダカ',
        quantity: 5,
        start_price: 400,
        current_price: 400,
        inspection_info: '紅白の模様が美しい',
        is_premium: false,
        thumbnail_path: '/img/medaka/04.png',
        status: 'registered',
        bidder_count: 1,
        bidder_display: 'simple',
      },
    ],
  },
  {
    laneNumber: 5,
    laneName: 'レーン5 - ラメ系',
    bidder_display: 'count',
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
        inspection_info: 'ラメ良好、夜桜の名に相応しい',
        is_premium: true,
        thumbnail_path: '/img/medaka/05.png',
        status: 'registered',
        bidder_count: 5,
        bidder_display: 'lane_default',
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
        inspection_info: '青ラメ多数、宝石のような輝き',
        is_premium: true,
        thumbnail_path: '/img/medaka/05.png',
        status: 'registered',
        bidder_count: 11,
        bidder_display: 'lane_default',
      },
    ],
  },
  {
    laneNumber: 6,
    laneName: 'レーン6 - 特選・レア',
    bidder_display: 'count',
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
        inspection_info: '最高品質、厳選された極上個体',
        individual_info: '厳選された極上個体',
        is_premium: true,
        thumbnail_path: '/img/medaka/06.png',
        status: 'registered',
        bidder_count: 15,
        bidder_display: 'lane_default',
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
        inspection_info: '超多ラメ、圧倒的な輝き',
        is_premium: true,
        thumbnail_path: '/img/medaka/06.png',
        status: 'registered',
        bidder_count: 12,
        bidder_display: 'hidden',
      },
    ],
  },
];

// 入札者数の表示形式を取得
const getBidderDisplay = (
  item: LaneItems['items'][0],
  laneBidderDisplay: 'count' | 'simple' | 'hidden'
): 'count' | 'simple' | 'hidden' => {
  if (item.bidder_display === 'lane_default' || !item.bidder_display) {
    return laneBidderDisplay;
  }
  return item.bidder_display;
};

// 入札者数の表示コンポーネント
const BidderCountChip = ({ 
  count, 
  displayMode 
}: { 
  count: number; 
  displayMode: 'count' | 'simple' | 'hidden';
}) => {
  if (displayMode === 'hidden' || count === 0) return null;
  
  if (displayMode === 'count') {
    return (
      <Chip
        label={`${count}人入札中`}
        size="small"
        color="error"
        sx={{ 
          fontWeight: 600,
          fontSize: '0.7rem',
        }}
      />
    );
  }
  
  // simple
  return (
    <Chip
      label="入札中"
      size="small"
      color="error"
      sx={{ 
        fontWeight: 600,
        fontSize: '0.7rem',
      }}
    />
  );
};

export default function AuctionItems() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [selectedLane, setSelectedLane] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LaneItems['items'][0] | null>(null);
  const [selectedLaneDisplay, setSelectedLaneDisplay] = useState<'count' | 'simple' | 'hidden'>('count');

  const handleLaneChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedLane(newValue);
  };

  const handleDetailOpen = (item: LaneItems['items'][0], laneBidderDisplay: 'count' | 'simple' | 'hidden') => {
    setSelectedItem(item);
    setSelectedLaneDisplay(laneBidderDisplay);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
  };

  // アイテムとレーン情報を含む配列
  const currentLaneItemsWithLane = selectedLane === 0 
    ? mockLaneItems.flatMap(lane => lane.items.map(item => ({ item, laneBidderDisplay: lane.bidder_display })))
    : (mockLaneItems[selectedLane - 1]?.items || []).map(item => ({ 
        item, 
        laneBidderDisplay: mockLaneItems[selectedLane - 1]?.bidder_display || 'count' 
      }));

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
          {currentLaneItemsWithLane.map(({ item, laneBidderDisplay }) => {
            const displayMode = getBidderDisplay(item, laneBidderDisplay);
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                  onClick={() => handleDetailOpen(item, laneBidderDisplay)}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        No.{item.item_number}
                      </Typography>
                      <BidderCountChip count={item.bidder_count || 0} displayMode={displayMode} />
                    </Box>
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
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {item.inspection_info}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
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
                <TableCell>個体情報</TableCell>
                <TableCell align="center">入札状況</TableCell>
                <TableCell align="center">詳細</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentLaneItemsWithLane.map(({ item, laneBidderDisplay }) => {
                const displayMode = getBidderDisplay(item, laneBidderDisplay);
                return (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleDetailOpen(item, laneBidderDisplay)}
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
                    <TableCell>{item.inspection_info || '-'}</TableCell>
                    <TableCell align="center">
                      <BidderCountChip count={item.bidder_count || 0} displayMode={displayMode} />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="primary">
                        <InfoIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {selectedItem?.is_premium && (
                  <Chip label="プレミアム" color="warning" />
                )}
                {selectedItem && (
                  <BidderCountChip 
                    count={selectedItem.bidder_count || 0} 
                    displayMode={getBidderDisplay(selectedItem, selectedLaneDisplay)} 
                  />
                )}
              </Box>

              <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                ¥{selectedItem?.start_price.toLocaleString()}〜
              </Typography>

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
                    個体情報
                  </Typography>
                  <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedItem.inspection_info}
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

