import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface ItemData {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  estimated_price?: number;
  inspection_info?: string;
  individual_info?: string;
  is_premium: boolean;
  thumbnail_path?: string;
  status: string;
  media?: any[];
}

interface LaneData {
  lane_number: number;
  lane_name: string;
  status: string;
  items: ItemData[];
}

interface AuctionData {
  id: number;
  title: string;
  status: string;
  event_date: string;
}

export default function AuctionItems() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [lanes, setLanes] = useState<LaneData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  // データ取得
  const fetchItems = useCallback(async () => {
    try {
      const response = await axios.get(`/api/participant/auctions/${auctionId}/items`);
      if (response.data.success) {
        setAuction(response.data.data.auction);
        setLanes(response.data.data.lanes);
        setTotalItems(response.data.data.total_items);
        setError(null);
      }
    } catch (err: any) {
      console.error('アイテム取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleLaneChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedLane(newValue);
  };

  const handleDetailOpen = (item: ItemData) => {
    setSelectedItem(item);
    setSelectedMediaIndex(0);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedItem(null);
    setSelectedMediaIndex(0);
  };

  // メディア一覧を構築（サムネイル + 追加メディア）
  const getMediaList = (item: ItemData | null) => {
    if (!item) return [];
    const list: { type: 'image' | 'video'; url: string }[] = [];
    if (item.thumbnail_path) {
      list.push({ type: 'image', url: item.thumbnail_path });
    }
    if (item.media && item.media.length > 0) {
      item.media.forEach((m: any) => {
        const url = m.file_path || m.url;
        if (!url) return;
        // サムネイルと同じURLは重複除外
        if (item.thumbnail_path && url === item.thumbnail_path) return;
        const isVideo = m.media_type?.includes('video') || m.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(url);
        list.push({ type: isVideo ? 'video' : 'image', url });
      });
    }
    if (list.length === 0) {
      list.push({ type: 'image', url: '/img/noimage.png' });
    }
    return list;
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // 現在選択されているレーンのアイテム
  const currentItems = selectedLane === 0
    ? lanes.flatMap(lane => lane.items)
    : lanes[selectedLane - 1]?.items || [];

  // ステータスチップ
  const getStatusChip = (status: string) => {
    const config: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
      registered: { label: '出品中', color: 'primary' },
      live: { label: '入札中', color: 'error' },
      sold: { label: '落札済', color: 'success' },
      unsold: { label: '不成立', color: 'default' },
    };
    const c = config[status] || { label: status, color: 'default' };
    return <Chip label={c.label} color={c.color} size="small" />;
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
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={() => navigate('/participant')}>
          ホームに戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/participant')}>
              <ArrowBackIcon />
            </IconButton>
          <Box>
            <Typography variant="h5" fontWeight="bold">
                {auction?.title || '出品一覧'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              全{totalItems}点の出品があります
            </Typography>
            </Box>
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
          {lanes.map((lane, index) => (
            <Tab
              key={index}
              label={`${lane.lane_name} (${lane.items.length})`}
            />
          ))}
        </Tabs>
      </Paper>

      {/* アイテム一覧 */}
      {currentItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">出品がありません</Typography>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {currentItems.map((item) => (
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
                  image={item.thumbnail_path || '/img/noimage.png'}
                    alt={item.species_name}
                  />

                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        No.{item.item_number}
                      </Typography>
                    {getStatusChip(item.status)}
                    </Box>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                      {item.species_name}
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                      ¥{Number(item.start_price).toLocaleString()}〜
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
                <TableCell>個体情報</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">詳細</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentItems.map((item) => (
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
                  <TableCell align="right">¥{Number(item.start_price).toLocaleString()}</TableCell>
                    <TableCell>{item.inspection_info || '-'}</TableCell>
                    <TableCell align="center">
                    {getStatusChip(item.status)}
                    </TableCell>
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
      <Dialog open={detailOpen} onClose={handleDetailClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              No.{selectedItem?.item_number} {selectedItem?.species_name}
            </Typography>
            <IconButton onClick={handleDetailClose}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {(() => {
            const mediaList = getMediaList(selectedItem);
            const currentMedia = mediaList[selectedMediaIndex] || mediaList[0];
            return (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  {/* メイン表示 */}
                  <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                    {currentMedia?.type === 'video' ? (
                      <video
                        src={currentMedia.url}
                        controls
                        style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }}
                      />
                    ) : (
                      <img
                        src={currentMedia?.url || '/img/noimage.png'}
                        alt={selectedItem?.species_name}
                        style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain', cursor: 'pointer' }}
                        onClick={() => openLightbox(selectedMediaIndex)}
                      />
                    )}
                  </Box>

                  {/* サムネイル一覧 */}
                  {mediaList.length > 1 && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                      {mediaList.map((m, i) => (
                        <Box
                          key={i}
                          onClick={() => setSelectedMediaIndex(i)}
                          sx={{
                            width: 64, height: 64, flexShrink: 0, borderRadius: 1, overflow: 'hidden',
                            border: i === selectedMediaIndex ? '2px solid' : '2px solid transparent',
                            borderColor: i === selectedMediaIndex ? 'primary.main' : 'transparent',
                            cursor: 'pointer', position: 'relative', bgcolor: 'grey.200',
                          }}
                        >
                          {m.type === 'video' ? (
                            <>
                              <Box sx={{ width: '100%', height: '100%', bgcolor: 'grey.800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 28 }} />
                              </Box>
                            </>
                          ) : (
                            <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {selectedItem?.is_premium && <Chip label="プレミアム" color="warning" />}
                    {selectedItem && getStatusChip(selectedItem.status)}
                  </Box>
                  <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                    ¥{Number(selectedItem?.start_price || 0).toLocaleString()}〜
                  </Typography>
                  {selectedItem?.current_price && selectedItem.current_price !== selectedItem.start_price && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      現在価格: ¥{Number(selectedItem.current_price).toLocaleString()}
                    </Typography>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>匹数</Typography>
                  <Typography variant="body1" gutterBottom>{selectedItem?.quantity}匹セット</Typography>
                  {selectedItem?.inspection_info && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>個体情報</Typography>
                      <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.inspection_info}</Typography>
                    </>
                  )}
                  {selectedItem?.individual_info && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>詳細情報</Typography>
                      <Typography variant="body2" gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.individual_info}</Typography>
                    </>
                  )}
                </Grid>
              </Grid>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDetailClose}>閉じる</Button>
          {auction?.status === 'live' && (
            <Button variant="contained" onClick={() => { handleDetailClose(); navigate(`/participant/auctions/${auctionId}/live`); }}>
              ライブ画面へ
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 画像拡大ライトボックス */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none', m: 1, maxHeight: '98vh' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setLightboxOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
          {(() => {
            const mediaList = getMediaList(selectedItem);
            if (mediaList.length > 1) {
              return (
                <>
                  <IconButton onClick={() => setLightboxIndex((p) => (p - 1 + mediaList.length) % mediaList.length)}
                    sx={{ position: 'absolute', left: 8, color: 'white', zIndex: 2 }}>
                    <ChevronLeftIcon sx={{ fontSize: 40 }} />
                  </IconButton>
                  <IconButton onClick={() => setLightboxIndex((p) => (p + 1) % mediaList.length)}
                    sx={{ position: 'absolute', right: 8, color: 'white', zIndex: 2 }}>
                    <ChevronRightIcon sx={{ fontSize: 40 }} />
                  </IconButton>
                </>
              );
            }
            return null;
          })()}
          {(() => {
            const mediaList = getMediaList(selectedItem);
            const m = mediaList[lightboxIndex];
            if (!m) return null;
            if (m.type === 'video') {
              return <video src={m.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />;
            }
            return <img src={m.url} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />;
          })()}
        </Box>
        <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 1 }}>
          {lightboxIndex + 1} / {getMediaList(selectedItem).length}
        </Typography>
      </Dialog>
    </Container>
  );
}
