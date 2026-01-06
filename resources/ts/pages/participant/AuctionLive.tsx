import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  Chip,
  Paper,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  People as PeopleIcon,
  Info as InfoIcon,
  Favorite as FavoriteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { Lane, Item } from '../../types';

// 拡張されたレーン型（入札者数表示設定を含む）
interface ExtendedLane extends Lane {
  bidder_display: 'count' | 'simple' | 'hidden';
  lane_name?: string;
  current_item: Item & { 
    bidder_count?: number; 
    bidder_display?: 'lane_default' | 'count' | 'simple' | 'hidden';
  };
}

// 入札者数の表示形式を取得
const getBidderDisplay = (
  item: ExtendedLane['current_item'],
  laneBidderDisplay: 'count' | 'simple' | 'hidden'
): 'count' | 'simple' | 'hidden' => {
  if (item.bidder_display === 'lane_default' || !item.bidder_display) {
    return laneBidderDisplay;
  }
  return item.bidder_display;
};

// Mock データ
const mockLanes: ExtendedLane[] = [
  {
    id: 1,
    auction_id: 1,
    lane_number: 1,
    lane_name: 'レーン1 - 幹之系',
    status: 'active',
    bidder_display: 'count',
    current_item: {
      id: 1,
      auction_id: 1,
      item_number: 1,
      species_name: '幹之メダカ',
      quantity: 5,
      start_price: 500,
      current_price: 850,
      estimated_price: 1000,
      inspection_info: '体外光あり、フルボディタイプ',
      individual_info: '全体的に光沢があり美しい個体です',
      is_premium: true,
      thumbnail_path: '/img/medaka/01.png',
      status: 'live',
      bidder_count: 5,
      bidder_display: 'lane_default',
    },
  },
  {
    id: 2,
    auction_id: 1,
    lane_number: 2,
    lane_name: 'レーン2 - 楊貴妃系',
    status: 'active',
    bidder_display: 'simple',
    current_item: {
      id: 2,
      auction_id: 1,
      item_number: 1,
      species_name: '楊貴妃メダカ',
      quantity: 3,
      start_price: 300,
      current_price: 450,
      estimated_price: 600,
      inspection_info: '色揚げ良好、赤みが強い',
      individual_info: '赤みが強く出ています',
      is_premium: false,
      thumbnail_path: '/img/medaka/02.png',
      status: 'live',
      bidder_count: 3,
      bidder_display: 'lane_default',
    },
  },
  {
    id: 3,
    auction_id: 1,
    lane_number: 3,
    lane_name: 'レーン3 - オロチ系',
    status: 'active',
    bidder_display: 'count',
    current_item: {
      id: 3,
      auction_id: 1,
      item_number: 1,
      species_name: 'オロチメダカ',
      quantity: 4,
      start_price: 800,
      current_price: 800,
      estimated_price: 1500,
      inspection_info: '黒化良好、全身真っ黒',
      individual_info: '全身真っ黒な美個体',
      is_premium: true,
      thumbnail_path: '/img/medaka/03.png',
      status: 'live',
      bidder_count: 7,
      bidder_display: 'lane_default',
    },
  },
  {
    id: 4,
    auction_id: 1,
    lane_number: 4,
    lane_name: 'レーン4 - 三色・錦系',
    status: 'active',
    bidder_display: 'hidden',
    current_item: {
      id: 4,
      auction_id: 1,
      item_number: 1,
      species_name: '三色錦メダカ',
      quantity: 6,
      start_price: 600,
      current_price: 750,
      inspection_info: '配色バランス良好',
      is_premium: false,
      thumbnail_path: '/img/medaka/04.png',
      status: 'live',
      bidder_count: 2,
      bidder_display: 'lane_default',
    },
  },
  {
    id: 5,
    auction_id: 1,
    lane_number: 5,
    lane_name: 'レーン5 - ラメ系',
    status: 'active',
    bidder_display: 'count',
    current_item: {
      id: 5,
      auction_id: 1,
      item_number: 1,
      species_name: '青幹之メダカ',
      quantity: 5,
      start_price: 700,
      current_price: 700,
      inspection_info: '青みが美しいラメ個体',
      is_premium: false,
      thumbnail_path: '/img/medaka/05.png',
      status: 'live',
      bidder_count: 4,
      bidder_display: 'lane_default',
    },
  },
  {
    id: 6,
    auction_id: 1,
    lane_number: 6,
    lane_name: 'レーン6 - 特選・レア',
    status: 'active',
    bidder_display: 'count',
    current_item: {
      id: 6,
      auction_id: 1,
      item_number: 6,
      species_name: '紅白メダカ',
      quantity: 4,
      start_price: 400,
      current_price: 550,
      inspection_info: '紅白の模様が美しい',
      is_premium: false,
      thumbnail_path: '/img/medaka/06.png',
      status: 'live',
      bidder_count: 6,
      bidder_display: 'lane_default',
    },
  },
];

export default function AuctionLive() {
  const [myBids, setMyBids] = useState<Record<number, boolean>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExtendedLane['current_item'] | null>(null);
  const [selectedLaneDisplay, setSelectedLaneDisplay] = useState<'count' | 'simple' | 'hidden'>('count');
  const [countdown] = useState(3); // Mock: 実際はWebSocketで更新

  const handleBidToggle = (itemId: number) => {
    setMyBids((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleDetailOpen = (item: ExtendedLane['current_item'], laneBidderDisplay: 'count' | 'simple' | 'hidden') => {
    setSelectedItem(item);
    setSelectedLaneDisplay(laneBidderDisplay);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
  };

  // 入札者数表示コンポーネント
  const BidderCountDisplay = ({ 
    count, 
    displayMode 
  }: { 
    count: number; 
    displayMode: 'count' | 'simple' | 'hidden';
  }) => {
    if (displayMode === 'hidden') return null;
    
    if (displayMode === 'count') {
      return (
        <Chip
          icon={<PeopleIcon />}
          label={`${count}人入札中`}
          size="small"
          color="error"
        />
      );
    }
    
    // simple - 人数なしで「入札中」のみ
    return count > 0 ? (
      <Chip
        label="入札中"
        size="small"
        color="error"
      />
    ) : null;
  };

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5" fontWeight="bold">
              オークション会場 - {mockLanes.length}レーン同時進行中
            </Typography>
            <Chip label="開催中" color="success" icon={<PlayArrowIcon />} />
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {mockLanes.map((lane) => (
            <Grid item xs={12} sm={6} md={4} key={lane.id}>
              <Card
                sx={{
                  height: '100%',
                  border: myBids[lane.current_item!.id] ? 3 : 1,
                  borderColor: myBids[lane.current_item!.id] ? 'success.main' : 'divider',
                  position: 'relative',
                }}
              >
                {/* レーン名 */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    fontWeight: 'bold',
                    zIndex: 1,
                    fontSize: '0.85rem',
                  }}
                >
                  {lane.lane_name || `レーン ${lane.lane_number}`}
                </Box>

                {/* プレミアムバッジ */}
                {lane.current_item?.is_premium && (
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

                {/* サムネイル */}
                <CardMedia
                  component="img"
                  height="200"
                  image={lane.current_item?.thumbnail_path}
                  alt={lane.current_item?.species_name}
                />

                <CardContent>
                  {/* 生体番号・品種名 */}
                  <Typography variant="caption" color="text.secondary">
                    No.{lane.current_item?.item_number}
                  </Typography>
                  <Typography variant="h6" gutterBottom>
                    {lane.current_item?.species_name}
                  </Typography>

                  {/* 現在価格 */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      現在単価
                    </Typography>
                    <Typography variant="h4" color="primary.main" fontWeight="bold">
                      ¥{lane.current_item?.current_price.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      × {lane.current_item?.quantity}匹 = ¥
                      {((lane.current_item?.current_price || 0) * (lane.current_item?.quantity || 0)).toLocaleString()}
                    </Typography>
                  </Box>

                  {/* 入札者数 */}
                  {(() => {
                    const displayMode = getBidderDisplay(lane.current_item!, lane.bidder_display);
                    const bidderCount = lane.current_item?.bidder_count || 0;
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <BidderCountDisplay count={bidderCount} displayMode={displayMode} />
                        {bidderCount > 1 && displayMode !== 'hidden' && (
                          <Chip
                            label={`${countdown}秒`}
                            size="small"
                            color="warning"
                          />
                        )}
                      </Box>
                    );
                  })()}

                  {/* 個体情報 */}
                  {lane.current_item?.inspection_info && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {lane.current_item.inspection_info}
                    </Typography>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    fullWidth
                    variant={myBids[lane.current_item!.id] ? 'contained' : 'outlined'}
                    color={myBids[lane.current_item!.id] ? 'success' : 'primary'}
                    size="large"
                    onClick={() => handleBidToggle(lane.current_item!.id)}
                    startIcon={myBids[lane.current_item!.id] ? <PauseIcon /> : <PlayArrowIcon />}
                  >
                    {myBids[lane.current_item!.id] ? '入札ON' : '入札OFF'}
                  </Button>
                  <IconButton
                    color="primary"
                    onClick={() => handleDetailOpen(lane.current_item!, lane.bidder_display)}
                  >
                    <InfoIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* 自分の入札状況 */}
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            あなたの入札状況
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(myBids).filter(([_, active]) => active).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                現在入札中の商品はありません
              </Typography>
            ) : (
              Object.entries(myBids)
                .filter(([_, active]) => active)
                .map(([itemId]) => {
                  const lane = mockLanes.find((l) => l.current_item?.id === Number(itemId));
                  return (
                    <Chip
                      key={itemId}
                      label={`レーン${lane?.lane_number}: ${lane?.current_item?.species_name}`}
                      color="success"
                      onDelete={() => handleBidToggle(Number(itemId))}
                    />
                  );
                })
            )}
          </Box>
        </Paper>
      </Container>

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
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <img
                src={selectedItem?.thumbnail_path}
                alt={selectedItem?.species_name}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              {/* 入札者数 */}
              {selectedItem && (
                <Box sx={{ mb: 2 }}>
                  <BidderCountDisplay 
                    count={selectedItem.bidder_count || 0} 
                    displayMode={getBidderDisplay(selectedItem, selectedLaneDisplay)} 
                  />
                </Box>
              )}

              <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                ¥{selectedItem?.current_price.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                開始価格: ¥{selectedItem?.start_price.toLocaleString()}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                匹数
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedItem?.quantity}匹
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
    </Box>
  );
}

