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

// Mock データ
const mockLanes: Lane[] = [
  {
    id: 1,
    auction_id: 1,
    lane_number: 1,
    status: 'active',
    current_item: {
      id: 1,
      auction_id: 1,
      item_number: 1,
      species_name: '幹之メダカ',
      quantity: 5,
      start_price: 500,
      current_price: 850,
      estimated_price: 1000,
      inspection_info: '体外光あり',
      individual_info: '全体的に光沢があり美しい個体です',
      is_premium: true,
      thumbnail_path: 'https://placehold.co/300x200/e3f2fd/1976d2?text=幹之メダカ',
      status: 'live',
    },
  },
  {
    id: 2,
    auction_id: 1,
    lane_number: 2,
    status: 'active',
    current_item: {
      id: 2,
      auction_id: 1,
      item_number: 1,
      species_name: '楊貴妃メダカ',
      quantity: 3,
      start_price: 300,
      current_price: 450,
      estimated_price: 600,
      inspection_info: '色揚げ良好',
      individual_info: '赤みが強く出ています',
      is_premium: false,
      thumbnail_path: 'https://placehold.co/300x200/ffebee/d32f2f?text=楊貴妃メダカ',
      status: 'live',
    },
  },
  {
    id: 3,
    auction_id: 1,
    lane_number: 3,
    status: 'active',
    current_item: {
      id: 3,
      auction_id: 1,
      item_number: 1,
      species_name: 'オロチメダカ',
      quantity: 4,
      start_price: 800,
      current_price: 800,
      estimated_price: 1500,
      inspection_info: '黒化良好',
      individual_info: '全身真っ黒な美個体',
      is_premium: true,
      thumbnail_path: 'https://placehold.co/300x200/424242/000000?text=オロチメダカ',
      status: 'live',
    },
  },
  {
    id: 4,
    auction_id: 1,
    lane_number: 4,
    status: 'active',
    current_item: {
      id: 4,
      auction_id: 1,
      item_number: 1,
      species_name: '三色錦メダカ',
      quantity: 6,
      start_price: 600,
      current_price: 750,
      is_premium: false,
      thumbnail_path: 'https://placehold.co/300x200/fff3e0/ff9800?text=三色錦メダカ',
      status: 'live',
    },
  },
  {
    id: 5,
    auction_id: 1,
    lane_number: 5,
    status: 'active',
    current_item: {
      id: 5,
      auction_id: 1,
      item_number: 1,
      species_name: '青幹之メダカ',
      quantity: 5,
      start_price: 700,
      current_price: 700,
      is_premium: false,
      thumbnail_path: 'https://placehold.co/300x200/e3f2fd/2196f3?text=青幹之メダカ',
      status: 'live',
    },
  },
  {
    id: 6,
    auction_id: 1,
    lane_number: 6,
    status: 'active',
    current_item: {
      id: 6,
      auction_id: 1,
      item_number: 6,
      species_name: '紅白メダカ',
      quantity: 4,
      start_price: 400,
      current_price: 550,
      is_premium: false,
      thumbnail_path: 'https://placehold.co/300x200/ffebee/f44336?text=紅白メダカ',
      status: 'live',
    },
  },
  {
    id: 7,
    auction_id: 1,
    lane_number: 1,
    status: 'active',
    current_item: {
      id: 6,
      auction_id: 1,
      item_number: 2,
      species_name: '紅白メダカ',
      quantity: 4,
      start_price: 400,
      current_price: 550,
      is_premium: false,
      thumbnail_path: 'https://placehold.co/300x200/ffebee/f44336?text=紅白メダカ',
      status: 'live',
    },
  },
];

export default function AuctionLive() {
  const [myBids, setMyBids] = useState<Record<number, boolean>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [countdown] = useState(3); // Mock: 実際はWebSocketで更新

  const handleBidToggle = (itemId: number) => {
    setMyBids((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleDetailOpen = (item: Item) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
  };

  // Mock: 入札者数
  const getActiveBidders = (itemId: number) => {
    return Math.floor(Math.random() * 5) + 1;
  };

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: 'calc(100vh - 64px)' }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5" fontWeight="bold">
              オークション会場 - 6レーン同時進行中
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
                {/* レーン番号 */}
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
                  }}
                >
                  レーン {lane.lane_number}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Chip
                      icon={<PeopleIcon />}
                      label={`${getActiveBidders(lane.current_item!.id)}人入札中`}
                      size="small"
                      color="primary"
                    />
                    {getActiveBidders(lane.current_item!.id) > 1 && (
                      <Chip
                        label={`${countdown}秒`}
                        size="small"
                        color="error"
                      />
                    )}
                  </Box>

                  {/* 審査情報 */}
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
                    onClick={() => handleDetailOpen(lane.current_item!)}
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
              <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                ¥{selectedItem?.current_price.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                開始価格: ¥{selectedItem?.start_price.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                落札想定: ¥{selectedItem?.estimated_price?.toLocaleString()}
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
    </Box>
  );
}

