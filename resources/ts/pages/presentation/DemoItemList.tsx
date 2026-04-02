/**
 * デモ共通出品一覧画面
 * ガイド付き・ガイドなし両方で使用
 */
import {
  Box, Container, Typography, Button, Card, CardContent, Grid, Chip, Alert,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  MeetingRoom as MeetingRoomIcon,
} from '@mui/icons-material';
import { MOCK_AUCTIONS, MOCK_ITEMS, MOCK_LANES_LIST } from './mockData';

interface DemoItemListProps {
  onGoToWaitingRoom: () => void;
  /** ガイドモードの場合にステップ案内を表示 */
  isGuided?: boolean;
}

export function DemoItemList({ onGoToWaitingRoom, isGuided = false }: DemoItemListProps) {
  return (
    <Box>
      <Box sx={{
        background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
        color: 'white', py: 3, px: 2,
      }}>
        <Container maxWidth="lg">
          <Typography variant="h5" fontWeight="bold">{MOCK_AUCTIONS[0].title}</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>出品一覧 — 全{MOCK_ITEMS.length}点</Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pt: 3 }}>
        {/* Guide tooltip */}
        {isGuided && (
          <Alert severity="info" icon={<ArrowForwardIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold">ガイド付きデモ: ステップ 2/5</Typography>
            <Typography variant="body2">
              出品されている商品を確認できます。気になる商品があればチェックしておきましょう。
              確認したら「待機室に入室する」ボタンでオークション会場へ進みます。
            </Typography>
          </Alert>
        )}

        {/* Items by lane */}
        {MOCK_LANES_LIST.map((lane, laneIdx) => (
          <Box key={laneIdx} sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={lane.lane_name} color="primary" size="small" />
              {lane.items.length}点
            </Typography>
            <Grid container spacing={2}>
              {lane.items.map(item => (
                <Grid item xs={6} sm={4} md={3} key={item.id}>
                  <Card sx={{ height: '100%' }}>
                    <Box sx={{
                      width: '100%', aspectRatio: '4/3', bgcolor: 'grey.100',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      <img src={item.thumbnail_path || '/img/noimage.png'} alt={item.species_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>{item.species_name}</Typography>
                      {item.is_premium && <Chip label="プレミアム" size="small" color="warning" sx={{ ml: 0.5, height: 18, fontSize: '0.6rem' }} />}
                      <Typography variant="body2" color="primary.main" fontWeight="bold">
                        ¥{item.start_price.toLocaleString()}〜
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{item.quantity}匹</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}

        {/* Enter waiting room button */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Button variant="contained" size="large" color="success"
            startIcon={<MeetingRoomIcon />}
            endIcon={<ArrowForwardIcon />}
            onClick={onGoToWaitingRoom}
            sx={{ fontWeight: 700, px: 6, py: 2, fontSize: '1.1rem' }}>
            待機室に入室する
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
